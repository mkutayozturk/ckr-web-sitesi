"""Public official-statistics cache. Does not access or modify customer records.
All network adapters use fixed official URLs. No caller-supplied URL is fetched.
"""
import asyncio, csv, hashlib, io, json, math, re, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Literal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field, model_validator
from pymongo import ReturnDocument, UpdateOne
from pymongo.errors import DuplicateKeyError

TUIK_CSV='https://databrowser2.tuik.gov.tr/api/core/nodes/1/datasets/TR,DF_SATIS_SEKLI_DURUMU_ILILCE_V3,1.0/download/csv'
TUIK_PAGE='https://veriportali.tuik.gov.tr/tr/databrowser/tuik/categories/9/9_4/TR,DF_SATIS_SEKLI_DURUMU_ILILCE_V3,1.0'
TCMB_PAGE='https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb%2Btr/main%2Bmenu/istatistikler/reel%2Bsektor%2Bistatistikleri/konut%2Bfiyat%2Bendeksi'
EVDS='https://evds3.tcmb.gov.tr/igmevdsms-dis/fe'
MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
def now(): return datetime.now(timezone.utc).isoformat()
def change(value, previous): return round((value/previous-1)*100,4) if value is not None and previous not in (None,0) else None
def real_change(nominal, inflation): return round(((1+nominal/100)/(1+inflation/100)-1)*100,4)
def offset(period,n):
    y,m=map(int,period.split('-'));v=y*12+m-1+n;return f'{v//12:04d}-{v%12+1:02d}'

def download(url, payload=None):
    req=urllib.request.Request(url,data=payload,headers={'Content-Type':'application/json','User-Agent':'CKR-Official-Statistics/1.0'})
    with urllib.request.urlopen(req,timeout=50) as r:
        raw=r.read(60*1024*1024+1)
    if len(raw)>60*1024*1024: raise ValueError('Resmî kaynak dosyası boyut sınırını aştı.')
    return raw

class Observation(BaseModel):
    indicator: Literal['sales_total','sales_first','sales_second','sales_mortgage','kfe','rent','cpi','appraisal']
    scope: Literal['TR222','TR22','TR']
    period: str
    value: Optional[float]=None
    yoy: Optional[float]=None
    mom: Optional[float]=None
    previous_year: Optional[float]=None
    previous_month: Optional[float]=None
    source: Literal['TÜİK','TCMB']
    source_url: str
    source_hash: Optional[str]=None
    published_at: Optional[str]=None
    last_successful_check_at: Optional[str]=None
    verification: Literal['official_adapter','admin_review']='official_adapter'
    note: Optional[str]=None
    @model_validator(mode='after')
    def check(self):
        if not re.fullmatch(r'\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])',self.period):raise ValueError('Geçersiz veri dönemi.')
        if 'Q' in self.period and f'{self.period[:4]}-{int(self.period[-1])*3:02d}' >= now()[:7]:raise ValueError('Henüz tamamlanmamış çeyrek kabul edilmez.')
        if self.period[:4] > now()[:4] or ('Q' not in self.period and self.period >= now()[:7]):raise ValueError('Yayımlanmamış dönem kabul edilmez.')
        for key in ['value','yoy','mom','previous_year','previous_month']:
            v=getattr(self,key)
            if v is not None and not math.isfinite(v):raise ValueError('Sonlu sayısal değer gerekli.')
        if self.value is None and self.yoy is None:raise ValueError('Değer veya doğrulanmış değişim gerekli.')
        if self.value is not None and self.value<0:raise ValueError('Negatif düzey kabul edilmez.')
        if self.indicator.startswith('sales_'):
            if self.source!='TÜİK' or self.scope not in ['TR222','TR'] or self.value is None or self.value!=int(self.value):raise ValueError('Satış sayısı, kapsamı veya kaynağı geçersiz.')
        elif self.indicator=='appraisal':
            if self.scope!='TR222' or self.source!='TCMB' or 'Q' not in self.period:raise ValueError('Ekspertiz il ve çeyrek kapsamındadır.')
        elif self.indicator=='cpi':
            if self.scope!='TR' or self.source!='TÜİK':raise ValueError('TÜFE Türkiye kapsamındadır.')
        elif self.scope not in ['TR22','TR'] or self.source!='TCMB':raise ValueError('Fiyat/kira endeksi bölgesel veya Türkiye kapsamındadır.')
        if self.published_at:
            datetime.fromisoformat(self.published_at)
            if self.published_at[:10]>now()[:10]:raise ValueError('Gelecek yayım tarihi kabul edilmez.')
        from urllib.parse import urlparse
        host=urlparse(self.source_url).hostname or ''
        expected='tuik.gov.tr' if self.source=='TÜİK' else 'tcmb.gov.tr'
        if urlparse(self.source_url).scheme!='https' or not (host==expected or host.endswith('.'+expected)):raise ValueError('Resmî kaynak bağlantısı gerekli.')
        if self.previous_year is not None and self.value is not None:
            self.yoy=change(self.value,self.previous_year)
        if self.previous_month is not None and self.value is not None:
            self.mom=change(self.value,self.previous_month)
        return self
    def record(self):
        d=self.model_dump();d['key']=':'.join([self.indicator,self.scope,self.period]);d['last_successful_check_at']=self.last_successful_check_at or now();return d

