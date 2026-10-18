"""Opt-in newsletter storage/delivery. Never reads or writes the leads collection.
Delivery defaults OFF. A verified contact and reviewed permission are both required.
"""
import asyncio, base64, hashlib, hmac, html, io, json, logging, math, os, re, secrets, smtplib, ssl, uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

FEED_URL='https://raw.githubusercontent.com/mkutayozturk/ckr-web-sitesi/main/content/housing-briefings.json'
ORIGIN='https://canakkalekonutrehberi.com'
NOTICE_VERSION='newsletter-2026-10-18.1'
TOPICS={'konut':'Konut','arsa':'Arsa','tarla':'Tarla','dukkan':'Dükkân / iş yeri','satis':'Satış adetleri','kira':'Kira artış oranları','mevzuat':'İmar / mevzuat / ihaleler','finansman':'Finansman'}
log=logging.getLogger(__name__)

def now():return datetime.now(timezone.utc)
def yes(key):return os.getenv(key,'false').lower()=='true'
def secret():return os.getenv('NEWSLETTER_TOKEN_SECRET') or os.getenv('ADMIN_JWT_SECRET')
def fingerprint(value):return hashlib.sha256(value.encode()).hexdigest()
def normalize(value):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD',str(value).lower().replace('ı','i')) if not unicodedata.combining(c)).strip()
def normalize_phone(value):
    digits=re.sub(r'\D','',value or '')
    if digits.startswith('90') and len(digits)==12:digits=digits[2:]
    elif digits.startswith('0') and len(digits)==11:digits=digits[1:]
    if not re.fullmatch(r'5\d{9}',digits):raise ValueError('Geçerli bir Türkiye cep telefonu girin.')
    return '+90'+digits

def email_ready():return bool(secret() and ((os.getenv('RESEND_API_KEY') and (os.getenv('NEWSLETTER_FROM_EMAIL') or os.getenv('SMTP_FROM'))) or all(os.getenv(k) for k in ('SMTP_HOST','SMTP_PORT','SMTP_FROM'))))
def whatsapp_ready():return bool(secret() and all(os.getenv(k) for k in ('WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_NEWSLETTER_TEMPLATE','WHATSAPP_GRAPH_VERSION')) and re.fullmatch(r'v\d+\.\d+',os.getenv('WHATSAPP_GRAPH_VERSION','')) and os.getenv('WHATSAPP_PHONE_NUMBER_ID','').isdigit())
def capabilities():return {'supported':True,'email_ready':email_ready(),'whatsapp_ready':whatsapp_ready(),'automatic_delivery_enabled':yes('NEWSLETTER_DELIVERY_ENABLED') and yes('NEWSLETTER_LEGAL_REVIEWED'),'notice_version':NOTICE_VERSION}

class Region(BaseModel):
    model_config=ConfigDict(extra='ignore')
    scope:str=Field(pattern='^(province|district|settlement)$')
    province:str='Çanakkale'
    province_code:str='17'
    district:str=Field(default='',max_length=100)
    district_code:str=Field(default='',max_length=30)
    settlement:str=Field(default='',max_length=140)
    settlement_code:str=Field(default='',max_length=40)
    settlement_type:str=Field(default='',max_length=60)
    label:str=Field(default='',max_length=260)
    @model_validator(mode='after')
    def local(self):
        if self.province_code!='17' or normalize(self.province)!='canakkale':raise ValueError('Yalnızca Çanakkale seçilebilir.')
        if self.scope!='province' and not self.district:raise ValueError('İlçe seçin.')
        if self.scope=='settlement' and not self.settlement:raise ValueError('Yerleşim seçin.')
        return self
class Preferences(BaseModel):
    model_config=ConfigDict(extra='forbid')
    topics:list[str]=Field(min_length=1,max_length=8)
    regions:list[Region]=Field(min_length=1,max_length=100)
    audience:list[str]=Field(default_factory=lambda:['seller','buyer','investor'],min_length=1,max_length=3)
    @model_validator(mode='after')
    def choices(self):
        if set(self.topics)-TOPICS.keys() or len(set(self.topics))!=len(self.topics):raise ValueError('Geçerli konular seçin.')
        if set(self.audience)-{'seller','buyer','investor'}:raise ValueError('Geçerli değerlendirme türü seçin.')
        if any(r.scope=='province' for r in self.regions) and len(self.regions)>1:raise ValueError('İl geneli seçimi diğer bölgelerle birlikte kullanılamaz.')
        return self
