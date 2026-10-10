from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
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

PHONE_RE = re.compile(r"^\+?[0-9\s().-]{10,20}$")
RATE_LIMIT_WINDOW = timedelta(minutes=10)
RATE_LIMIT_MAX = 8
DEDUP_WINDOW = timedelta(hours=24)
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


class LocationInfo(BaseModel):
    district: Optional[str] = Field(default=None, max_length=100)
    neighborhood: Optional[str] = Field(default=None, max_length=100)
    raw: Optional[str] = Field(default=None, max_length=200)


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
    honeypot: Optional[str] = Field(default="", max_length=120)
    started_at: Optional[datetime] = None

    @field_validator("property_type", "budget_expectation", "price_expectation", "timing", "notes", mode="before")
    @classmethod
    def trim_optional_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class LeadUpdate(BaseModel):
    follow_up_status: Optional[FollowUpStatus] = None
    admin_notes: Optional[str] = Field(default=None, max_length=5000)


class AdminLogin(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LeadResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
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
    parts = [
        normalize_phone(payload.contact.phone),
        payload.request_type,
        payload.property_type or "",
        payload.location.raw or "",
        payload.location.district or "",
        payload.location.neighborhood or "",
        payload.budget_expectation or "",
        payload.price_expectation or "",
    ]
    return hashlib.sha256("|".join(parts).lower().encode("utf-8")).hexdigest()


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


def read_bearer_token(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Yönetici oturumu gerekli.")
    return token


async def require_admin(request: Request) -> str:
    token = read_bearer_token(request)
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[JWT_ALGORITHM])
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
    await db.leads.create_index("created_at")
    await db.leads.create_index("request_type")
    await db.leads.create_index("follow_up_status")
    await db.leads.create_index("contact.phone_normalized")
    await db.leads.create_index("dedupe_key")


@app.on_event("startup")
async def startup() -> None:
    await ensure_indexes()


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
    if payload.honeypot:
        raise HTTPException(status_code=400, detail="Başvuru doğrulaması başarısız.")
    if payload.started_at:
        now = datetime.now(timezone.utc)
        started_at = payload.started_at if payload.started_at.tzinfo else payload.started_at.replace(tzinfo=timezone.utc)
        if now - started_at < timedelta(seconds=2):
            raise HTTPException(status_code=400, detail="Başvuru çok hızlı gönderildi.")

    dedupe_key = build_dedupe_key(payload)
    cutoff = datetime.now(timezone.utc) - DEDUP_WINDOW
    duplicate = await db.leads.find_one(
        {
            "dedupe_key": dedupe_key,
            "created_at": {"$gte": cutoff.isoformat()},
        },
        {"_id": 0},
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Bu başvuru yakın zamanda zaten alınmış görünüyor.")

    now = datetime.now(timezone.utc)
    doc = payload.model_dump(exclude={"honeypot", "started_at"})
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now.isoformat()
    doc["updated_at"] = now.isoformat()
    doc["follow_up_status"] = "new"
    doc["admin_notes"] = ""
    doc["dedupe_key"] = dedupe_key
    doc["contact"]["phone_normalized"] = normalize_phone(payload.contact.phone)
    doc["source"]["user_agent"] = request.headers.get("user-agent", "")[:500]
    doc["email_notification_status"] = "pending"

    await db.leads.insert_one(doc)
    background_tasks.add_task(notify_admin, doc)
    doc.pop("_id", None)
    return doc


@app.post("/api/admin/login", response_model=TokenResponse)
async def admin_login(payload: AdminLogin):
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="Yönetici şifresi yapılandırılmamış.")
    if not hmac.compare_digest(payload.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Şifre hatalı.")
    return TokenResponse(access_token=create_access_token())


def lead_filters(
    q: Optional[str],
    request_type: Optional[RequestType],
    follow_up_status: Optional[FollowUpStatus],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
) -> Dict[str, Any]:
    filters: Dict[str, Any] = {}
    if request_type:
        filters["request_type"] = request_type
    if follow_up_status:
        filters["follow_up_status"] = follow_up_status
    if date_from or date_to:
        created_filter: Dict[str, str] = {}
        if date_from:
            created_filter["$gte"] = date_from.isoformat()
        if date_to:
            created_filter["$lte"] = date_to.isoformat()
        filters["created_at"] = created_filter
    if q:
        safe_q = re.escape(q.strip())
        filters["$or"] = [
            {"contact.name": {"$regex": safe_q, "$options": "i"}},
            {"contact.phone": {"$regex": safe_q, "$options": "i"}},
            {"contact.email": {"$regex": safe_q, "$options": "i"}},
            {"location.raw": {"$regex": safe_q, "$options": "i"}},
            {"location.district": {"$regex": safe_q, "$options": "i"}},
            {"location.neighborhood": {"$regex": safe_q, "$options": "i"}},
        ]
    return filters


@app.get("/api/admin/leads", response_model=LeadListResponse)
async def list_leads(
    _: str = Depends(require_admin),
    q: Optional[str] = None,
    request_type: Optional[RequestType] = None,
    follow_up_status: Optional[FollowUpStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: Literal["created_at", "name", "request_type", "follow_up_status"] = "created_at",
    sort_dir: Literal["asc", "desc"] = "desc",
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
):
    filters = lead_filters(q, request_type, follow_up_status, date_from, date_to)
    sort_map = {"name": "contact.name", "created_at": "created_at", "request_type": "request_type", "follow_up_status": "follow_up_status"}
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
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    filters = lead_filters(q, request_type, follow_up_status, date_from, date_to)
    rows = await db.leads.find(filters, {"_id": 0}).sort("created_at", -1).to_list(10000)
    main_rows = []
    detail_rows = []
    motivation_rows = []
    for row in rows:
        contact = row.get("contact", {})
        location = row.get("location", {})
        source = row.get("source", {})
        motivation = row.get("motivation") or {}
        main_rows.append(
            {
                "Başvuru tarihi": row.get("created_at"),
                "Ad soyad": contact.get("name"),
                "Telefon": contact.get("phone"),
                "E-posta": contact.get("email"),
                "Talep türü": row.get("request_type"),
                "Mülk türü": row.get("property_type"),
                "İlçe": location.get("district"),
                "Mahalle": location.get("neighborhood"),
                "Konum": location.get("raw"),
                "Bütçe/Fiyat beklentisi": row.get("budget_expectation") or row.get("price_expectation"),
                "İşlem zamanlaması": row.get("timing"),
                "Başvuru kaynağı": source.get("button_source") or source.get("form_type"),
                "Motivasyon puanı": motivation.get("score"),
                "Müşteri takip durumu": row.get("follow_up_status"),
                "Takip notu": row.get("admin_notes"),
            }
        )
        for key, value in (row.get("property_features") or {}).items():
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