def validate_batch(records):
    rows=[Observation.model_validate(r).record() for r in records]
    if len({r['key'] for r in rows})!=len(rows):raise ValueError('Aynı gösterge/dönem iki kez gönderildi.')
    groups={}
    for r in rows:
        if r['indicator'].startswith('sales_'):groups.setdefault((r['scope'],r['period']),{})[r['indicator']]=r['value']
    for key,g in groups.items():
        if all(k in g for k in ['sales_total','sales_first','sales_second']) and g['sales_total']!=g['sales_first']+g['sales_second']:raise ValueError(f'İlk el + ikinci el toplamla eşit değil: {key}')
        if 'sales_mortgage' in g and 'sales_total' in g and g['sales_mortgage']>g['sales_total']:raise ValueError('İpotekli satış toplamdan fazla olamaz.')
    return rows

def parse_tuik(raw):
    buckets={}; members={}; digest=hashlib.sha256(raw).hexdigest()
    fields={'_T':('sales_total','2'),'1':('sales_mortgage','2'),'2':('sales_first','3'),'3':('sales_second','3')}
    for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
        p=row['TIME_PERIOD'];area=row['REF_AREA'];kind=row['SATIS_TURU']
        if row['FREQ']!='M' or row['INDICATOR']!='MII_KSS' or kind not in fields or len(area)!=5 or not re.fullmatch(r'\d{4}-\d{2}',p) or p<'2023-01' or p>=now()[:7] or row['KONUT_ISYERI_GSTERGE']!=fields[kind][1]:continue
        value=float(row['OBS_VALUE']);indicator=fields[kind][0]
        members.setdefault((p,indicator),{})[area]=value
        if area=='TR222':buckets[(p,indicator,'TR222')]=value
    for (p,indicator),areas in members.items():
        if len(areas)!=81:continue  # Never infer zero for an absent province; omit this aggregate.
        buckets[(p,indicator,'TR')]=sum(areas.values())
    result=[]
    for (p,indicator,scope),value in buckets.items():
        result.append(dict(indicator=indicator,scope=scope,period=p,value=value,previous_year=buckets.get((offset(p,-12),indicator,scope)),previous_month=buckets.get((offset(p,-1),indicator,scope)),source='TÜİK',source_url=TUIK_PAGE,source_hash=digest,published_at='2026-10-16' if p=='2026-09' else None,note='Türkiye verisi resmî tablodaki 81 il toplamından hesaplandı.' if scope=='TR' else None))
    if not result:raise ValueError('Çanakkale konut satışı satırları bulunamadı.')
    return validate_batch(result)

def fetch_tuik(): return parse_tuik(download(TUIK_CSV,b'[]'))

