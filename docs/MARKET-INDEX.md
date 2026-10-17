# ÇKR piyasa endeksi — 17 Ekim 2026

## Kapsam
Yeni `backend/market.py` yalnızca `market_*` koleksiyonlarını kullanır. Müşteri modelleri, motivasyon algoritması, formlar, bildirim ve lead endpointleri değiştirilmez. Mevcut JWT/HTTPBearer `require_admin` bağımlılığı paylaşılır. Güncel Sites frontend kaynakları esastır; GitHub frontend kopyalanmaz.

## Günlük kontrol
GitHub Actions `.github/workflows/market-index.yml` görevi varsayılan `main` dalında günlük 11:30 Europe/Istanbul saatinde `GET https://ckr-backend.onrender.com/api/market/index` çağırır. Bu endpoint yalnızca sabit TÜİK/TCMB kaynaklarının sunucu tarafı adaptörlerini arka planda başlatır; müşteri verisi veya dışarıdan URL kabul etmez. Kaynak başına MongoDB lease, işlemler arasında en az 20 saat ve en fazla 10 dakika çalışma kilidi kullanır. Kaynaklar bağımsız çalışır. Render uyuyor olsa da HTTP çağrısı uyandırabilir; HTTP/API erişimi ve ağ sağlayıcıları kesintisiz çalışma garantisi vermez. Tekrarlanan kontrol yeni gözlem veya revizyon üretmez. Yönetici kontrolü 20 saat sınırını aşabilir fakat aktif işlem kilidini aşamaz.

ChatGPT üzerinde yeni görev oluşturma 5 aktif görev sınırına takıldığı için mevcut görevler değiştirilmeden GitHub zamanlaması seçildi. GitHub public depoda 60 gün etkinlik olmadığında zamanlamayı durdurabilir; Actions durumunu izleyin ve gerektiğinde yeniden etkinleştirin. Görev kaydı, ilk gerçek çalıştırma ve sonraki başarılı kontrol ayrı kanıtlardır. Görev oluşturulamadıysa otomatik güncelleniyor denmez. Normal sayfa ziyaretleri de süresi gelmiş kontrolü tetikler. Backend/API hatasında frontend son doğrulanmış sürümlü snapshot'ı gösterir ve kullanıcıya durumu bildirir. Günlük görev kaynak repo dosyalarını veya frontend'i yeniden yayımlamaz; MongoDB önbelleğini günceller.

## Kaynaklar
- TÜİK `TR,DF_SATIS_SEKLI_DURUMU_ILILCE_V3,1.0` CSV: `MII_KSS`, aylık, TR222. Türkiye tam 81 il satırının toplamıdır; eksik il sıfır sayılmaz.
- TCMB EVDS3 kamuya açık rapor isteği: `TP.KFE.TR`, `TP.KFE.TR22`, `TP.YKKE.TR`, `TP.YKKE.TR22`, aylık frekans 5.
- TCMB `TP.BIRIMFIYAT.CANAKKALE`, çeyreklik frekans 6. Banka ekspertiz m² ortalamasıdır, işlem/mahalle fiyatı değildir.
- TÜİK genel TÜFE `TR,DF_TUFE_SDMX_TT09,1.0`: `F_TFE`, `SINIFLAMA_DUZEYI=TUFE`, `COICOP_2018=0`. Mevsimden arındırılmış TT05 kullanılmaz.

Her kayıtta dönem, kapsam, kaynak URL/hash, mevcutsa yayım tarihi, son başarılı kontrol ve doğrulama yöntemi saklanır. Makine tarafından okunamayan yayım tarihi `null` tutulur ve arayüzde açıkça belirtilir. Yeni dönemlerin yayım tarihi tahmin edilmez. Eski dönem karşılaştırması yoksa yüzde de boştur. İlk el + ikinci el = toplam; ipotekli ayrı sınıflamadır. Reel değişim `(1+nominal/100)/(1+TÜFE/100)-1`; yalnızca aynı dönem kullanılır.

17 Ekim resmî CSV, Eylül 2025 Çanakkale verilerini 1376 toplam, 897 ikinci el, 479 ilk el, 170 ipotekli olarak döndürdü. Kullanıcının ilk taslak rakamları yerine güncel kaynak kullanıldı. Eylül 2026 1143/652/491/142. Genel TÜFE %29,73 yıllık / %1,84 aylık.