class Subscribe(Preferences):
    request_id:uuid.UUID
    name:str=Field(default='',max_length=120)
    channel:str=Field(pattern='^(email|whatsapp)$')
    email:EmailStr|None=None
    phone:str|None=Field(default=None,max_length=24)
    notice_presented:bool=False
    newsletter_consent:bool=False
    website:str=Field(default='',max_length=120) # honeypot
    @model_validator(mode='after')
    def contact(self):
        if not self.notice_presented or not self.newsletter_consent:raise ValueError('Bülten gönderim izni gereklidir.')
        if self.channel=='email' and not self.email:raise ValueError('E-posta girin.')
        if self.channel=='whatsapp':self.phone=normalize_phone(self.phone)
        return self
class TokenBody(BaseModel):token:str=Field(min_length=40,max_length=1500)
class ManageBody(TokenBody):preferences:Preferences
class Approval(BaseModel):
    approved:bool
    contact_verified:bool=False
    note:str=Field(min_length=10,max_length=1000)

def signed_token(row,purpose,days=365):
    key=secret()
    if not key:raise RuntimeError('Token anahtarı yapılandırılmadı')
    payload=base64.urlsafe_b64encode(json.dumps({'id':row['id'],'v':row['token_version'],'p':purpose,'exp':int((now()+timedelta(days=days)).timestamp())},separators=(',',':')).encode()).decode().rstrip('=')
    sig=hmac.new(key.encode(),payload.encode(),hashlib.sha256).hexdigest()
    return payload+'.'+sig

def verify_token(token,purpose):
    try:
        payload,sig=token.split('.')
        expected=hmac.new((secret() or '').encode(),payload.encode(),hashlib.sha256).hexdigest()
        data=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
        if not secret() or not hmac.compare_digest(sig,expected) or data['p']!=purpose or data['exp']<now().timestamp():raise ValueError()
        return data
    except Exception:raise HTTPException(401,'Bağlantı geçersiz veya süresi dolmuş.')

def official_item(item):
    try:
        u=urlparse(item['source_url']);host=u.hostname or ''
        return u.scheme=='https' and not u.username and not u.password and (host.endswith('.gov.tr') or host.endswith('.bel.tr')) and bool(set(item.get('topics',[]))&TOPICS.keys()) and bool(item.get('regions')) and item.get('category')!='Altyapı' and bool(item.get('body'))
    except Exception:return False

def region_matches(news,selected):
    for n in news:
        if str(n.get('province_code'))!='17':continue
        for s in selected:
            if s['scope']=='province' or n.get('scope')=='province':return True
            if normalize(n.get('district'))!=normalize(s.get('district')):continue
            if s['scope']=='district' or n.get('scope')=='district':return True
            if normalize(n.get('settlement'))==normalize(s.get('settlement')):return True
    return False

def select_items(feed,prefs,at=None):
    today=(at or now()).astimezone(ZoneInfo('Europe/Istanbul')).date().isoformat()
    return [i for i in feed.get('items',[]) if official_item(i) and i.get('expires_at','')>=today and set(i['topics'])&set(prefs['topics']) and region_matches(i['regions'],prefs['regions'])][:12]

def rental_rate(rows):
    monthly={r['period']:r for r in rows if r.get('scope')=='TR' and r.get('indicator')=='cpi' and re.fullmatch(r'\d{4}-\d{2}',r.get('period','')) and isinstance(r.get('value'),(int,float)) and math.isfinite(r['value']) and r['value']>0}
    for end in sorted(monthly,reverse=True):
        y,m=map(int,end.split('-'));index=y*12+m-1;months=[f'{n//12:04d}-{n%12+1:02d}' for n in range(index-23,index+1)]
        if not all(k in monthly for k in months):continue
        values=[monthly[k]['value'] for k in months];rate=round((sum(values[12:])/sum(values[:12])-1)*100,2);n=index+1
        return {'period':f'{n//12:04d}-{n%12+1:02d}','cpi_period':end,'rate':rate,'source_url':monthly[end]['source_url']}
    return None