# Public EVDS report request, exactly the series/frequency contract used by EVDS3.
def fetch_evds(indicator):
    series={'kfe':['TP.KFE.TR','TP.KFE.TR22'],'rent':['TP.YKKE.TR','TP.YKKE.TR22'],'appraisal':['TP.BIRIMFIYAT.CANAKKALE']}[indicator]
    payload=dict(type='json',series='-'.join(series),aggregationTypes='-'.join(['avg']*len(series)),formulas='-'.join(['0']*len(series)),startDate='01-01-2023',endDate=datetime.now().strftime('%d-%m-%Y'),frequency='6' if indicator=='appraisal' else '5',decimalSeperator='.',decimal='4',dateFormat='0',lang='tr',ozelFormuller=[],groupSeperator=False,isRaporSayfasi=True)
    raw=download(EVDS,json.dumps(payload).encode());data=json.loads(raw)
    return parse_evds(data,indicator,series,hashlib.sha256(raw).hexdigest())

def parse_evds(data,indicator,series,digest):
    # The adapter fails closed on schema changes; a manual reviewed import remains available.
    items=data.get('items') if isinstance(data,dict) else None
    if not isinstance(items,list):raise ValueError('EVDS veri şeması doğrulanamadı; son veri korundu.')
    points={}
    for item in items:
        date=str(item.get('Tarih',''))
        if re.fullmatch(r'\d{4}-\d{2}',date):p=date
        elif re.fullmatch(r'\d{4}-Q[1-4]',date):p=date
        elif re.fullmatch(r'\d{4}-[1-4]Ç',date):p=date[:5]+'Q'+date[5]
        else:continue
        for code in series:
            val=item.get(code.replace('.','_'))
            if val in (None,'','null'):continue
            points[(p,code)]=float(str(val).replace(',','.'))
    rows=[]
    for (p,code),value in points.items():
        scope='TR222' if indicator=='appraisal' else 'TR22' if code.endswith('TR22') else 'TR'
        prior=f'{int(p[:4])-1}{p[4:]}'
        rows.append(dict(indicator=indicator,scope=scope,period=p,value=value,previous_year=points.get((prior,code)),previous_month=points.get((offset(p,-1),code)) if 'Q' not in p else None,source='TCMB',source_url=TCMB_PAGE,source_hash=digest))
    if not rows:raise ValueError('EVDS gözlem satırları okunamadı; son veri korundu.')
    return validate_batch(rows)

TUIK_CPI='https://databrowser2.tuik.gov.tr/api/core/nodes/1/datasets/TR,DF_TUFE_SDMX_TT09,1.0/download/csv'
def parse_cpi(raw):
    points={};digest=hashlib.sha256(raw).hexdigest()
    for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
        p=row['TIME_PERIOD']
        if row['REF_AREA']=='TR' and row['FREQ']=='M' and row['SINIFLAMA_DUZEYI']=='TUFE' and row['COICOP_2018']=='0' and row['INDICATOR']=='F_TFE' and row['DEGISIM']=='1' and re.fullmatch(r'\d{4}-\d{2}',p) and '2023-01'<=p<now()[:7]:
            value=float(row['OBS_VALUE'])
            if p in points and points[p]!=value:raise ValueError('TÜFE tablosunda çelişen dönem bulundu.')
            points[p]=value
    if not points:raise ValueError('Genel TÜFE endeksi bulunamadı.')
    return validate_batch([dict(indicator='cpi',scope='TR',period=p,value=v,previous_year=points.get(offset(p,-12)),previous_month=points.get(offset(p,-1)),source='TÜİK',source_url=TUIK_CPI,source_hash=digest,published_at='2026-10-05' if p=='2026-09' else None) for p,v in points.items()])

def fetch_cpi():return parse_cpi(download(TUIK_CPI,b'[]'))

PROVIDERS={'tuik_sales':fetch_tuik,'tcmb_kfe':lambda:fetch_evds('kfe'),'tcmb_rent':lambda:fetch_evds('rent'),'tcmb_appraisal':lambda:fetch_evds('appraisal'),'tuik_cpi':fetch_cpi}

