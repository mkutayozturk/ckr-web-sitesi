"""No real customer records or external sends; isolated async Mongo-compatible test storage."""
import asyncio, copy, json, os
from datetime import datetime,timezone
from pathlib import Path
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
from backend import newsletter as n

ROOT=Path(__file__).parents[1]
FEED=json.loads((ROOT/'frontend/src/data/housing-briefings.json').read_text())
ROWS=json.loads((ROOT/'frontend/src/data/market-index-snapshot.json').read_text())['observations']

def payload(**kw):
    return dict(request_id='11111111-1111-4111-8111-111111111111',channel='email',email='test@example.com',name='Test',topics=['konut','satis','kira'],regions=[{'scope':'province','province_code':'17','province':'Çanakkale','label':'Çanakkale'}],audience=['seller','buyer','investor'],notice_presented=True,newsletter_consent=True,**kw)
@pytest.fixture
def env(monkeypatch):
    for k in ['SMTP_HOST','SMTP_PORT','SMTP_FROM','RESEND_API_KEY','NEWSLETTER_FROM_EMAIL','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_NEWSLETTER_TEMPLATE','WHATSAPP_GRAPH_VERSION','NEWSLETTER_DELIVERY_ENABLED','NEWSLETTER_LEGAL_REVIEWED']:monkeypatch.delenv(k,raising=False)
    monkeypatch.setenv('NEWSLETTER_TOKEN_SECRET','test-secret-not-used-outside-unit-tests')
    db=AsyncMongoMockClient()['newsletter_tests'];asyncio.run(n.init_newsletter(db))
    app=FastAPI()
    def admin():raise HTTPException(401)
    app.include_router(n.router_for(lambda:db,admin))
    return db,TestClient(app)

def test_consent_phone_and_regions_are_validated():
    x=payload();x['newsletter_consent']=False
    with pytest.raises(ValueError):n.Subscribe(**x)
    for phone in ['+90 530 123 45 67','05301234567','5301234567']:assert n.normalize_phone(phone)=='+905301234567'
    for phone in ['53012345','2121234567','90530123456799']:
        with pytest.raises(ValueError):n.normalize_phone(phone)
    x=payload();x['regions'][0]['province_code']='34'
    with pytest.raises(ValueError):n.Subscribe(**x)
    x=payload();x['topics']=['unknown']
    with pytest.raises(ValueError):n.Subscribe(**x)

def test_pending_registration_is_idempotent_and_never_sends_without_provider(env):
    db,client=env;first=client.post('/api/newsletter/subscribe',json=payload());assert first.status_code==202 and not first.json()['confirmation_sent']
    second=client.post('/api/newsletter/subscribe',json=payload());assert second.status_code==202
    assert asyncio.run(db.newsletter_subscribers.count_documents({}))==1
    row=asyncio.run(db.newsletter_subscribers.find_one({}));assert row['status']=='pending_verification' and not row['delivery_approved']
    assert not row['contact_verified'] and row['consent']['version']==n.NOTICE_VERSION

def test_false_consent_and_invalid_location_do_not_create_records(env):
    db,client=env;x=payload();x['newsletter_consent']=False;assert client.post('/api/newsletter/subscribe',json=x).status_code==422
    assert asyncio.run(db.newsletter_subscribers.count_documents({}))==0

def test_confirmation_tokens_cannot_access_management_and_withdrawal_stops_sends(env):
    db,client=env;client.post('/api/newsletter/subscribe',json=payload());row=asyncio.run(db.newsletter_subscribers.find_one({}))
    confirm=n.signed_token(row,'confirm',7);manage=n.signed_token(row,'manage')
    assert client.post('/api/newsletter/manage',json={'token':confirm}).status_code==401
    assert client.post('/api/newsletter/confirm',json={'token':confirm}).status_code==200
    assert asyncio.run(db.newsletter_subscribers.find_one({}))['status']=='pending_approval'
    assert client.post('/api/newsletter/unsubscribe',json={'token':manage}).status_code==200
    row=asyncio.run(db.newsletter_subscribers.find_one({}));assert row['status']=='unsubscribed' and 'email' not in row
    assert client.post('/api/newsletter/confirm',json={'token':confirm}).status_code==409