def make_pdf(prefs,feed,rows):
    # Lazy imports ensure an optional PDF dependency cannot break customer endpoints.
    from reportlab.pdfgen import canvas
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.colors import HexColor
    font=Path(__file__).parent/'fonts/DejaVuSans.ttf'
    if 'CKR' not in pdfmetrics.getRegisteredFontNames():pdfmetrics.registerFont(TTFont('CKR',str(font)))
    styles=getSampleStyleSheet()
    for key in ['Normal','Title','Heading1','Heading2','Heading3']:styles[key].fontName='CKR'
    styles['Normal'].fontSize=10;styles['Normal'].leading=15;styles['Normal'].spaceAfter=9
    styles['Title'].fontSize=23;styles['Title'].leading=29;styles['Title'].textColor=HexColor('#102122')
    styles['Heading2'].fontSize=14;styles['Heading2'].leading=19;styles['Heading2'].textColor=HexColor('#887040');styles['Heading2'].spaceBefore=16
    out=io.BytesIO();doc=SimpleDocTemplate(out,pagesize=(595.28,841.89),rightMargin=45,leftMargin=45,topMargin=45,bottomMargin=48)
    parts=[]
    def p(text,style='Normal'):return Paragraph(html.escape(str(text)),styles[style])
    def source(url):
        if urlparse(url).scheme=='https':return Paragraph('<link href="'+html.escape(url,quote=True)+'" color="#887040">Resmî kaynağı incele</link>',styles['Normal'])
        return p('Kaynak bağlantısı bulunmuyor.')
    parts += [p('Çanakkale Konut Rehberi','Title'),p('Haftalık Gayrimenkul Bülteni','Heading2'),p('Hazırlanma: '+now().astimezone(ZoneInfo('Europe/Istanbul')).strftime('%d.%m.%Y')),
              p('Konular: '+', '.join(TOPICS[t] for t in prefs['topics'])),p('Bölgeler: '+' | '.join(r.get('label') or r.get('settlement') or r.get('district') or 'Çanakkale il geneli' for r in prefs['regions']))]
    if 'satis' in prefs['topics']:
        totals=[r for r in rows if r.get('indicator')=='sales_total' and r.get('scope')=='TR222']
        if totals:
            latest=max(totals,key=lambda r:r['period']);period=latest['period'];parts += [p('Konut satış adetleri - Çanakkale il geneli','Heading2'),p('Veri dönemi: '+period+' (ilçe veya köy bazında satış adedi değildir).')]
            for code,label in [('sales_total','Toplam'),('sales_second','İkinci el'),('sales_first','Yeni konut'),('sales_mortgage','İpotekli')]:
                r=next((r for r in rows if r.get('indicator')==code and r.get('scope')=='TR222' and r.get('period')==period),None)
                if r:
                    comparison=f" | Yıllık değişim: %{r['yoy']:.1f}" if isinstance(r.get('yoy'),(int,float)) else ''
                    parts.append(p(f"{label}: {r['value']:,.0f}".replace(',','.')+comparison.replace('.',',')))
            parts.append(source(latest['source_url']))
        else:parts.append(p('Doğrulanmış satış adedi bulunamadı; sayı tahmin edilmedi.'))
    if 'kira' in prefs['topics']:
        r=rental_rate(rows);parts.append(p('Kira artış oranı - Türkiye geneli referans','Heading2'))
        parts.append(p(f"{r['period']} yenilemeleri: %{r['rate']:.2f}".replace('.',',')+f" | TÜFE veri dönemi: {r['cpi_period']}." if r else 'Doğrulanmış kira artış oranı hesaplanamadı.'))
        if r:parts.extend([p('TÜFE endekslerinin 12 aylık ortalamalarına göre hesaplanan olağan yıllık yenileme referansıdır. Çanakkale’deki yeni kira fiyat artışı değildir; özel kira tespiti durumları ayrıca değerlendirilir.'),source(r['source_url'])])
    items=select_items(feed,prefs);parts.append(p('Seçtiğiniz konular ve bölgelerden gelişmeler','Heading2'))
    if not items:parts.append(p('Seçtiğiniz konular ve bölgeler için yayımlanmış güncel resmî haber bulunamadı. Bu durum bölgede hiç gelişme olmadığı anlamına gelmez.'))
    for i,item in enumerate(items,1):
        parts.extend([p(str(i)+'. '+item['title'],'Heading2'),p('Aşama: '+item['status']+' | Kaynak: '+item['source_name']),p('Yayın: '+(item.get('published_at') or 'Kaynakta belirtilmiyor')+' | Olay / planlanan tarih: '+item['event_date'])])
        parts.extend(p(t) for t in item['body']);parts.append(source(item['source_url']));parts.append(p('ÇKR değerlendirmesi - danışman yorumu','Heading3'))
        for key,label in [('seller','Satıcı açısından'),('buyer','Alıcı açısından'),('investor','Yatırımcı açısından')]:
            if key in prefs['audience']:parts.append(p(label+': '+item[key]))
    parts += [Spacer(1,16),p('M. Kutay Öztürk | Çanakkale Konut Rehberi'),p('Bülten yalnızca seçtiğiniz konuları kapsar. Haberler resmî kaynaklara; değerlendirmeler danışman yorumuna dayanır. Gelecekteki fiyat veya getiri garantisi verilmez.')]
    def page(c,document):
        c.setStrokeColor(HexColor('#c2a56c'));c.line(45,35,550,35);c.setFont('CKR',8);c.setFillColor(HexColor('#777777'));c.drawString(45,22,'canakkalekonutrehberi.com');c.drawRightString(550,22,str(document.page))
    doc.build(parts,onFirstPage=page,onLaterPages=page)
    return out.getvalue()

