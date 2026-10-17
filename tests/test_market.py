"""Isolated official-statistics tests; no network or customer records."""
import asyncio,copy,json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from backend import market

class Cursor:
    def __init__(self,rows):self.rows=rows
    def sort(self,*args):return self
    async def to_list(self,*args):return copy.deepcopy(self.rows)
class Collection:
    def __init__(self):self.rows=[]
    async def create_index(self,*args,**kwargs):pass
    async def bulk_write(self,operations):
        for op in operations:await self.update_one(op._filter,op._doc,op._upsert)
    def match(self,r,q):
        return all((r.get(k) in v['$in'] if isinstance(v,dict) and '$in' in v else r.get(k)==v) for k,v in q.items())
    def find(self,q,*args):return Cursor([r for r in self.rows if self.match(r,q)])
    async def find_one(self,q,*args):return next((copy.deepcopy(r) for r in self.rows if self.match(r,q)),None)
    async def insert_one(self,r):self.rows.append(copy.deepcopy(r))
    async def update_one(self,q,op,upsert=False):
        row=next((r for r in self.rows if self.match(r,q)),None)
        if row is None:
            if not upsert:return
            row=copy.deepcopy(q);self.rows.append(row);row.update(copy.deepcopy(op.get('$setOnInsert',{})))
        row.update(copy.deepcopy(op.get('$set',{})))
    async def find_one_and_update(self,q,op,**kw):
        await self.update_one({'_id':q['_id']},op,True)
        return await self.find_one({'_id':q['_id']})

def db():return SimpleNamespace(**{n:Collection() for n in ['market_observations','market_publications','market_revisions','market_jobs','market_errors','market_imports']})
def sample(**kw):return dict(indicator='kfe',scope='TR22',period='2026-09',value=120,previous_year=100,source='TCMB',source_url=market.TCMB_PAGE,**kw)
def test_official_snapshot_integrity_and_actual_comparisons():
    rows=market.validate_batch(json.loads(Path(market.__file__).with_name('market_seed.json').read_text())['observations'])
    get=lambda i,s,p:next(r for r in rows if (r['indicator'],r['scope'],r['period'])==(i,s,p))
    assert get('sales_total','TR222','2026-09')['value']==1143
    assert get('sales_total','TR222','2025-09')['value']==1376
    assert get('sales_second','TR222','2025-09')['value']==897
    assert get('cpi','TR','2026-09')['yoy']==pytest.approx(29.73,abs=.01)
    assert get('appraisal','TR222','2026-Q3')['value']==54269
    assert len({r['period'] for r in rows if r['indicator']=='sales_total' and r['scope']=='TR222'})>=36

def test_rejects_bad_sources_scope_future_nan_and_sales_sums():
    for changes in [{'source_url':'https://evil.example/data'},{'scope':'TR222'},{'period':'2099-01'},{'value':float('nan')},{'published_at':'tomorrow'}]:
        with pytest.raises(ValueError):market.validate_batch([{**sample(),**changes}])
    rows=[dict(indicator='sales_'+k,scope='TR222',period='2026-09',value=v,source='TÜİK',source_url=market.TUIK_PAGE) for k,v in [('total',10),('first',7),('second',4)]]
    with pytest.raises(ValueError):market.validate_batch(rows)

def test_quarter_parser_and_real_formula():
    rows=market.parse_evds({'items':[{'Tarih':'2025-3Ç','TP_BIRIMFIYAT_CANAKKALE':100},{'Tarih':'2026-3Ç','TP_BIRIMFIYAT_CANAKKALE':120}]},'appraisal',['TP.BIRIMFIYAT.CANAKKALE'],'hash')
    assert rows[-1]['period']=='2026-Q3' and rows[-1]['yoy']==20
    assert market.real_change(20,30)==pytest.approx(-7.6923)

def test_revisions_idempotency_atomic_publication_and_partial_validation():
    async def run():
        store=db()
        assert await market.save_records(store,[sample()],'test')==1
        assert await market.save_records(store,[sample()],'test')==0
        assert await market.save_records(store,[{**sample(),'value':125}],'test')==1
        assert len(store.market_observations.rows)==1
        assert len(store.market_revisions.rows)==2
        assert store.market_revisions.rows[-1]['before']['value']==120
        assert store.market_publications.rows[0]['observations'][0]['value']==125
        sales=[dict(indicator='sales_'+k,scope='TR222',period='2026-09',value=v,source='TÜİK',source_url=market.TUIK_PAGE) for k,v in [('total',10),('first',7),('second',3)]]
        await market.save_records(store,sales,'test')
        with pytest.raises(ValueError):await market.save_records(store,[{**sales[1],'value':9}],'test')
        assert next(r for r in store.market_observations.rows if r['indicator']=='sales_first')['value']==7
    asyncio.run(run())

def test_independent_provider_failure_preserves_data(monkeypatch):
    def fail():raise ValueError('source unavailable')
    monkeypatch.setattr(market,'PROVIDERS',{'failure':fail,'success':lambda:[sample()]})
    store=db();asyncio.run(market.refresh_all(store))
    assert len(store.market_errors.rows)==1 and len(store.market_observations.rows)==1
    assert {r['status'] for r in store.market_jobs.rows}=={'ok','error'}

def test_admin_auth_import_preview_confirm_publish_and_public_read(monkeypatch):
    store=db()
    async def auth():raise HTTPException(401,'Token required')
    app=FastAPI();app.include_router(market.router_for(lambda:store,auth))
    monkeypatch.setattr(market,'refresh_all',AsyncMock())
    api=TestClient(app)
    for method,path in [('get','/api/admin/market/status'),('post','/api/admin/market/check'),('post','/api/admin/market/import'),('post','/api/admin/market/import/nope/publish')]:assert getattr(api,method)(path).status_code==401
    async def allowed():return 'admin'
    app.dependency_overrides[auth]=allowed
    csv='indicator,scope,period,value,previous_year,source,source_url\nkfe,TR22,2026-09,120,100,TCMB,https://www.tcmb.gov.tr/\n'
    preview=api.post('/api/admin/market/import',files={'file':('official.csv',csv,'text/csv')})
    assert preview.status_code==200,preview.text
    assert not store.market_observations.rows
    path='/api/admin/market/import/'+preview.json()['id']+'/publish'
    assert api.post(path,json={'confirmed':False}).status_code==400
    assert api.post(path,json={'confirmed':True}).json()['changed']==1
    assert api.post(path,json={'confirmed':True}).json()['changed']==0
    public=api.get('/api/market/index').json();assert public['observations'][0]['yoy']==20
    assert store.market_observations.rows[0]['verification']=='admin_review'


def test_startup_seed_is_idempotent_and_preserves_preexisting_values():
    async def run():
        store=db();await market.save_records(store,[sample()],'test')
        await market.init_market(store);first=len(store.market_observations.rows)
        await market.init_market(store)
        assert len(store.market_observations.rows)==first==595
        existing=await store.market_observations.find_one({'key':'kfe:TR22:2026-09'})
        assert existing['value']==120
        assert len({r['key'] for r in store.market_publications.rows})==len(store.market_publications.rows)
    asyncio.run(run())