## MongoDB
- `market_observations`: benzersiz `indicator:scope:period`; son doğrulanmış gözlem.
- `market_publications`: kapsam+dönem başına atomik yayın; kullanıcıya ilk el/ikinci el/toplamın karışık sürümleri gösterilmez.
- `market_revisions`: değişen gözlemin önceki/sonraki değerleri, artan sürüm, aktör ve kayıt zamanı. Tarihsel veri silinmez.
- `market_jobs`: sağlayıcı lease, deneme/başarı/hata bilgisi.
- `market_errors`: kaynak hataları.
- `market_imports`: yönetici dosya önizlemesi ve yayımlama onayı.

## Yönetici alternatifi
`/admin` → Endeks Verileri. Mevcut giriş ve Bearer token gerekir. CSV şablonu indirilebilir. UTF-8 CSV veya XLSX, en fazla 2 MB / 1000 satır. Önizleme tek başına yayın değildir; başlangıçta işaretsiz onay ve Yayımla gerekir. Satış toplamları mevcut diğer kayıtlarla birlikte de doğrulanır. Aynı içe aktarma tekrar yayımlanmaz. Yeni kaynak/şema değişirse son veri korunur, hata gösterilir ve bu yol kullanılabilir.

Alanlar: `indicator,scope,period,value,previous_year,previous_month,yoy,mom,source,source_url,published_at,note`.
Kodlar: sales_total/sales_first/sales_second/sales_mortgage/kfe/rent/cpi/appraisal. Kapsam TR222/TR22/TR. Dönem YYYY-MM; ekspertiz YYYY-Qn. Ondalık ayırıcı nokta, binlik ayırıcı yok. Kaynak TÜİK veya TCMB ve aynı resmî kurum HTTPS bağlantısı gerekir. Önceki değer mevcutsa yüzdeler sunucuda yeniden hesaplanır.

## Test ve yayın
Frontend: `CI=true npm test -- --watchAll=false --runInBand`, `CI=true npm run build`, `npm run verify:seo`.
Backend: `python -m pytest tests -q`. İzole koleksiyonlar kullanılır; gerçek müşteri kaydı/e-posta gönderilmez. Gerçek Mongo testleri ortam yoksa atlanır.
Backend `market.py`, `market_seed.json`, server entegrasyonu ve testler GitHub `sync/sites-current-2026-10-08` dalına birlikte aktarılır. Render otomatik deploy ardından canlı public GET ve yönetici 401 kontrol edilir. Canlı yönetici parola erişimi yoksa CSV yayınını gerçek admin oturumuyla test edilmiş saymayın.

## Uygulama doğrulama kaydı
17 Ekim 2026: Frontend 51 test, backend 16 test ve 2 alt test başarılı; 2 gerçek Mongo müşteri entegrasyon testi ortam olmadığı için atlandı. Üretim build ve statik SEO kontrolleri başarılı. Canlı backend 595 gözlem döndürdü; beş sağlayıcının tamamı status=ok ve başarılı kontrol tarihi kaydetti. Yönetici kaynak endpointi tokensız 401 döndürdü. Ana sayfa, yeni blog, kapak görseli ve /admin/ doğrudan HTTP 200 verdi. Gerçek yönetici oturumunda dosya yayımlama ve gerçek tarayıcıda görsel mobil/masaüstü inceleme yapılmadı.

Başlıca değişen dosyalar: backend/market.py, backend/market_seed.json, backend/server.py; frontend/src/components/ckr/MarketIndex.jsx, MarketIndex.css, MarketChart.jsx, MarketAdmin.jsx, AdminPanel.jsx; frontend/src/lib/api.js, marketIndex.js; frontend/src/data/market-index-snapshot.json; yeni blog JSON/WebP; testler; bu belge ve .github/workflows/market-index.yml.

Günlük görev: main dalında cron 08:30 UTC = 11:30 Türkiye. Düzeltilmiş ilk bulut çalışması başarılı: https://github.com/mkutayozturk/ckr-web-sitesi/actions/runs/39031967792 . Aktif kaynak SHA: 4c850054c28bc33d14e8a58c569eb04e04d856a3.