async def load_content(db):
    def get():
        response=requests.get(FEED_URL,timeout=12);response.raise_for_status()
        if len(response.content)>2_000_000:raise ValueError('Brifing dosyası çok büyük')
        data=response.json()
        if data.get('schema_version')!=1 or not isinstance(data.get('items'),list) or len(data['items'])>100:raise ValueError('Geçersiz brifing')
        data['items']=[i for i in data['items'] if official_item(i)]
        return data
    try:
        feed=await asyncio.to_thread(get)
        await db.newsletter_content.update_one({'_id':'feed'},{'$set':{'feed':feed,'checked_at':now()}},upsert=True)
    except Exception:
        saved=await db.newsletter_content.find_one({'_id':'feed'})
        if not saved:raise HTTPException(503,'Brifing kaynağına ulaşılamadı; PDF hazırlanmadı.')
        feed=saved['feed']
    groups=await db.market_publications.find({},{'_id':0}).to_list(4000)
    rows=[r for group in groups for r in group.get('observations',[])]
    return feed,rows

def send_email(to,subject,body,pdf=None,key=None):
    sender=os.getenv('NEWSLETTER_FROM_EMAIL') or os.getenv('SMTP_FROM')
    if not email_ready():raise RuntimeError('E-posta sağlayıcısı yapılandırılmadı')
    if os.getenv('RESEND_API_KEY'):
        payload={'from':sender,'to':[to],'subject':subject,'text':body}
        if pdf:payload['attachments']=[{'filename':'ckr-haftalik-bulten.pdf','content':base64.b64encode(pdf).decode()}]
        response=requests.post('https://api.resend.com/emails',json=payload,headers={'Authorization':'Bearer '+os.environ['RESEND_API_KEY'],'Idempotency-Key':key or str(uuid.uuid4())},timeout=15)
        response.raise_for_status();data=response.json()
        if not data.get('id'):raise RuntimeError('Sağlayıcı teslim kimliği dönmedi')
        return str(data['id'])
    msg=EmailMessage();msg['From']=sender;msg['To']=to;msg['Subject']=subject;msg.set_content(body)
    if pdf:msg.add_attachment(pdf,maintype='application',subtype='pdf',filename='ckr-haftalik-bulten.pdf')
    msg['Message-ID']='<'+fingerprint(key or str(uuid.uuid4()))+'@canakkalekonutrehberi.com>'
    port=int(os.getenv('SMTP_PORT','587'));host=os.environ['SMTP_HOST']
    with (smtplib.SMTP_SSL(host,port,timeout=15,context=ssl.create_default_context()) if port==465 else smtplib.SMTP(host,port,timeout=15)) as smtp:
        if port!=465:smtp.starttls(context=ssl.create_default_context())
        if os.getenv('SMTP_USERNAME'):smtp.login(os.environ['SMTP_USERNAME'],os.getenv('SMTP_PASSWORD',''))
        refused=smtp.send_message(msg)
        if refused:raise RuntimeError('Alıcı sağlayıcı tarafından kabul edilmedi')
    return msg['Message-ID']

