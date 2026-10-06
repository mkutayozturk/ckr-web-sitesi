// Mock data for Çanakkale Konut Rehberi (ÇKR)
// All content is placeholder/sample data for the frontend-only build.

export const brand = {
  name: 'Çanakkale Konut Rehberi',
  short: 'ÇKR',
  person: 'M. Kutay Öztürk',
  location: 'Çanakkale',
  tagline: 'İlan ezberiyle değil; piyasa gerçekleriyle konut kararı.',
};

export const navLinks = [
  { label: 'Piyasa Endeksi', href: '#piyasa' },
  { label: 'Rehber', href: '#rehber' },
  { label: 'Ben Kimim', href: '#ben-kimim' },
  { label: 'İhtiyaç Analizi', href: '#analiz' },
  { label: 'Danışmanlık', href: '#danismanlik' },
  { label: 'İletişim', href: '#iletisim' },
];

// Piyasa endeksi — aylara göre veri. Ay butonları bu veriyi değiştirir.
export const marketMonths = [
  {
    id: 'haziran-2026',
    month: 'Haziran',
    year: '2026',
    status: 'Dengeli',
    statusNote: 'Piyasa alıcı ve satıcı arasında dengeli',
    totalSales: '1120',
    salesIpoteksiz: '905',
    salesIpotekli: '215',
    rentIncrease: '%29,40',
  },
  {
    id: 'temmuz-2026',
    month: 'Temmuz',
    year: '2026',
    status: 'Alıcıya Dönüyor',
    statusNote: 'Talep yavaşlıyor, piyasa alıcı lehine dönüyor',
    totalSales: '1185',
    salesIpoteksiz: '960',
    salesIpotekli: '225',
    rentIncrease: '%30,85',
  },
  {
    id: 'agustos-2026',
    month: 'Ağustos',
    year: '2026',
    status: 'Alıcı Lehine',
    statusNote: 'Piyasa şu an alıcı lehine',
    totalSales: '1248',
    salesIpoteksiz: '1018',
    salesIpotekli: '230',
    rentIncrease: '%31,79',
  },
];

export const testimonials = [
  {
    name: 'Ayşe K.',
    role: 'Alıcı',
    text: 'İlan fiyatlarına takılıp kalmıştım. Kutay Bey satılabilir fiyatın ne olduğunu net anlattı, doğru bütçeyle doğru evi aldık.',
  },
  {
    name: 'Mehmet D.',
    role: 'Satıcı',
    text: 'Evimi aylarca satamadım. ÇKR ile gerçekçi fiyatı konuşunca iki haftada ciddi alıcı buldum. Ezber değil, veri konuştu.',
  },
  {
    name: 'Selin A.',
    role: 'Kiraya Veren',
    text: 'Kira potansiyelini gerçek piyasaya göre belirledik. Boş kalma riskini azaltan net bir yol haritası çıkardı.',
  },
  {
    name: 'Onur T.',
    role: 'Kiracı',
    text: 'Bütçeme ve ihtiyacıma göre bölge önerisi aldım. Acele ettirmeden, doğru soruları sorarak karar vermemi sağladı.',
  },
];

export const blogPosts = [
  {
    title: 'İlan fiyatı ile satılabilir fiyat neden aynı değildir?',
    excerpt: 'İlanda yazan rakam bir temennidir. Satılabilir fiyat ise alıcının gerçekten ilgi gösterdiği, teklif verdiği seviyedir.',
    tag: 'Satıcı Rehberi',
    image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwzfHxhcGFydG1lbnQlMjBpbnRlcmlvcnxlbnwwfHx8fDE3OTEyOTA2NjJ8MA&ixlib=rb-4.1.0&q=85',
    read: '5 dk',
  },
  {
    title: 'Alıcı piyasasında fiyatı kim belirler?',
    excerpt: 'Alıcı piyasasında fiyatı satıcının beklentisi değil, talebin yoğunluğu belirler. Doğru okunduğunda avantaja dönüşür.',
    tag: 'Alıcı Rehberi',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxob3VzZSUyMGtleXN8ZW58MHx8fHwxNzkxMjkwNjYyfDA&ixlib=rb-4.1.0&q=85',
    read: '4 dk',
  },
  {
    title: 'Çanakkale\'de bölge seçimi: bütçe mi, yaşam mı?',
    excerpt: 'Doğru bölge; sadece fiyatla değil, ulaşım, kira potansiyeli ve uzun vadeli değer artışıyla birlikte değerlendirilmelidir.',
    tag: 'Bölge Rehberi',
    image: 'https://images.unsplash.com/photo-1448630360428-65456885c650?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHw0fHxyZXNpZGVudGlhbCUyMGJ1aWxkaW5nfGVufDB8fHx8MTc5MTI5MDY2Mnww&ixlib=rb-4.1.0&q=85',
    read: '6 dk',
  },
];

