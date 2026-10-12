from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, Response, Security
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Any, Dict, List, Literal, Optional
from pathlib import Path
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from email.message import EmailMessage
from io import BytesIO
import asyncio
import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
import uuid

import pandas as pd


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
ADMIN_JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET") or os.urandom(32).hex()
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get("ADMIN_TOKEN_EXPIRE_HOURS", "12"))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Çanakkale Konut Rehberi API")
admin_bearer = HTTPBearer(auto_error=False)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

FollowUpStatus = Literal["new", "contacted", "qualified", "follow_up", "closed", "archived"]
RequestType = Literal["seller", "buyer", "landlord", "tenant"]
ApplicationStatus = Literal["draft", "completed"]

PHONE_RE = re.compile(r"^\+?[0-9\s().-]{10,20}$")
RATE_LIMIT_WINDOW = timedelta(minutes=10)
RATE_LIMIT_MAX = 8
DEDUP_WINDOW = timedelta(hours=24)
INITIAL_PARTIAL_ADMIN_NOTE = "Takip edilecek yarım başvuru"
DRAFT_RETENTION_DAYS = int(os.environ.get("DRAFT_RETENTION_DAYS", "30"))
DRAFT_TOKEN_HEADER = "x-ckr-draft-token"
PROCESSING_LEGAL_BASIS = (
    "Başvuru talebinin değerlendirilmesi, kullanıcıyla iletişim kurulması ve talep edilen hizmete ilişkin "
    "sözleşme öncesi süreçlerin yürütülmesi; ayrıca başvurunun takip edilebilmesi için meşru menfaat."
)
KVKK_NOTICE_VERSION = os.environ.get("KVKK_NOTICE_VERSION", "2026-10-12")
request_log: Dict[str, List[datetime]] = {}