def send_whatsapp(to,pdf_url,manage_url):
    if not whatsapp_ready():raise RuntimeError('WhatsApp sağlayıcısı yapılandırılmadı')
    # Approved marketing template: PDF document header; body placeholders = week, opt-out URL.
    data={'messaging_product':'whatsapp','to':to.lstrip('+'),'type':'template','template':{'name':os.environ['WHATSAPP_NEWSLETTER_TEMPLATE'],'language':{'code':os.getenv('WHATSAPP_TEMPLATE_LANGUAGE','tr')},'components':[{'type':'header','parameters':[{'type':'document','document':{'link':pdf_url,'filename':'ckr-haftalik-bulten.pdf'}}]},{'type':'body','parameters':[{'type':'text','text':now().astimezone(ZoneInfo('Europe/Istanbul')).strftime('%d.%m.%Y')},{'type':'text','text':manage_url}]}]}}
    response=requests.post('https://graph.facebook.com/'+os.environ['WHATSAPP_GRAPH_VERSION']+'/'+os.environ['WHATSAPP_PHONE_NUMBER_ID']+'/messages',json=data,headers={'Authorization':'Bearer '+os.environ['WHATSAPP_ACCESS_TOKEN']},timeout=15);response.raise_for_status()
    result=response.json()
    if not result.get('messages',[{}])[0].get('id'):raise RuntimeError('WhatsApp ileti kimliği dönmedi')
    return result['messages'][0]['id']

async def init_newsletter(db):
    await db.newsletter_subscribers.create_index('contact_key',unique=True)
    await db.newsletter_subscribers.create_index('request_id',unique=True)
    await db.newsletter_subscribers.create_index('expires_at',expireAfterSeconds=0)
    await db.newsletter_deliveries.create_index('expires_at',expireAfterSeconds=0)
    await db.newsletter_rate_limits.create_index('expires_at',expireAfterSeconds=0)
    await db.newsletter_deliveries.create_index('download_hash',sparse=True)