export const consultancySteps = [
  {
    no: '01',
    title: 'İhtiyaç Analizi',
    desc: 'Alıcı, satıcı, kiracı veya kiraya veren olarak hedefinizi, bütçenizi ve beklentinizi netleştiriyoruz.',
  },
  {
    no: '02',
    title: 'Piyasa Okuması',
    desc: 'Bölge, satılabilir fiyat ve kira potansiyelini güncel ÇKR verileriyle birlikte değerlendiriyoruz.',
  },
  {
    no: '03',
    title: 'Karar Zemini',
    desc: 'İlan ezberi yerine; gerçeklerle beslenen, size özel bir karar zemini oluşturuyoruz.',
  },
  {
    no: '04',
    title: 'Yönlendirme',
    desc: 'Sürecin her adımında, doğru zamanda doğru hamleyi yapmanız için yanınızda oluyoruz.',
  },
];

export const aboutText = {
  portrait: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
  paragraphs: [
    'Merhaba, ben M. Kutay Öztürk. Çanakkale\'de alıcı, satıcı, kiracı ve kiraya verenlere; ilan ezberiyle değil, piyasa gerçekleriyle karar rehberliği sunuyorum.',
    'Benim işim size ev beğendirmek değil; doğru soruları sorarak, bütçeniz ve ihtiyacınızla örtüşen sağlam bir karar zemini oluşturmak. İlan fiyatı ile satılabilir fiyat arasındaki farkı net göstermek, bu işin özüdür.',
    'ÇKR; bölge, bütçe, satılabilir fiyat ve kira potansiyelini birlikte okur. Böylece acele değil, bilinçli kararlar verirsiniz.',
  ],
  highlights: [
    { value: '12+', label: 'Yıl saha tecrübesi' },
    { value: '%100', label: 'Gerçek piyasa verisi' },
    { value: 'Çanakkale', label: 'Odaklı bölge uzmanlığı' },
  ],
};

// Melis asistan — kural tabanlı akış
export const melis = {
  name: 'Melis',
  role: 'ÇKR Dijital Asistanı',
  greeting: 'Merhaba, ben Melis. Size doğru yönlendirmeyi yapabilmem için durumunuzu seçer misiniz?',
  disclaimer: 'Melis, ÇKR\'nin dijital yardımcı asistanıdır.',
  options: [
    { key: 'alici', label: 'Ev almak istiyorum', target: 'alici', reply: 'Harika! Doğru evi doğru fiyata bulmak için kısa bir Alıcı İhtiyaç Analizi yapalım. Formu sizin için açıyorum.' },
    { key: 'satici', label: 'Evimi satmak istiyorum', target: 'satici', reply: 'Satılabilir fiyatı net konuşalım. Satıcı İhtiyaç Analizi formunu açıyorum, birkaç soruyla başlıyoruz.' },
    { key: 'kiraya-veren', label: 'Evimi kiraya vermek istiyorum', target: 'kiraya-veren', reply: 'Kira potansiyelinizi gerçek piyasaya göre belirleyelim. Kiraya Veren analizini açıyorum.' },
    { key: 'kiralayan', label: 'Kiralık ev arıyorum', target: 'kiralayan', reply: 'Bütçe ve ihtiyacınıza göre bölge önerelim. Kiralayan İhtiyaç Analizini açıyorum.' },
  ],
};
