import os
import uuid
from io import BytesIO

import pytest
from openpyxl import load_workbook
from pymongo import MongoClient


MONGO_TEST_URL = os.environ.get("MONGO_TEST_URL")


def require_mongo():
    if not MONGO_TEST_URL:
        pytest.skip("MONGO_TEST_URL tanımlı değil; gerçek MongoDB testi atlandı.")
    client = MongoClient(MONGO_TEST_URL, serverSelectionTimeoutMS=1200)
    try:
        client.server_info()
    except Exception as exc:
        pytest.skip(f"Gerçek MongoDB bağlantısı yok: {exc}")
    return client


@pytest.fixture()
def api_client():
    mongo_client = require_mongo()
    db_name = f"ckr_test_{uuid.uuid4().hex}"
    os.environ["MONGO_URL"] = MONGO_TEST_URL
    os.environ["DB_NAME"] = db_name
    os.environ["ADMIN_PASSWORD"] = "test-admin"
    os.environ["ADMIN_JWT_SECRET"] = "test-secret"

    from backend import server
    from fastapi.testclient import TestClient

    with TestClient(server.app) as client:
        yield client

    mongo_client.drop_database(db_name)


def lead_payload(phone="0530 111 22 33"):
    return {
        "request_type": "seller",
        "property_type": "Daire",
        "location": {"district": "Merkez", "neighborhood": "Barbaros", "raw": "Barbaros"},
        "property_features": {"metrekare": "120", "oda": "3+1"},
        "price_expectation": "8.000.000 TL",
        "timing": "Yüksek",
        "contact": {"name": "Test Müşteri", "phone": phone, "email": "test@example.com"},
        "source": {"form_type": "satici", "button_source": "test"},
        "motivation": {"answers": {"aciliyet": 80}, "score": 80, "category": "Yüksek", "summary": "Test özeti"},
        "started_at": "2026-10-08T12:00:00+00:00",
    }


def test_lead_create_admin_update_and_export(api_client):
    created = api_client.post("/api/leads", json=lead_payload())
    assert created.status_code == 201
    lead = created.json()
    assert lead["follow_up_status"] == "new"
    assert lead["motivation"]["score"] == 80

    duplicate = api_client.post("/api/leads", json=lead_payload())
    assert duplicate.status_code == 409

    unauthorized = api_client.get("/api/admin/leads")
    assert unauthorized.status_code == 401

    login = api_client.post("/api/admin/login", json={"password": "test-admin"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    listed = api_client.get("/api/admin/leads", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    updated = api_client.patch(
        f"/api/admin/leads/{lead['id']}",
        headers=headers,
        json={"follow_up_status": "contacted", "admin_notes": "Arandı, tekrar görüşülecek."},
    )
    assert updated.status_code == 200
    assert updated.json()["follow_up_status"] == "contacted"
    assert updated.json()["admin_notes"] == "Arandı, tekrar görüşülecek."

    exported = api_client.get("/api/admin/leads/export.xlsx", headers=headers)
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    workbook = load_workbook(BytesIO(exported.content))
    assert "Müşteri Başvuruları" in workbook.sheetnames
    sheet = workbook["Müşteri Başvuruları"]
    headers_row = [cell.value for cell in sheet[1]]
    assert "Ad soyad" in headers_row
    assert sheet["B2"].value == "Test Müşteri"