async def dispatch_due(db):
    caps=capabilities();local=now().astimezone(ZoneInfo('Europe/Istanbul'))
    if not caps['automatic_delivery_enabled'] or (local.weekday()==0 and local.hour<12):return {'enabled':caps['automatic_delivery_enabled'],'claimed':0}
    week=f'{local.isocalendar().year}-W{local.isocalendar().week:02d}'
    recipients=await db.newsletter_subscribers.find({'status':'active','contact_verified':True,'delivery_approved':True},{'_id':0}).to_list(10000)
    if not recipients:return {'enabled':True,'claimed':0}
    feed,rows=await load_content(db);claimed=0
    for sub in recipients:
        if not caps[sub['channel']+'_ready']:continue
        key=sub['id']+':'+week
        try:await db.newsletter_deliveries.insert_one({'_id':key,'subscriber_id':sub['id'],'week':week,'status':'preparing','created_at':now(),'expires_at':now()+timedelta(days=90)})
        except DuplicateKeyError:continue
        claimed+=1
        try:
            pdf=await asyncio.to_thread(make_pdf,sub['preferences'],feed,rows)
            manage=ORIGIN+'/bulten/#manage='+signed_token(sub,'manage')
            # Recheck withdrawal/approval just before dispatch.
            current=await db.newsletter_subscribers.find_one({'id':sub['id'],'status':'active','delivery_approved':True,'contact_verified':True})
            if not current:
                await db.newsletter_deliveries.update_one({'_id':key},{'$set':{'status':'cancelled'}});continue
            if sub['channel']=='email':
                await db.newsletter_deliveries.update_one({'_id':key},{'$set':{'status':'sending'}})
                provider_id=await asyncio.to_thread(send_email,sub['email'],'ÇKR Haftalık Gayrimenkul Bülteni','Seçtiğiniz konu ve bölgelere göre hazırladığımız PDF ektedir.\nTercihlerinizi değiştirmek veya bültenden ayrılmak için: '+manage,pdf,key)
            else:
                raw=secrets.token_urlsafe(32)
                await db.newsletter_deliveries.update_one({'_id':key},{'$set':{'status':'sending','pdf':pdf,'download_hash':fingerprint(raw),'download_expires_at':now()+timedelta(days=7)}})
                provider_id=await asyncio.to_thread(send_whatsapp,sub['phone'],'https://ckr-backend.onrender.com/api/newsletter/files/'+raw,manage)
            await db.newsletter_deliveries.update_one({'_id':key},{'$set':{'status':'provider_accepted','provider_id':provider_id,'accepted_at':now()}})
        except Exception:
            # A timeout may follow provider acceptance: never automatically resend an ambiguous delivery.
            await db.newsletter_deliveries.update_one({'_id':key},{'$set':{'status':'failed_or_unknown','error':'Hazırlama veya sağlayıcı yanıtı doğrulanamadı; otomatik tekrar gönderilmedi.'}})
            log.warning('Bülten gönderim durumu doğrulanamadı; kişisel veri veya token kayda yazılmadı')
    return {'enabled':True,'claimed':claimed}

async def newsletter_loop(db):
    while True:
        try:await dispatch_due(db)
        except Exception:log.warning('Bülten görevi tamamlanamadı; müşteri formları etkilenmedi')
        await asyncio.sleep(900)