async def save_records(db,records,actor):
    rows=validate_batch(records)
    # Validate against cached counterparts too, so partial manual imports cannot break sums.
    related=await db.market_observations.find({'period':{'$in':list({r['period'] for r in rows})}},{'_id':0}).to_list(10000)
    merged={r['key']:r for r in related};merged.update({r['key']:r for r in rows});validate_batch(list(merged.values()))
    changed=0
    for row in rows:
        old=await db.market_observations.find_one({'key':row['key']},{'_id':0})
        comparable=lambda r:{k:v for k,v in r.items() if k not in ['last_successful_check_at','revision','updated_at','key','source_hash']}
        if old and comparable(old)==comparable(row):
            await db.market_observations.update_one({'key':row['key']},{'$set':{'last_successful_check_at':row['last_successful_check_at']}});continue
        revision=(old or {}).get('revision',0)+1;row.update(revision=revision,updated_at=now())
        await db.market_revisions.insert_one({'key':row['key'],'revision':revision,'before':old,'after':row,'actor':actor,'recorded_at':now()})
        await db.market_observations.update_one({'key':row['key']},{'$set':row},upsert=True);changed+=1
    await publish_groups(db,rows)
    return changed

async def publish_groups(db,changed_rows,initial=False):
    for scope,period in {(r['scope'],r['period']) for r in changed_rows}:
        group=await db.market_observations.find({'scope':scope,'period':period},{'_id':0}).to_list(100)
        valid=validate_batch(group)
        # One atomic Mongo document keeps first/second/total consistent during publication.
        operation='$setOnInsert' if initial else '$set'
        await db.market_publications.update_one({'key':scope+':'+period},{operation:{'observations':valid,'published_at':now()}},upsert=True)

async def refresh_provider(db,name,force=False):
    # Database-backed lease, shared by all Render processes. Public reads cannot force refresh.
    stamp=now();cutoff=(datetime.now(timezone.utc)-timedelta(hours=20)).isoformat()
    query={'_id':name,'$or':[{'last_attempt_at':{'$lt':cutoff}},{'last_attempt_at':{'$exists':False}}]}
    if force:query={'_id':name,'$or':[{'running_until':{'$lt':stamp}},{'running_until':{'$exists':False}}]}
    lease={'provider':name,'last_attempt_at':stamp,'running_until':(datetime.now(timezone.utc)+timedelta(minutes=10)).isoformat()}
    try:claimed=await db.market_jobs.find_one_and_update(query,{'$set':lease},upsert=True,return_document=ReturnDocument.AFTER)
    except DuplicateKeyError:return
    if not claimed:return
    try:
        records=await asyncio.to_thread(PROVIDERS[name]);changed=await save_records(db,records,'official_adapter:'+name)
        await db.market_jobs.update_one({'_id':name},{'$set':{'status':'ok','last_successful_check_at':now(),'changed':changed,'error':None,'running_until':stamp}})
    except Exception as exc:
        error=type(exc).__name__+': '+str(exc)[:250]
        await db.market_jobs.update_one({'_id':name},{'$set':{'status':'error','error':error,'running_until':stamp}})
        await db.market_errors.insert_one({'provider':name,'checked_at':now(),'error':error})

async def refresh_all(db,force=False):
    await asyncio.gather(*(refresh_provider(db,name,force) for name in PROVIDERS))

async def init_market(db):
    await db.market_publications.create_index('key',unique=True)
    await db.market_observations.create_index('key',unique=True)
    await db.market_revisions.create_index([('key',1),('revision',1)],unique=True)
    seed=Path(__file__).with_name('market_seed.json')
    if seed.exists():
        seed_rows=validate_batch(json.loads(seed.read_text())['observations'])
        await db.market_observations.bulk_write([UpdateOne({'key':r['key']},{'$setOnInsert':dict(r,revision=1,updated_at=now())},upsert=True) for r in seed_rows])
        current=await db.market_observations.find({},{'_id':0}).to_list(10000)
        groups={}
        for r in current:groups.setdefault(r['scope']+':'+r['period'],[]).append(r)
        await db.market_publications.bulk_write([UpdateOne({'key':k},{'$setOnInsert':{'observations':validate_batch(group),'published_at':now()}},upsert=True) for k,group in groups.items()])

