"""Project application tests: isolated storage, no production writes or real mail."""
import copy
from types import SimpleNamespace
from io import BytesIO
import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from tests.test_readiness_api import Leads, Cursor
from backend import server

class ProjectCursor(Cursor):
    def skip(self,n): self.rows=self.rows[n:];return self
    def limit(self,n): self.rows=self.rows[:n];return self

class ProjectLeads(Leads):
    def matches(self, row, query):
        return all(row.get(k) in v['$in'] if isinstance(v, dict) and '$in' in v else row.get(k) == v for k,v in query.items())
    async def find_one_and_update(self, query, changes):
        for row in self.rows:
            if self.matches(row,query):
                old=copy.deepcopy(row);row.update(changes['$set']);return old
    def find(self, query, *args): return ProjectCursor([r for r in self.rows if self.matches(r, query)])
    async def count_documents(self,query): return sum(self.matches(r,query) for r in self.rows)

@pytest.fixture
def project_api(monkeypatch):
    from unittest.mock import AsyncMock
    monkeypatch.setattr(server,'init_market',AsyncMock())
    leads=ProjectLeads()
    monkeypatch.setattr(server,'db',SimpleNamespace(leads=leads))
    monkeypatch.setattr(server,'send_email_sync',lambda *args: True)
    server.request_log.clear()
    with TestClient(server.app, raise_server_exceptions=True) as api:
        yield api,leads

# Skip startup's real DB indexes: this client intentionally never enters lifespan.
@pytest.fixture(autouse=True)
def isolated_lifecycle(monkeypatch):
    from unittest.mock import AsyncMock
    monkeypatch.setattr(server,'ensure_indexes',AsyncMock())
    monkeypatch.setattr(server,'delete_expired_drafts',AsyncMock())
    monkeypatch.setattr(server,'client',SimpleNamespace(close=lambda:None))

def payload():
    return dict(application_id='project-isolated-1',project_access_token='isolated-secure-access-token-1234567890',request_type='konut_projesi_talebi',property_type='Villa',contact={'name':'Test Müşteri','phone':'+90 530 111 22 33'},location={'mode':'multiple','province':'Çanakkale','districts':['Merkez','Biga'],'selections':[{'scope':'district','district':'Merkez','label':'Merkez ilçesinin tamamı'},{'scope':'settlement','district':'Biga','settlement':'Akyaprak','label':'Akyaprak Köyü'}]},property_features={'Satın alma amacı':'Yatırım','Konut türü':'Villa','Proje özellikleri':'Güvenlik → Açık havuz','Öncelik sırası':'Güvenlik → Açık havuz → Teras','Tercih edilen vade':'36 ay','Toplam geri ödeme sınırı (TL)':'10000000'},budget_expectation='8000000 TL',timing='1–3 ay içinde',kvkk_notice_presented=True,kvkk_acknowledged=False,marketing_consent=False)

def test_project_draft_recovery_update_completion_notification_and_excel(project_api):
    api,store=project_api;p=payload()
    first=api.post('/api/leads/draft',json=p);assert first.status_code==201,first.text
    body=first.json();assert 'project_access_token' not in body
    headers={'X-CKR-Draft-Token':p['project_access_token']}
    assert api.post('/api/leads/draft',json=p).json()['id']==body['id']
    bad={**p,'project_access_token':'different-secure-token-1234567890123456'}
    assert api.post('/api/leads/draft',json=bad).status_code==409
    assert api.get('/api/leads/project-isolated-1/project-status').status_code==403
    p['property_features']['Minimum net metrekare']='150'
    assert api.patch('/api/leads/project-isolated-1/draft',json=p,headers=headers).status_code==200
    assert api.patch('/api/leads/project-isolated-1/complete',json=p,headers=headers).status_code==200
    assert api.get('/api/leads/project-isolated-1/project-status',headers=headers).json()['email_notification_status']=='sent'
    assert api.patch('/api/leads/project-isolated-1/complete',json=p,headers=headers).status_code==200
    assert len(store.rows)==1
    assert store.rows[0]['property_features']['Minimum net metrekare']=='150'
    token=api.post('/api/admin/login',json={'password':'test-only-admin'}).json()['access_token']
    listed=api.get('/api/admin/leads?request_type=konut_projesi_talebi',headers={'Authorization':'Bearer '+token})
    assert listed.status_code==200,listed.text
    assert listed.json()['total']==1
    assert listed.json()['items'][0]['request_type']=='konut_projesi_talebi'
    assert api.get('/api/admin/leads/export.xlsx?request_type=konut_projesi_talebi').status_code==401
    export=api.get('/api/admin/leads/export.xlsx?request_type=konut_projesi_talebi',headers={'Authorization':'Bearer '+token})
    assert export.status_code==200,export.text
    wb=load_workbook(BytesIO(export.content));headers_row=[c.value for c in wb['Müşteri Başvuruları'][1]]
    assert 'Proje tercihleri' in headers_row
    assert '150' in wb['Müşteri Başvuruları'].cell(2,headers_row.index('Proje tercihleri')+1).value
    assert len(store.rows[0]['location']['selections'])==2

def test_project_mail_failure_retry_keeps_record(project_api,monkeypatch):
    api,store=project_api;p=payload();headers={'X-CKR-Draft-Token':p['project_access_token']}
    monkeypatch.setattr(server,'send_email_sync',lambda *args:False)
    assert api.post('/api/leads/draft',json=p).status_code==201
    api.patch('/api/leads/project-isolated-1/complete',json=p,headers=headers)
    assert store.rows[0]['email_notification_status']=='not_configured'
    monkeypatch.setattr(server,'send_email_sync',lambda *args:True)
    assert api.post('/api/leads/project-isolated-1/project-notification',headers=headers).status_code==200
    assert store.rows[0]['email_notification_status']=='sent'
    assert len(store.rows)==1

def test_project_invalid_phone_and_missing_notice(project_api):
    api,_=project_api;p=payload();p['contact']['phone']='02121112233'
    assert api.post('/api/leads/draft',json=p).status_code==422
    p=payload();p['kvkk_notice_presented']=False
    assert api.post('/api/leads/draft',json=p).status_code==400