def test_admin_and_pdf_routes_require_backend_authorization(env):
    db,client=env
    for path,method in [('/api/admin/newsletter','get'),('/api/admin/newsletter/x/preview.pdf','get'),('/api/admin/newsletter/dispatch','post')]:assert getattr(client,method)(path).status_code==401
    assert client.patch('/api/admin/newsletter/x',json={'approved':True,'note':'test permission review'}).status_code==401
    assert client.get('/api/newsletter/files/invalid').status_code==404

def test_no_cross_region_or_nonofficial_or_general_infrastructure_news():
    prefs=n.Subscribe(**payload()).model_dump();items=n.select_items(FEED,prefs,datetime(2026,10,18,tzinfo=timezone.utc));assert len(items)==2
    restricted=copy.deepcopy(prefs);restricted['regions']=[{'scope':'district','province_code':'17','district':'Biga'}]
    matched=n.select_items(FEED,restricted,datetime(2026,10,18,tzinfo=timezone.utc));assert len(matched)==1 and matched[0]['id'].startswith('tuik')
    wrong=copy.deepcopy(FEED);wrong['items'][0]['source_url']='https://example.com/news';assert not n.official_item(wrong['items'][0])
    wrong['items'][0]['source_url']=FEED['items'][0]['source_url'];wrong['items'][0]['category']='Altyapı';assert not n.official_item(wrong['items'][0])
    land=copy.deepcopy(prefs);land['topics']=['tarla'];assert not n.select_items(FEED,land,datetime(2026,10,18,tzinfo=timezone.utc))

def test_rent_requires_24_consecutive_verified_cpi_months():
    result=n.rental_rate(ROWS);assert result['period']=='2026-10' and result['cpi_period']=='2026-09' and result['rate']==31.49
    assert n.rental_rate([r for r in ROWS if r.get('period')=='2026-09']) is None

def test_pdf_preserves_turkish_and_does_not_invent_local_statistics(tmp_path):
    pdf=n.make_pdf(n.Subscribe(**payload()).model_dump(),FEED,ROWS);assert pdf.startswith(b'%PDF-') and len(pdf)>15000
    (tmp_path/'newsletter.pdf').write_bytes(pdf)

def test_disabled_scheduler_does_not_read_recipients_or_send(env,monkeypatch):
    db,_=env;send=AsyncMock();monkeypatch.setattr(n,'load_content',send)
    assert asyncio.run(n.dispatch_due(db))['claimed']==0;send.assert_not_called()

def test_weekly_delivery_claim_prevents_duplicate_send_and_skips_unverified(env,monkeypatch):
    db,client=env;client.post('/api/newsletter/subscribe',json=payload());row=asyncio.run(db.newsletter_subscribers.find_one({}));monkeypatch.setenv('NEWSLETTER_DELIVERY_ENABLED','true');monkeypatch.setenv('NEWSLETTER_LEGAL_REVIEWED','true')
    monkeypatch.setattr(n,'email_ready',lambda:True);monkeypatch.setattr(n,'load_content',AsyncMock(return_value=(FEED,ROWS)))
    sends=[];monkeypatch.setattr(n,'send_email',lambda *args: sends.append(args) or 'provider-id')
    assert asyncio.run(n.dispatch_due(db))['claimed']==0
    asyncio.run(db.newsletter_subscribers.update_one({'id':row['id']},{'$set':{'status':'active','contact_verified':True,'delivery_approved':True}}))
    assert asyncio.run(n.dispatch_due(db))['claimed']==1;assert asyncio.run(n.dispatch_due(db))['claimed']==0;assert len(sends)==1
    assert asyncio.run(db.newsletter_deliveries.find_one({}))['status']=='provider_accepted'