class ImportReview(BaseModel):
    confirmed: bool=False


def router_for(get_db,require_admin):
    router=APIRouter()
    @router.get('/api/market/index')
    async def public_index(background_tasks:BackgroundTasks):
        db=get_db();background_tasks.add_task(refresh_all,db)
        groups=await db.market_publications.find({},{'_id':0}).to_list(4000)
        rows=sorted([r for g in groups for r in g['observations']],key=lambda r:r['period'])
        jobs=await db.market_jobs.find({},{'_id':0}).to_list(20)
        # Provider IDs are public metadata, while customer collections remain untouched.
        return {'observations':rows,'checks':jobs,'checked_at':now(),'automation':{'trigger':'daily_cloud_read','last_successful_check_at':max([j.get('last_successful_check_at','') for j in jobs],default=None)}}
    @router.get('/api/admin/market/status')
    async def status(_:str=Depends(require_admin)):
        db=get_db()
        return {'jobs':await db.market_jobs.find({}).to_list(20),'errors':await db.market_errors.find({},{'_id':0}).sort('checked_at',-1).to_list(20),'revisions':await db.market_revisions.find({},{'_id':0}).sort('recorded_at',-1).to_list(30)}
    @router.post('/api/admin/market/check')
    async def manual_check(background_tasks:BackgroundTasks,_:str=Depends(require_admin)):
        background_tasks.add_task(refresh_all,get_db(),True);return {'status':'scheduled'}
    @router.post('/api/admin/market/import')
    async def import_file(file:UploadFile=File(...),_:str=Depends(require_admin)):
        raw=await file.read(2*1024*1024+1)
        if len(raw)>2*1024*1024:raise HTTPException(413,'Dosya en fazla 2 MB olabilir.')
        try:
            if (file.filename or '').lower().endswith('.csv'):records=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
            elif (file.filename or '').lower().endswith('.xlsx'):
                import pandas as pd
                records=pd.read_excel(io.BytesIO(raw)).astype(object).where(lambda x:x.notna(),None).to_dict('records')
            else:raise ValueError('CSV veya XLSX gerekli.')
            if not records or len(records)>1000:raise ValueError('1–1000 satır gerekli.')
            for row in records:
                row.pop('key',None);row['verification']='admin_review'
                for key in ['value','yoy','mom','previous_year','previous_month']:
                    if row.get(key) in ('',None):row[key]=None
                for key in ['published_at','note','source_hash']:
                    if row.get(key)=='':row[key]=None
            rows=validate_batch(records)
        except Exception as exc:raise HTTPException(422,str(exc)[:400])
        import uuid
        iid=str(uuid.uuid4());await get_db().market_imports.insert_one({'id':iid,'rows':rows,'created_at':now(),'published':False})
        return {'id':iid,'rows':rows,'message':'Yalnızca önizleme: henüz yayımlanmadı.'}
    @router.post('/api/admin/market/import/{iid}/publish')
    async def publish(iid:str,review:ImportReview,_:str=Depends(require_admin)):
        if not review.confirmed:raise HTTPException(400,'Kaynağı ve değerleri doğrulayıp onaylayın.')
        doc=await get_db().market_imports.find_one({'id':iid})
        if not doc:raise HTTPException(404,'İçe aktarma bulunamadı.')
        if doc.get('published'):return {'changed':0,'message':'Bu içe aktarma zaten yayımlandı.'}
        try:changed=await save_records(get_db(),doc['rows'],'admin_review')
        except ValueError as exc:raise HTTPException(422,str(exc))
        await get_db().market_imports.update_one({'id':iid},{'$set':{'published':True,'published_at':now()}})
        return {'changed':changed,'message':'Onaylı veriler yayımlandı.'}
    return router