def router_for(get_db,require_admin):
    router=APIRouter(prefix='/api',tags=['Newsletter'])
    @router.get('/newsletter/capabilities')
    async def caps():return capabilities()
    @router.post('/newsletter/subscribe',status_code=202)
    async def subscribe(body:Subscribe,request:Request):
        db=get_db();stamp=now()
        if body.website:return {'status':'received','message':'Talebiniz alındı.'}
        ip=request.client.host if request.client else 'unknown';rateid=fingerprint(ip+stamp.strftime('%Y-%m-%d-%H'))
        rate=await db.newsletter_rate_limits.find_one_and_update({'_id':rateid},{'$inc':{'count':1},'$setOnInsert':{'expires_at':stamp+timedelta(days=1)}},upsert=True,return_document=ReturnDocument.AFTER)
        if rate['count']>5:raise HTTPException(429,'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.')
        contact=str(body.email).lower() if body.channel=='email' else body.phone
        key=fingerprint(body.channel+':'+contact)
        row={'id':str(uuid.uuid4()),'request_id':str(body.request_id),'contact_key':key,'name':body.name.strip(),'channel':body.channel,'email':contact if body.channel=='email' else None,'phone':contact if body.channel=='whatsapp' else None,'preferences':{k:getattr(body,k) if k!='regions' else [r.model_dump() for r in body.regions] for k in ('topics','regions','audience')},'status':'pending_verification','contact_verified':False,'delivery_approved':False,'token_version':secrets.token_urlsafe(18),'created_at':stamp,'expires_at':stamp+timedelta(days=30),'consent':{'granted':True,'channel':body.channel,'at':stamp,'version':NOTICE_VERSION,'notice_presented_at':stamp,'source':'website-newsletter','text':'Seçtiğim konular ve bölgeler için haftalık ÇKR bültenini seçtiğim kanaldan almak istiyorum.'}}
        try:await db.newsletter_subscribers.insert_one(row)
        except DuplicateKeyError:return {'status':'received','message':'Talebiniz alındı. Mevcut aboneliklerin tercihleri yalnızca güvenli bağlantıyla değiştirilebilir.'}
        sent=False
        if body.channel=='email' and email_ready() and yes('NEWSLETTER_LEGAL_REVIEWED'):
            try:
                confirm=ORIGIN+'/bulten/#confirm='+signed_token(row,'confirm',7);manage=ORIGIN+'/bulten/#manage='+signed_token(row,'manage')
                await asyncio.to_thread(send_email,contact,'ÇKR bülten aboneliğinizi doğrulayın','Bu adres sizin ise abonelik isteğinizi doğrulayın: '+confirm+'\nBülten istemiyorsanız işlem yapmayın. İptal: '+manage,None,'confirmation:'+row['id']);sent=True
            except Exception:log.warning('Bülten doğrulama e-postası sağlayıcı tarafından doğrulanamadı')
        await db.newsletter_subscribers.update_one({'id':row['id']},{'$set':{'confirmation_status':'provider_accepted' if sent else 'not_sent'}})
        return {'status':'pending_verification','confirmation_sent':sent,'message':'Talebiniz kaydedildi. E-posta adresinize gönderilen bağlantıyla isteğinizi doğrulayın.' if sent else 'Bülten talebiniz kaydedildi. Gönderimler başlamadan önce iletişim ve izin doğrulaması tamamlanacak.'}
    async def owned(token,purpose='manage'):
        data=verify_token(token,purpose);row=await get_db().newsletter_subscribers.find_one({'id':data['id'],'token_version':data['v']})
        if not row:raise HTTPException(401,'Abonelik bağlantısı geçersiz.')
        return row
    @router.post('/newsletter/confirm')
    async def confirm(body:TokenBody):
        row=await owned(body.token,'confirm')
        if row['status']=='unsubscribed':raise HTTPException(409,'Bu abonelik iptal edildi.')
        await get_db().newsletter_subscribers.update_one({'id':row['id'],'status':{'$ne':'unsubscribed'}},{'$set':{'contact_verified':True,'verified_at':now(),'status':'pending_approval'}})
        return {'message':'Adresiniz doğrulandı. İzin kontrolü tamamlandığında aboneliğiniz etkinleşecek.'}
    @router.post('/newsletter/manage')
    async def manage(body:TokenBody):
        row=await owned(body.token)
        return {'status':row['status'],'channel':row['channel'],'preferences':row['preferences']}
    @router.patch('/newsletter/manage')
    async def preferences(body:ManageBody):
        row=await owned(body.token)
        if row['status']=='unsubscribed':raise HTTPException(409,'Abonelik iptal edildi.')
        await get_db().newsletter_subscribers.update_one({'id':row['id']},{'$set':{'preferences':body.preferences.model_dump(),'updated_at':now()}})
        return {'message':'Bülten tercihleriniz kaydedildi.'}
    @router.post('/newsletter/unsubscribe')
    async def unsubscribe(body:TokenBody):
        row=await owned(body.token)
        await get_db().newsletter_subscribers.update_one({'id':row['id']},{'$set':{'status':'unsubscribed','delivery_approved':False,'withdrawn_at':now(),'preferences':{'topics':[],'regions':[],'audience':[]},'expires_at':now()+timedelta(days=180)},'$unset':{'email':'','phone':'','name':''}})
        return {'message':'Bülten aboneliğiniz iptal edildi. Yeni gönderim yapılmayacak.'}
    @router.get('/newsletter/files/{token}')
    async def file(token:str):
        if not re.fullmatch(r'[A-Za-z0-9_-]{40,60}',token):raise HTTPException(404)
        row=await get_db().newsletter_deliveries.find_one({'download_hash':fingerprint(token),'download_expires_at':{'$gt':now()}})
        if not row or not row.get('pdf'):raise HTTPException(404,'Dosya bulunamadı veya bağlantının süresi doldu.')
        return Response(bytes(row['pdf']),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="ckr-haftalik-bulten.pdf"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'})
    @router.get('/admin/newsletter')
    async def admin_list(_:str=Depends(require_admin),skip:int=Query(0,ge=0),limit:int=Query(50,ge=1,le=100)):
        db=get_db();rows=await db.newsletter_subscribers.find({},{'_id':0,'contact_key':0,'token_version':0}).sort('created_at',-1).skip(skip).limit(limit).to_list(limit)
        deliveries=await db.newsletter_deliveries.find({},{'_id':0,'pdf':0,'download_hash':0}).sort('created_at',-1).limit(25).to_list(25)
        return {'items':rows,'total':await db.newsletter_subscribers.count_documents({}),'capabilities':capabilities(),'deliveries':deliveries}
    @router.patch('/admin/newsletter/{subscriber_id}')
    async def approve(subscriber_id:str,body:Approval,_:str=Depends(require_admin)):
        db=get_db();row=await db.newsletter_subscribers.find_one({'id':subscriber_id})
        if not row:raise HTTPException(404)
        if row['status']=='unsubscribed':raise HTTPException(409,'İptal edilmiş abonelik etkinleştirilemez; yeni izin alınmalıdır.')
        verified=row.get('contact_verified') or (row['channel']=='whatsapp' and body.contact_verified)
        if body.approved and not verified:raise HTTPException(409,'İletişim adresi doğrulanmadan gönderim onaylanamaz.')
        updates={'$set':{'contact_verified':bool(verified),'delivery_approved':body.approved,'approval_note':body.note,'approval_at':now(),'status':'active' if body.approved else 'paused'}}
        if verified:updates['$unset']={'expires_at':''}
        else:updates['$set']['expires_at']=now()+timedelta(days=30)
        await db.newsletter_subscribers.update_one({'id':row['id']},updates)
        return {'message':'Abonelik izin durumu güncellendi.'}
    @router.post('/admin/newsletter/{subscriber_id}/resend-confirmation')
    async def resend(subscriber_id:str,_:str=Depends(require_admin)):
        db=get_db();row=await db.newsletter_subscribers.find_one({'id':subscriber_id})
        if not row or row['channel']!='email' or row.get('contact_verified') or row['status']=='unsubscribed':raise HTTPException(409,'Bu kayıt için doğrulama gönderilemez.')
        if not email_ready() or not yes('NEWSLETTER_LEGAL_REVIEWED'):raise HTTPException(503,'E-posta sağlayıcısı, token anahtarı veya izin/aktarım kontrolü henüz hazır değil.')
        claimed=await db.newsletter_subscribers.find_one_and_update({'id':subscriber_id,'$or':[{'confirmation_attempt_at':{'$exists':False}},{'confirmation_attempt_at':{'$lt':now()-timedelta(hours=24)}}]},{'$set':{'confirmation_attempt_at':now()}},return_document=ReturnDocument.AFTER)
        if not claimed:raise HTTPException(429,'Doğrulama iletisi için 24 saat bekleyin.')
        confirm=ORIGIN+'/bulten/#confirm='+signed_token(row,'confirm',7)
        manage=ORIGIN+'/bulten/#manage='+signed_token(row,'manage')
        try:await asyncio.to_thread(send_email,row['email'],'ÇKR bülten aboneliğinizi doğrulayın','Abonelik isteğinizi doğrulayın: '+confirm+'\nİptal bağlantısı: '+manage,None,'confirmation:'+row['id']+':'+now().date().isoformat())
        except Exception:raise HTTPException(502,'Sağlayıcı yanıtı doğrulanamadı; gönderildi olarak işaretlenmedi.')
        await db.newsletter_subscribers.update_one({'id':subscriber_id},{'$set':{'confirmation_status':'provider_accepted'}})
        return {'message':'Doğrulama iletisi sağlayıcı tarafından kabul edildi.'}
    @router.get('/admin/newsletter/{subscriber_id}/preview.pdf')
    async def preview(subscriber_id:str,_:str=Depends(require_admin)):
        row=await get_db().newsletter_subscribers.find_one({'id':subscriber_id})
        if not row:raise HTTPException(404)
        feed,rows=await load_content(get_db());pdf=await asyncio.to_thread(make_pdf,row['preferences'],feed,rows)
        return Response(pdf,media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="ckr-bulten-onizleme.pdf"','Cache-Control':'no-store'})
    @router.post('/admin/newsletter/dispatch')
    async def dispatch(_:str=Depends(require_admin)):return await dispatch_due(get_db())
    return router