class ContactInfo(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=10, max_length=24)
    email: Optional[EmailStr] = None

    @field_validator("name", "phone", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        if not PHONE_RE.match(value):
            raise ValueError("Telefon numarası geçerli görünmüyor.")
        return value


class LocationSelection(BaseModel):
    scope: Optional[str] = Field(default=None, max_length=50)
    province: Optional[str] = Field(default=None, max_length=80)
    province_code: Optional[str] = Field(default=None, max_length=20)
    district: Optional[str] = Field(default=None, max_length=100)
    district_code: Optional[str] = Field(default=None, max_length=30)
    municipality: Optional[str] = Field(default=None, max_length=120)
    municipality_code: Optional[str] = Field(default=None, max_length=30)
    settlement: Optional[str] = Field(default=None, max_length=140)
    settlement_code: Optional[str] = Field(default=None, max_length=40)
    settlement_type: Optional[str] = Field(default=None, max_length=60)
    label: Optional[str] = Field(default=None, max_length=260)


class LocationInfo(BaseModel):
    mode: Optional[Literal["single", "multiple"]] = None
    province: Optional[str] = Field(default=None, max_length=80)
    province_code: Optional[str] = Field(default=None, max_length=20)
    district: Optional[str] = Field(default=None, max_length=100)
    district_code: Optional[str] = Field(default=None, max_length=30)
    districts: List[str] = Field(default_factory=list, max_length=50)
    neighborhood: Optional[str] = Field(default=None, max_length=200)
    municipality: Optional[str] = Field(default=None, max_length=120)
    municipality_code: Optional[str] = Field(default=None, max_length=30)
    settlement: Optional[str] = Field(default=None, max_length=140)
    settlement_code: Optional[str] = Field(default=None, max_length=40)
    settlement_type: Optional[str] = Field(default=None, max_length=60)
    raw: Optional[str] = Field(default=None, max_length=1500)
    selections: List[LocationSelection] = Field(default_factory=list, max_length=120)


class SourceInfo(BaseModel):
    form_type: Optional[str] = Field(default=None, max_length=80)
    button_source: Optional[str] = Field(default=None, max_length=120)
    page_path: Optional[str] = Field(default=None, max_length=240)
    referrer: Optional[str] = Field(default=None, max_length=500)
    campaign: Optional[str] = Field(default=None, max_length=160)
    user_agent: Optional[str] = Field(default=None, max_length=500)


class MotivationResult(BaseModel):
    answers: Optional[Any] = None
    score: Optional[int] = Field(default=None, ge=0, le=100)
    category: Optional[str] = Field(default=None, max_length=80)
    summary: Optional[str] = Field(default=None, max_length=700)


class LeadCreate(BaseModel):
    application_id: Optional[str] = Field(default=None, max_length=80)
    application_status: Optional[ApplicationStatus] = None
    request_type: RequestType
    property_type: Optional[str] = Field(default=None, max_length=100)
    location: LocationInfo = Field(default_factory=LocationInfo)
    property_features: Dict[str, Any] = Field(default_factory=dict)
    budget_expectation: Optional[str] = Field(default=None, max_length=160)
    price_expectation: Optional[str] = Field(default=None, max_length=160)
    timing: Optional[str] = Field(default=None, max_length=120)
    contact: ContactInfo
    source: SourceInfo = Field(default_factory=SourceInfo)
    motivation: Optional[MotivationResult] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    kvkk_acknowledged: bool = False
    kvkk_acknowledged_at: Optional[datetime] = None
    kvkk_notice_presented: bool = False
    kvkk_notice_presented_at: Optional[datetime] = None
    kvkk_notice_version: Optional[str] = Field(default=None, max_length=40)
    marketing_consent: bool = False
    marketing_consent_at: Optional[datetime] = None
    processing_legal_basis: Optional[str] = Field(default=None, max_length=700)
    honeypot: Optional[str] = Field(default="", max_length=120)
    started_at: Optional[datetime] = None

    @field_validator("application_id", "property_type", "budget_expectation", "price_expectation", "timing", "notes", mode="before")
    @classmethod
    def trim_optional_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class LeadUpdate(BaseModel):
    follow_up_status: Optional[FollowUpStatus] = None
    admin_notes: Optional[str] = Field(default=None, max_length=5000)


class LeadPreferenceUpdate(BaseModel):
    preference: Literal["DECIDING_LATER", "ADVISOR_REQUESTED"]


class AdminLogin(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LeadResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    application_id: Optional[str] = None
    application_status: ApplicationStatus = "completed"
    request_type: RequestType
    property_type: Optional[str] = None
    location: LocationInfo
    property_features: Dict[str, Any]
    budget_expectation: Optional[str] = None
    price_expectation: Optional[str] = None
    timing: Optional[str] = None
    contact: ContactInfo
    source: SourceInfo
    motivation: Optional[MotivationResult] = None
    created_at: datetime
    updated_at: datetime
    follow_up_status: FollowUpStatus
    admin_notes: Optional[str] = None
    email_notification_status: Optional[str] = None
    kvkk_acknowledged: bool = False
    kvkk_acknowledged_at: Optional[datetime] = None
    kvkk_notice_presented: bool = False
    kvkk_notice_presented_at: Optional[datetime] = None
    kvkk_notice_version: Optional[str] = None
    marketing_consent: bool = False
    marketing_consent_at: Optional[datetime] = None
    processing_legal_basis: Optional[str] = None
    completed_at: Optional[datetime] = None
    draft_expires_at: Optional[datetime] = None


class LeadDraftResponse(LeadResponse):
    draft_token: Optional[str] = None


class LeadListResponse(BaseModel):
    items: List[LeadResponse]
    total: int


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("90") and len(digits) == 12:
        return digits
    if digits.startswith("0") and len(digits) == 11:
        return "9" + digits
    return digits


def build_dedupe_key(payload: LeadCreate) -> str:
    selection_text = "|".join(
        [
            item.label or item.settlement or item.district or item.province or ""
            for item in (payload.location.selections or [])
        ]
    )
    parts = [
        normalize_phone(payload.contact.phone),
        payload.request_type,
        payload.property_type or "",
        payload.location.province or "",
        payload.location.raw or "",
        payload.location.district or "",
        payload.location.neighborhood or "",
        selection_text,
        payload.budget_expectation or "",
        payload.price_expectation or "",
    ]
    return hashlib.sha256("|".join(parts).lower().encode("utf-8")).hexdigest()


def make_application_id() -> str:
    return str(uuid.uuid4())


def make_draft_token() -> str:
    return secrets.token_urlsafe(32)


def hash_draft_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_draft_expiry(now: datetime) -> datetime:
    return now + timedelta(days=DRAFT_RETENTION_DAYS)


def check_submission_guard(payload: LeadCreate) -> None:
    if payload.honeypot:
        raise HTTPException(status_code=400, detail="Başvuru doğrulaması başarısız.")
    if payload.started_at:
        now = datetime.now(timezone.utc)
        started_at = payload.started_at if payload.started_at.tzinfo else payload.started_at.replace(tzinfo=timezone.utc)
        if now - started_at < timedelta(seconds=2):
            raise HTTPException(status_code=400, detail="Başvuru çok hızlı gönderildi.")


def require_kvkk_notice(payload: LeadCreate) -> None:
    if not (payload.kvkk_notice_presented or payload.kvkk_acknowledged):
        raise HTTPException(status_code=400, detail="KVKK Aydınlatma Metni kullanıcıya sunulmadan başvuru kaydedilemez.")


def prepare_lead_fields(payload: LeadCreate, request: Request, status: ApplicationStatus) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = payload.model_dump(mode="json", exclude={"honeypot", "started_at"})
    doc["application_id"] = doc.get("application_id") or make_application_id()
    doc["application_status"] = status
    doc["processing_legal_basis"] = doc.get("processing_legal_basis") or PROCESSING_LEGAL_BASIS
    if doc.get("kvkk_acknowledged") and not doc.get("kvkk_notice_presented"):
        doc["kvkk_notice_presented"] = True
    if doc.get("kvkk_notice_presented") and not doc.get("kvkk_notice_presented_at"):
        doc["kvkk_notice_presented_at"] = doc.get("kvkk_acknowledged_at") or now.isoformat()
    if doc.get("kvkk_notice_presented") and not doc.get("kvkk_notice_version"):
        doc["kvkk_notice_version"] = KVKK_NOTICE_VERSION
    if doc.get("kvkk_acknowledged") and not doc.get("kvkk_acknowledged_at"):
        doc["kvkk_acknowledged_at"] = now.isoformat()
    if doc.get("marketing_consent") and not doc.get("marketing_consent_at"):
        doc["marketing_consent_at"] = now.isoformat()
    if not doc.get("marketing_consent"):
        doc["marketing_consent_at"] = None
    doc["contact"]["phone_normalized"] = normalize_phone(payload.contact.phone)
    doc["source"]["user_agent"] = request.headers.get("user-agent", "")[:500]
    return doc


def attach_draft_token(doc: Dict[str, Any], token: Optional[str]) -> Dict[str, Any]:
    response_doc = {key: value for key, value in doc.items() if key not in {"_id", "draft_access_hash"}}
    if token:
        response_doc["draft_token"] = token
    return response_doc


def verify_draft_access(lead: Dict[str, Any], request: Request) -> None:
    provided = request.headers.get(DRAFT_TOKEN_HEADER)
    expected = lead.get("draft_access_hash")
    if not provided or not expected:
        raise HTTPException(status_code=403, detail="Taslak başvuru erişimi doğrulanamadı.")
    if not hmac.compare_digest(hash_draft_token(provided), expected):
        raise HTTPException(status_code=403, detail="Taslak başvuru erişimi doğrulanamadı.")


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request) -> None:
    now = datetime.now(timezone.utc)
    ip = get_client_ip(request)
    entries = [t for t in request_log.get(ip, []) if now - t < RATE_LIMIT_WINDOW]
    if len(entries) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Çok fazla başvuru denemesi yapıldı.")
    entries.append(now)
    request_log[ip] = entries


def create_access_token() -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": "admin", "exp": expires_at}, ADMIN_JWT_SECRET, algorithm=JWT_ALGORITHM)


async def require_admin(credentials: Optional[HTTPAuthorizationCredentials] = Security(admin_bearer)) -> str:
    if not credentials or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Yönetici oturumu gerekli.")
    try:
        payload = jwt.decode(credentials.credentials, ADMIN_JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Yönetici oturumu geçersiz.")
    if payload.get("sub") != "admin":
        raise HTTPException(status_code=401, detail="Yönetici oturumu geçersiz.")
    return "admin"


def smtp_configured() -> bool:
    required = ["SMTP_HOST", "SMTP_PORT", "SMTP_FROM", "ADMIN_EMAIL"]
    return all(os.environ.get(key) for key in required)


def send_email_sync(subject: str, body: str) -> bool:
    if not smtp_configured():
        logger.warning("SMTP ayarları eksik olduğu için yönetici e-postası gönderilmedi.")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = os.environ["ADMIN_EMAIL"]
    message.set_content(body)

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    use_tls = os.environ.get("SMTP_TLS", "true").lower() != "false"

    with smtplib.SMTP(host, port, timeout=12) as smtp:
        if use_tls:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)
    return True


async def notify_admin(lead: Dict[str, Any]) -> None:
    contact = lead.get("contact", {})
    location = lead.get("location", {})
    subject = f"Yeni ÇKR başvurusu: {contact.get('name', 'İsimsiz')}"
    body = "\n".join(
        [
            "Çanakkale Konut Rehberi üzerinden yeni müşteri başvurusu alındı.",
            "",
            f"Talep türü: {lead.get('request_type')}",
            f"Ad soyad: {contact.get('name')}",
            f"Telefon: {contact.get('phone')}",
            f"E-posta: {contact.get('email') or '-'}",
            f"Mülk türü: {lead.get('property_type') or '-'}",
            f"Konum: {location.get('raw') or location.get('district') or '-'}",
            f"Bütçe/fiyat beklentisi: {lead.get('budget_expectation') or lead.get('price_expectation') or '-'}",
            f"Kaynak: {lead.get('source', {}).get('button_source') or lead.get('source', {}).get('form_type') or '-'}",
            f"Kayıt ID: {lead.get('id')}",
        ]
    )
    try:
        sent = await asyncio.to_thread(send_email_sync, subject, body)
        status = "sent" if sent else "not_configured"
    except Exception:
        logger.exception("Yönetici e-postası gönderilemedi.")
        status = "failed"
    await db.leads.update_one(
        {"id": lead["id"]},
        {"$set": {"email_notification_status": status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )


async def ensure_indexes() -> None:
    await db.leads.create_index("id", unique=True)
    await db.leads.create_index("application_id", unique=True, sparse=True)
    await db.leads.create_index("application_status")
    await db.leads.create_index("draft_expires_at")
    await db.leads.create_index("created_at")
    await db.leads.create_index("request_type")
    await db.leads.create_index("follow_up_status")
    await db.leads.create_index("location.province")
    await db.leads.create_index("location.district")
    await db.leads.create_index("location.neighborhood")
    await db.leads.create_index("location.selections.label")
    await db.leads.create_index("contact.phone_normalized")
    await db.leads.create_index("dedupe_key")


async def delete_expired_drafts() -> None:
    now = datetime.now(timezone.utc).isoformat()
    await db.leads.delete_many({"application_status": "draft", "draft_expires_at": {"$lt": now}})


@app.on_event("startup")
async def startup() -> None:
    await ensure_indexes()
    await delete_expired_drafts()


@app.get("/api/")
async def root():
    return {"message": "ÇKR API çalışıyor"}


@app.post("/api/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@app.get("/api/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check["timestamp"], str):
            check["timestamp"] = datetime.fromisoformat(check["timestamp"])
    return status_checks


@app.post("/api/leads", response_model=LeadResponse, status_code=201)
async def create_lead(payload: LeadCreate, request: Request, background_tasks: BackgroundTasks):
    enforce_rate_limit(request)
    check_submission_guard(payload)
    require_kvkk_notice(payload)

    dedupe_key = build_dedupe_key(payload)
    cutoff = datetime.now(timezone.utc) - DEDUP_WINDOW
    duplicate = await db.leads.find_one(
        {
            "dedupe_key": dedupe_key,
            "created_at": {"$gte": cutoff.isoformat()},
            "application_status": {"$ne": "draft"},
        },
        {"_id": 0},
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Bu başvuru yakın zamanda zaten alınmış görünüyor.")

    now = datetime.now(timezone.utc)
    doc = prepare_lead_fields(payload, request, "completed")
    doc["id"] = str(uuid.uuid4())
    doc["application_id"] = doc.get("application_id") or make_application_id()
    doc["application_status"] = "completed"
    doc["created_at"] = now.isoformat()
    doc["updated_at"] = now.isoformat()
    doc["completed_at"] = now.isoformat()
    doc["draft_expires_at"] = None
    doc["follow_up_status"] = "new"
    doc["admin_notes"] = INITIAL_PARTIAL_ADMIN_NOTE
    doc["dedupe_key"] = dedupe_key
    doc["email_notification_status"] = "pending"

    await db.leads.insert_one(doc)
    background_tasks.add_task(notify_admin, doc)
    doc.pop("_id", None)
    return doc


@app.post("/api/leads/draft", response_model=LeadDraftResponse, status_code=201)
async def create_lead_draft(payload: LeadCreate, request: Request):
    enforce_rate_limit(request)
    check_submission_guard(payload)
    require_kvkk_notice(payload)

    application_id = payload.application_id or make_application_id()
    existing = await db.leads.find_one({"application_id": application_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Bu taslak başvuru zaten oluşturulmuş.")

    now = datetime.now(timezone.utc)
    draft_token = make_draft_token()
    payload.application_id = application_id
    doc = prepare_lead_fields(payload, request, "draft")
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now.isoformat()
    doc["updated_at"] = now.isoformat()
    doc["completed_at"] = None
    doc["draft_expires_at"] = get_draft_expiry(now).isoformat()
    doc["follow_up_status"] = "follow_up"
    doc["admin_notes"] = INITIAL_PARTIAL_ADMIN_NOTE
    doc["dedupe_key"] = f"draft:{application_id}"
    doc["draft_access_hash"] = hash_draft_token(draft_token)
    doc["email_notification_status"] = "not_scheduled"

    await db.leads.insert_one(doc)
    return attach_draft_token(doc, draft_token)


@app.patch("/api/leads/{application_id}/draft", response_model=LeadResponse)
async def update_lead_draft(application_id: str, payload: LeadCreate, request: Request):
    require_kvkk_notice(payload)
    lead = await db.leads.find_one({"application_id": application_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Taslak başvuru bulunamadı.")
    verify_draft_access(lead, request)
    if lead.get("application_status") == "completed":
        return lead

    now = datetime.now(timezone.utc)
    payload.application_id = application_id
    updates = prepare_lead_fields(payload, request, "draft")
    updates["updated_at"] = now.isoformat()
    updates["draft_expires_at"] = get_draft_expiry(now).isoformat()
    updates["completed_at"] = None
    updates["email_notification_status"] = lead.get("email_notification_status") or "not_scheduled"
    if not updates.get("admin_notes"):
        updates["admin_notes"] = lead.get("admin_notes") or INITIAL_PARTIAL_ADMIN_NOTE
    await db.leads.update_one({"application_id": application_id}, {"$set": updates})
    updated = await db.leads.find_one({"application_id": application_id}, {"_id": 0})
    return updated


@app.patch("/api/leads/{application_id}/complete", response_model=LeadResponse)
async def complete_lead_draft(application_id: str, payload: LeadCreate, request: Request, background_tasks: BackgroundTasks):
    require_kvkk_notice(payload)
    lead = await db.leads.find_one({"application_id": application_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Taslak başvuru bulunamadı.")
    verify_draft_access(lead, request)
    if lead.get("application_status") == "completed":
        return lead

    now = datetime.now(timezone.utc)
    payload.application_id = application_id
    updates = prepare_lead_fields(payload, request, "completed")
    updates["updated_at"] = now.isoformat()
    updates["completed_at"] = now.isoformat()
    updates["draft_expires_at"] = None
    updates["follow_up_status"] = "new"
    updates["email_notification_status"] = "pending"
    if (lead.get("admin_notes") or "") in ("", INITIAL_PARTIAL_ADMIN_NOTE):
        updates["admin_notes"] = INITIAL_PARTIAL_ADMIN_NOTE

    await db.leads.update_one({"application_id": application_id}, {"$set": updates})
    updated = await db.leads.find_one({"application_id": application_id}, {"_id": 0})
    background_tasks.add_task(notify_admin, updated)
    return updated


@app.patch("/api/leads/{lead_id}/preference", response_model=LeadResponse)
async def update_lead_preference(lead_id: str, payload: LeadPreferenceUpdate):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Başvuru bulunamadı.")

    now = datetime.now(timezone.utc)
    features = lead.get("property_features") or {}
    if payload.preference == "ADVISOR_REQUESTED":
        features["Son ekran tercihi"] = "Formu Danışmana Yolla"
        features["Danışmanlık talebi"] = "ADVISOR_REQUESTED"
        follow_up_status = "qualified"
        admin_notes = "Formu danışmana yolla tercihi seçildi."
    else:
        features["Son ekran tercihi"] = "Kararımı Netleştirip Haber Vereceğim"
        features["Danışmanlık talebi"] = "DECIDING_LATER"
        follow_up_status = "follow_up"
        admin_notes = INITIAL_PARTIAL_ADMIN_NOTE

    updates = {
        "property_features": features,
        "follow_up_status": follow_up_status,
        "updated_at": now.isoformat(),
    }
    if (lead.get("admin_notes") or "") in ("", INITIAL_PARTIAL_ADMIN_NOTE):
        updates["admin_notes"] = admin_notes
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    updated = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


@app.post("/api/admin/login", response_model=TokenResponse)
async def admin_login(payload: AdminLogin):
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="Yönetici şifresi yapılandırılmamış.")
    if not hmac.compare_digest(payload.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Şifre hatalı.")
    return TokenResponse(access_token=create_access_token())


def add_location_filter(and_filters: List[Dict[str, Any]], value: Optional[str], fields: List[str]) -> None:
    if not value:
        return
    safe_value = re.escape(value.strip())
    and_filters.append({"$or": [{field: {"$regex": safe_value, "$options": "i"}} for field in fields]})


def lead_filters(
    q: Optional[str],
    request_type: Optional[RequestType],
    follow_up_status: Optional[FollowUpStatus],
    application_status: Optional[ApplicationStatus],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    province: Optional[str] = None,
    district: Optional[str] = None,
    settlement: Optional[str] = None,
) -> Dict[str, Any]:
    filters: Dict[str, Any] = {}
    and_filters: List[Dict[str, Any]] = []
    if request_type:
        filters["request_type"] = request_type
    if follow_up_status:
        filters["follow_up_status"] = follow_up_status
    if application_status == "draft":
        filters["application_status"] = "draft"
    elif application_status == "completed":
        and_filters.append({"$or": [{"application_status": "completed"}, {"application_status": {"$exists": False}}]})
    if date_from or date_to:
        created_filter: Dict[str, str] = {}
        if date_from:
            created_filter["$gte"] = date_from.isoformat()
        if date_to:
            created_filter["$lte"] = date_to.isoformat()
        filters["created_at"] = created_filter
    if q:
        safe_q = re.escape(q.strip())
        and_filters.append({"$or": [
            {"contact.name": {"$regex": safe_q, "$options": "i"}},
            {"contact.phone": {"$regex": safe_q, "$options": "i"}},
            {"contact.email": {"$regex": safe_q, "$options": "i"}},
            {"location.province": {"$regex": safe_q, "$options": "i"}},
            {"location.raw": {"$regex": safe_q, "$options": "i"}},
            {"location.district": {"$regex": safe_q, "$options": "i"}},
            {"location.districts": {"$regex": safe_q, "$options": "i"}},
            {"location.neighborhood": {"$regex": safe_q, "$options": "i"}},
            {"location.settlement": {"$regex": safe_q, "$options": "i"}},
            {"location.selections.label": {"$regex": safe_q, "$options": "i"}},
        ]})
    add_location_filter(and_filters, province, ["location.province", "location.selections.province", "location.raw"])
    add_location_filter(and_filters, district, ["location.district", "location.districts", "location.selections.district", "location.raw"])
    add_location_filter(and_filters, settlement, ["location.neighborhood", "location.settlement", "location.selections.settlement", "location.selections.label", "location.raw"])
    if and_filters:
        filters["$and"] = and_filters
    return filters


@app.get("/api/admin/leads", response_model=LeadListResponse)
async def list_leads(
    _: str = Depends(require_admin),
    q: Optional[str] = None,
    request_type: Optional[RequestType] = None,
    follow_up_status: Optional[FollowUpStatus] = None,
    application_status: Optional[ApplicationStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    province: Optional[str] = None,
    district: Optional[str] = None,
    settlement: Optional[str] = None,
    sort_by: Literal["created_at", "name", "request_type", "follow_up_status", "application_status"] = "created_at",
    sort_dir: Literal["asc", "desc"] = "desc",
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
):
    filters = lead_filters(q, request_type, follow_up_status, application_status, date_from, date_to, province, district, settlement)
    sort_map = {
        "name": "contact.name",
        "created_at": "created_at",
        "request_type": "request_type",
        "follow_up_status": "follow_up_status",
        "application_status": "application_status",
    }
    direction = 1 if sort_dir == "asc" else -1
    total = await db.leads.count_documents(filters)
    rows = await db.leads.find(filters, {"_id": 0}).sort(sort_map[sort_by], direction).skip(skip).limit(limit).to_list(limit)
    return {"items": rows, "total": total}


@app.get("/api/admin/leads/export.xlsx")
async def export_leads(
    _: str = Depends(require_admin),
    q: Optional[str] = None,
    request_type: Optional[RequestType] = None,
    follow_up_status: Optional[FollowUpStatus] = None,
    application_status: Optional[ApplicationStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    province: Optional[str] = None,
    district: Optional[str] = None,
    settlement: Optional[str] = None,
):
    filters = lead_filters(q, request_type, follow_up_status, application_status, date_from, date_to, province, district, settlement)
    rows = await db.leads.find(filters, {"_id": 0}).sort("created_at", -1).to_list(10000)
    main_rows = []
    detail_rows = []
    motivation_rows = []
    for row in rows:
        contact = row.get("contact", {})
        location = row.get("location", {})
        location_selections = location.get("selections") or []
        selected_locations = " | ".join(
            [
                item.get("label") or item.get("settlement") or item.get("district") or item.get("province") or ""
                for item in location_selections
            ]
        )
        source = row.get("source", {})
        motivation = row.get("motivation") or {}
        property_features = row.get("property_features") or {}
        main_rows.append(
            {
                "Başvuru ID": row.get("application_id") or row.get("id"),
                "Başvuru durumu": "Yarım Başvuru" if row.get("application_status") == "draft" else "Tamamlanan Başvuru",
                "Başvuru tarihi": row.get("created_at"),
                "Tamamlanma tarihi": row.get("completed_at"),
                "Taslak saklama sonu": row.get("draft_expires_at"),
                "Ad soyad": contact.get("name"),
                "Telefon": contact.get("phone"),
                "E-posta": contact.get("email"),
                "Talep türü": row.get("request_type"),
                "Mülk türü": row.get("property_type"),
                "İl": location.get("province"),
                "İl kodu": location.get("province_code"),
                "İlçe": location.get("district"),
                "İlçe kodu": location.get("district_code"),
                "Seçilen ilçeler": ", ".join(location.get("districts") or []),
                "Mahalle": location.get("neighborhood"),
                "Mahalle/Belde/Köy": location.get("settlement") or location.get("neighborhood"),
                "Yerleşim türü": location.get("settlement_type"),
                "Konum": location.get("raw"),
                "Çoklu bölge tercihleri": selected_locations,
                "Bütçe/Fiyat beklentisi": row.get("budget_expectation") or row.get("price_expectation"),
                "İşlem zamanlaması": row.get("timing"),
                "Başvuru kaynağı": source.get("button_source") or source.get("form_type"),
                "Motivasyon puanı": motivation.get("score"),
                "Motivasyon durumu": motivation.get("category"),
                "Son ekran tercihi": property_features.get("Son ekran tercihi"),
                "Danışmanlık talebi": property_features.get("Danışmanlık talebi"),
                "Müşteri takip durumu": row.get("follow_up_status"),
                "KVKK aydınlatma sunuldu": "Evet" if (row.get("kvkk_notice_presented") or row.get("kvkk_acknowledged")) else "Hayır",
                "KVKK aydınlatma tarihi": row.get("kvkk_notice_presented_at") or row.get("kvkk_acknowledged_at"),
                "KVKK metin sürümü": row.get("kvkk_notice_version"),
                "Okudum beyanı": "Evet" if row.get("kvkk_acknowledged") else "Hayır",
                "Pazarlama izni": "Evet" if row.get("marketing_consent") else "Hayır",
                "Hukuki sebep": row.get("processing_legal_basis"),
                "Takip notu": row.get("admin_notes"),
            }
        )
        for key, value in property_features.items():
            detail_rows.append({"Müşteri ID": row.get("id"), "Alan": key, "Değer": value})
        if motivation:
            motivation_rows.append(
                {
                    "Müşteri ID": row.get("id"),
                    "Puan": motivation.get("score"),
                    "Kategori": motivation.get("category"),
                    "Özet": motivation.get("summary"),
                    "Cevaplar": motivation.get("answers"),
                }
            )

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(main_rows).to_excel(writer, index=False, sheet_name="Müşteri Başvuruları")
        pd.DataFrame(detail_rows).to_excel(writer, index=False, sheet_name="Mülk Detayları")
        pd.DataFrame(motivation_rows).to_excel(writer, index=False, sheet_name="Motivasyon")
    output.seek(0)
    filename = f"ckr-musteri-basvurulari-{datetime.now(timezone.utc).date().isoformat()}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        output,
        headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/admin/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, _: str = Depends(require_admin)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")
    return lead


@app.patch("/api/admin/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: str, payload: LeadUpdate, _: str = Depends(require_admin)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")
    updates = payload.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    updated = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return updated


@app.options("/api/admin/leads/export.xlsx")
async def export_options():
    return Response(status_code=204)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
