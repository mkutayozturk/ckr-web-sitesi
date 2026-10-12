import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { useForms } from '../../context/FormsContext';
import { buildMessage, openWhatsApp } from '../../lib/whatsapp';
import { completeLeadDraft, createLead, createLeadDraft, updateLeadDraft, updateLeadPreference } from '../../lib/api';
import useReveal from '../../hooks/useReveal';
import LocationSelector from './LocationSelector';

const tabs = [
  { key: 'alici', label: 'Alıcı' },
  { key: 'satici', label: 'Satıcı' },
  { key: 'kiraya-veren', label: 'Kiraya Veren' },
  { key: 'kiralayan', label: 'Kiralayan' },
];

const formMeta = {
  alici: {
    title: 'Alıcı İhtiyaç Analizi',
    intro: 'Doğru evi doğru fiyata bulabilmemiz için ihtiyacınızı netleştirelim.',
    requestType: 'buyer',
    seeker: true,
    sale: true,
    priceName: 'butce',
    priceLabel: 'Satın Alma Bütçesi',
    priceUnit: 'Milyon TL',
    timingLabel: 'Ne zaman satın almak istiyorsunuz?',
  },
  satici: {
    title: 'Satıcı İhtiyaç Analizi',
    intro: 'Satılabilir fiyatı ve doğru stratejiyi birlikte belirleyelim.',
    requestType: 'seller',
    seeker: false,
    sale: true,
    priceName: 'ilanFiyat',
    priceLabel: 'Beklenen Satış Bedeli',
    priceUnit: 'Milyon TL',
    timingLabel: 'Ne zaman satmak istiyorsunuz?',
  },
  'kiraya-veren': {
    title: 'Kiraya Veren İhtiyaç Analizi',
    intro: 'Kira potansiyelinizi gerçek piyasaya göre belirleyelim.',
    requestType: 'landlord',
    seeker: false,
    sale: false,
    priceName: 'beklenenKira',
    priceLabel: 'Beklenen Aylık Kira',
    priceUnit: 'TL / Ay',
    timingLabel: 'Ne zaman kiraya vermek istiyorsunuz?',
  },
  kiralayan: {
    title: 'Kiralayan İhtiyaç Analizi',
    intro: 'Bütçe ve ihtiyacınıza göre doğru bölgeyi önerelim.',
    requestType: 'tenant',
    seeker: true,
    sale: false,
    priceName: 'butce',
    priceLabel: 'Aylık Kira Bütçesi',
    priceUnit: 'TL / Ay',
    timingLabel: 'Ne zaman kiralamak istiyorsunuz?',
  },
};

const propertyTypeOptions = ['Tek Kat Daire', 'Dubleks Daire', 'Tripleks Daire', 'Tek Kat Villa', 'Dubleks Villa', 'Tripleks Villa', 'Komple Bina', 'Arsa', 'Tarla'];
const roomOptions = ['1+0', '1+1', '2+1', '3+1', '3+2', '4+1', '4+2', '5+1', '5+2'];
const apartmentPositionOptions = ['Zemin Kat', 'Ara Kat', 'Çatı Katı'];
const kitchenOptions = ['Açık Mutfak', 'Kapalı Mutfak', 'Fark Etmez'];
const parkingOptions = ['Daireye Ait Özel Otopark', 'Siteye / Binaya Ait Ortak Otopark', 'Açık Otopark (Site Sınırları İçinde)', 'Kapalı Otopark', 'Otopark Yok'];
const heatingOptions = ['Doğalgaz – Kombi', 'Merkezi Sistem', 'Merkezi Sistem – Pay Ölçer', 'Yerden Isıtma', 'Klima', 'Isı Pompası', 'Soba', 'Elektrikli Isıtma', 'Diğer'];
const timingOptions = ['1 Ay İçinde', '1–3 Ay İçinde', '3–6 Ay İçinde', 'Ne Zaman Olursa'];
const multiLocationForms = new Set(['alici', 'kiralayan']);
const processingLegalBasisText = 'Başvuru talebinizin değerlendirilmesi, sizinle iletişim kurulması ve talep ettiğiniz hizmete ilişkin sözleşme öncesi süreçlerin yürütülmesi; ayrıca başvurunun takip edilebilmesi için meşru menfaat kapsamında işlenir.';
const kvkkNotice = [
  'Çanakkale Konut Rehberi başvuru formlarında paylaştığınız kimlik, iletişim, konum, mülk ihtiyacı ve motivasyon yanıtları başvurunuzu değerlendirmek, sizinle iletişim kurmak ve talep ettiğiniz hizmete ilişkin hazırlık yapmak için işlenir.',
  'Bu başvuru verileri için esas hukuki sebep sözleşme öncesi süreçlerin yürütülmesi ve başvurunun güvenli biçimde takip edilebilmesine ilişkin meşru menfaattir. Bu nedenle başvuru kaydı için ayrıca açık rıza alınmaz.',
  'Reklam, kampanya ve genel bilgilendirme iletişimi ayrı ve isteğe bağlıdır. Bu izni vermemeniz başvurunuzu engellemez; verdiğiniz izni daha sonra geri çekebilirsiniz.',
  `Taslak başvurular ${30} gün boyunca yarım başvuru olarak saklanır; tamamlanmayan taslaklar saklama süresi sonunda silinmek üzere işaretlenir.`,
  "KVKK kapsamındaki haklarınız için Çanakkale Konut Rehberi ile iletişime geçebilirsiniz.",
];

const sellerResultMessages = [
  { min: 0, max: 29, title: 'Keşif Aşamasındasınız', text: 'Yanıtlarınıza göre şu anda mülkünüzün değerini ve satış seçeneklerinizi araştırıyorsunuz. Bu aşamada bölgenizdeki piyasa koşullarını ve gerçekleşebilir satış fiyatlarını öğrenmek kararınızı şekillendirmenize yardımcı olabilir.' },
  { min: 30, max: 54, title: 'Kararınızı Netleştiriyorsunuz', text: 'Yanıtlarınıza göre satış düşünceniz oluşmaya başlamış ancak netleştirmek istediğiniz bazı konular bulunuyor. Doğru piyasa bilgileri ve profesyonel bir değerlendirme karar sürecinizi kolaylaştırabilir.' },
  { min: 55, max: 79, title: 'Satışa Yaklaşıyorsunuz', text: 'Yanıtlarınıza göre mülkünüzü satma fikriniz önemli ölçüde şekillenmiş. Ancak satışa geçmeden önce netleştirmek istediğiniz bazı konular olabilir.' },
  { min: 80, max: 100, title: 'Satışa Hazırsınız', text: 'Yanıtlarınız satış konusunda kararınızın büyük ölçüde netleştiğini gösteriyor. Şimdi önemli olan, mülkünüzün gerçek piyasa değerini belirlemek ve doğru satış stratejisiyle ilerlemek.' },
];

const motivationConfigs = {
  satici: {
    title: 'Satıcı Motivasyon Analizi',
    intro: 'Satışa hazırlık seviyenizi 7 kısa soruyla görelim.',
    scored: true,
    questions: [
      { name: 'karar_netligi', label: 'Mülkünüzü satma kararınız şu anda hangi aşamada?', options: [
        { label: 'Satmaya kesin olarak karar verdim', score: 25 },
        { label: 'Uygun koşullar oluşursa satarım', score: 15 },
        { label: 'Satmakla beklemek arasında kararsızım', score: 5, cap: 54 },
        { label: 'Şimdilik yalnızca mülkümün değerini öğrenmek istiyorum', score: 0, cap: 29 },
      ] },
      { name: 'teklife_hazirlik', label: 'Beklentilerinize uygun, ciddi bir alıcı bugün teklif verirse ne yaparsınız?', options: [
        { label: 'Anlaşma sağlanırsa satış işlemlerine başlarım', score: 20 },
        { label: 'Teklifi değerlendirir, şartları netleştiririm', score: 12 },
        { label: 'Karar vermek için daha fazla zamana ihtiyacım olur', score: 5 },
        { label: 'Şu anda teklif değerlendirmek istemiyorum', score: 0, cap: 29 },
      ] },
      { name: 'satis_gerekcesi', label: 'Mülkünüzü satmayı düşünmenizin temel nedeni nedir?', options: [
        { label: 'Netleşmiş bir taşınma, mülk alımı veya finansal planım var', score: 15 },
        { label: 'Kullanmadığım mülkü değerlendirmek veya yatırımımı değiştirmek istiyorum', score: 12 },
        { label: 'İyi bir fiyat elde edebilirsem satmayı düşünüyorum', score: 8 },
        { label: 'Piyasanın durumunu ve mülkümün değerini merak ediyorum', score: 0 },
      ] },
      { name: 'satis_hazirligi', label: 'Satış için bugüne kadar hangi hazırlıkları yaptınız?', options: [
        { label: 'İlan, danışmanlık veya değerleme sürecini başlattım', score: 15 },
        { label: 'Piyasa araştırması ve fiyat karşılaştırması yaptım', score: 10 },
        { label: 'Yakın çevremle görüştüm, seçeneklerimi değerlendiriyorum', score: 5 },
        { label: 'Henüz herhangi bir hazırlık yapmadım', score: 0 },
      ] },
      { name: 'karar_yetkisi', label: 'Satış kararını vermeye yetkili kişiler arasında görüş birliği var mı?', options: [
        { label: 'Kararı tek başıma verebiliyorum', score: 10 },
        { label: 'Ortak karar veriyoruz ve herkes satış konusunda hemfikir', score: 10 },
        { label: 'Diğer karar vericilerle henüz netleşmedik', score: 3 },
        { label: 'Satış kararını ben veremiyorum', score: 0, cap: 54 },
      ] },
      { name: 'fiyat_esnekligi', label: 'Fiyat beklentiniz piyasa verileriyle örtüşmezse nasıl ilerlersiniz?', options: [
        { label: 'Somut piyasa verilerine göre yeniden değerlendirebilirim', score: 10 },
        { label: 'Önce düşündüğüm fiyatı denemek isterim', score: 6 },
        { label: 'Belirlediğim fiyatın altına inmeyi düşünmüyorum', score: 2 },
        { label: 'Henüz bir fiyat beklentim yok', score: 0 },
      ] },
      { name: 'satis_engelleri', label: 'Bugün satış sürecine başlamanızı engelleyen bir durum var mı?', options: [
        { label: 'Hayır, satışa başlamama engel bir durum yok', score: 5 },
        { label: 'Taşınma, kiracı veya evrak gibi çözülmesi gereken konular var', score: 3 },
        { label: 'Önce ailevi veya kişisel bazı kararları netleştirmeliyim', score: 1 },
        { label: 'Evet, şu anda satışa başlamam mümkün değil', score: 0, cap: 54 },
      ] },
    ],
  },
  alici: {
    title: 'Alıcı Motivasyon Analizi',
    intro: 'Arayışınızın karar aşamasını ve önceliklerini netleştirelim.',
    questions: [
      { name: 'alim_amaci', label: 'Mülkü hangi amaçla satın almak istiyorsunuz?', options: ['Kendim oturmak', 'Yatırım / kira geliri', 'Yazlık olarak kullanmak', 'İleride kullanmak', 'Ticari amaç', 'Diğer'] },
      { name: 'alim_nedenleri', label: 'Sizi şu anda mülk satın almaya yönelten nedenler nelerdir?', multiple: true, options: ['Kiradan çıkmak', 'Daha büyük veya uygun bir eve geçmek', 'Tayin / görev yeri değişikliği', 'İş değişikliği', 'Başka bir şehre veya bölgeye taşınmak', 'Birikimimi değerlendirmek', 'Yatırım fırsatı', 'Diğer'] },
      { name: 'surec_asamasi', label: 'Satın alma sürecinin hangi aşamasındasınız?', options: ['Yeni araştırıyorum', 'Aktif olarak mülk geziyorum', 'Alternatifleri karşılaştırıyorum', 'Uygun mülke teklif vermeye hazırım'] },
      { name: 'finansman', label: 'Alım bütçenizi nasıl karşılamayı planlıyorsunuz?', options: ['Nakit hazır', 'Nakit + konut kredisi', 'Kredi kullanacağım', 'Başka mülkün satışına bağlı', 'Henüz netleşmedi'] },
      { name: 'oncelikler', label: 'Bir mülkü seçerken en önemli üç kriteriniz nedir?', multiple: true, max: 3, options: ['Fiyat', 'Konum', 'Yapı güvenliği', 'Bina yaşı', 'Kullanım alanı', 'Sosyal imkânlar', 'Yatırım getirisi'] },
      { name: 'zorlayan_konu', label: 'Aradığınız mülkü bulmanızı şu anda en çok ne zorlaştırıyor?', options: ['Fiyatlar', 'Uygun mülk bulamamak', 'Finansman', 'Karar verememek', 'Piyasa hakkında yeterli bilgim olmaması', 'Henüz sorun yaşamadım'] },
    ],
  },
  'kiraya-veren': {
    title: 'Kiraya Veren Motivasyon Analizi',
    intro: 'Kiralama beklentinizi ve süreç önceliklerinizi sade şekilde netleştirelim.',
    questions: [
      { name: 'kiraya_verme_nedeni', label: 'Mülkünüzü kiraya verme nedeniniz nedir?', options: ['Düzenli gelir elde etmek', 'Boş mülkü değerlendirmek', 'Yatırım amaçlı', 'Geçici süre kullanmayacağım', 'Diğer'] },
      { name: 'karar_asamasi', label: 'Kiraya verme kararınız hangi aşamada?', options: ['Kesin karar verdim', 'Uygun şartlarda kiralarım', 'Henüz araştırıyorum'] },
      { name: 'kira_belirleme', label: 'Kira beklentinizi neye göre belirlediniz?', options: ['Benzer ilanlar', 'Bölgedeki kira bedelleri', 'Profesyonel görüş', 'Henüz belirlemedim'] },
      { name: 'en_onemli_konu', label: 'Kiralama sürecinde sizin için en önemli konu nedir?', options: ['Düzenli ödeme', 'Uzun süreli kiralama', 'Mülkün özenli kullanılması', 'Sürecin hızlı ilerlemesi'] },
      { name: 'pazarlik', label: 'Kira bedelinde pazarlığa yaklaşımınız nedir?', options: ['Makul teklifleri değerlendiririm', 'Şartlara göre değişebilir', 'Fiyatım kesin', 'Henüz karar vermedim'] },
      { name: 'cekince', label: 'Kiralama konusunda en büyük çekinceniz nedir?', options: ['Ödeme sorunları', 'Mülkün zarar görmesi', 'Hukuki süreçler', 'Kiracının taşınma süreci', 'Endişem yok'] },
    ],
  },
  kiralayan: {
    title: 'Kiralayan Motivasyon Analizi',
    intro: 'Kiralama ihtiyacınızın nedenini, aşamasını ve önceliklerini netleştirelim.',
    questions: [
      { name: 'kiralama_nedenleri', label: 'Sizi yeni bir mülk kiralamaya yönelten nedenler nelerdir?', multiple: true, options: ['İlk kez ev kiralayacağım', 'Mevcut evim ihtiyaçlarımı karşılamıyor', 'Tayin / görev yeri değişikliği', 'İş değişikliği', 'İş yerime daha yakın olmak', 'Daha uygun kira ödemek', 'Başka bir şehre veya bölgeye taşınmak', 'Diğer'] },
      { name: 'karar_asamasi', label: 'Kiralama kararınız hangi aşamada?', options: ['Araştırıyorum', 'Aktif olarak ev geziyorum', 'Alternatifleri değerlendiriyorum', 'Uygun evi bulursam sözleşmeye hazırım'] },
      { name: 'kiralama_suresi', label: 'Ne kadar süreyle kiralamayı düşünüyorsunuz?', options: ['Yaklaşık 1 yıl', '1–2 yıl', '2 yıldan uzun', 'Henüz belli değil'] },
      { name: 'depozito_hazirlik', label: 'İlk kira ve depozito için hazırlığınız nedir?', options: ['Bütçem hazır', 'Bir kısmı hazır', 'Hazırlık yapıyorum', 'Henüz planlamadım'] },
      { name: 'oncelikler', label: 'Kiralayacağınız mülkte en önemli üç önceliğiniz nedir?', multiple: true, max: 3, options: ['Kira bedeli', 'Konum', 'Ulaşım', 'Bina güvenliği', 'Kullanım alanı', 'Otopark', 'Sosyal imkânlar'] },
      { name: 'zorlayan_konu', label: 'Kiralama sürecinde sizi en çok zorlayan konu nedir?', options: ['Yüksek kiralar', 'Depozito / başlangıç masrafı', 'Uygun ev bulamamak', 'İlanların gerçeği yansıtmaması', 'Sözleşme koşulları', 'Henüz sorun yaşamadım'] },
    ],
  },
};

function locationSummary(location) {
  if (!location) return '';
  if (Array.isArray(location.selections) && location.selections.length > 0) {
    return location.selections.map((item) => item.label).filter(Boolean).join(' | ');
  }
  return location.raw || [location.province, location.district, location.neighborhood].filter(Boolean).join(' / ');
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function prettyValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

function normalizeTurkishMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) return digits.slice(1);
  if (digits.length === 10) return digits;
  return '';
}

function isValidTurkishMobile(value) {
  return /^5\d{9}$/.test(normalizeTurkishMobile(value));
}

function formatTurkishMobileForApi(value) {
  const normalized = normalizeTurkishMobile(value);
  return normalized ? `+90${normalized}` : value;
}

function createApplicationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `ckr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function propertyKind(type) {
  if (!type) return '';
  if (type.includes('Daire')) return 'apartment';
  if (type.includes('Villa')) return 'villa';
  if (type === 'Komple Bina') return 'building';
  if (type === 'Arsa' || type === 'Tarla') return 'land';
  return '';
}

function parseNumber(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(cleaned);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function pricePreview(meta, value) {
  const number = parseNumber(value);
  if (!number) return '';
  if (meta.sale) {
    if (number > 1000) return 'Lütfen milyon TL biçiminde yazın. 7,5 milyon TL belirtmek için 7,5 yazın.';
    return `Yaklaşık tam karşılığı: ${Math.round(number * 1000000).toLocaleString('tr-TR')} TL`;
  }
  return `Girilen tutar: ${Math.round(number).toLocaleString('tr-TR')} TL / Ay`;
}

function optionLabels(question) {
  return question.options.map((option) => (typeof option === 'string' ? option : option.label));
}

function getMissingQuestions(formKey, answers = {}) {
  const config = motivationConfigs[formKey];
  if (!config) return [];
  return config.questions.filter((question) => {
    const value = answers[question.name];
    return question.multiple ? asArray(value).length === 0 : !value;
  });
}

function sellerCategory(score) {
  return sellerResultMessages.find((row) => score >= row.min && score <= row.max) || sellerResultMessages[0];
}

function narrativeSummary(formKey, answerRows) {
  if (formKey === 'alici') {
    return `Alım amacınız ve arayış aşamanız netleştikçe size daha isabetli bölge ve bütçe önerisi sunabiliriz. Öncelikleriniz: ${prettyValue(answerRows['Bir mülkü seçerken en önemli üç kriteriniz nedir?']) || 'henüz belirtilmedi'}.`;
  }
  if (formKey === 'kiralayan') {
    return `Kiralama ihtiyacınızı, taşınma nedeninizi ve önceliklerinizi birlikte değerlendirmek uygun seçenekleri daraltmayı kolaylaştırır. Öncelikleriniz: ${prettyValue(answerRows['Kiralayacağınız mülkte en önemli üç önceliğiniz nedir?']) || 'henüz belirtilmedi'}.`;
  }
  if (formKey === 'kiraya-veren') {
    return 'Kira beklentiniz, kiracı seçimi ve süreç öncelikleriniz netleştikçe mülkünüz için daha sağlıklı bir kiralama stratejisi kurulabilir.';
  }
  return 'Yanıtlarınız kişisel ihtiyaç değerlendirmeniz için kaydedildi.';
}

function motivationResult(formKey, answers = {}, allowIncomplete = false) {
  const config = motivationConfigs[formKey];
  if (!config) return null;
  const missing = getMissingQuestions(formKey, answers);
  const answerRows = {};

  config.questions.forEach((question) => {
    const value = answers[question.name];
    if (question.multiple) {
      const selected = asArray(value);
      if (selected.length) answerRows[question.label] = selected;
    } else if (value) {
      answerRows[question.label] = value;
    }
  });

  if (missing.length && allowIncomplete) {
    return {
      answers: { completion: 'incomplete', responses: answerRows, missing: missing.map((question) => question.label) },
      score: null,
      category: 'Değerlendirilmedi',
      summary: 'Motivasyon soruları eksik yanıtlandığı için motivasyon puanı hesaplanmadı.',
    };
  }

  if (missing.length) return null;

  if (!config.scored) {
    return {
      answers: { completion: 'complete', responses: answerRows },
      score: null,
      category: 'Kişisel Değerlendirme',
      summary: narrativeSummary(formKey, answerRows),
    };
  }

  let rawScore = 0;
  let cap = 100;
  config.questions.forEach((question) => {
    const selected = answers[question.name];
    const option = question.options.find((item) => item.label === selected);
    if (option) {
      rawScore += option.score;
      if (option.cap) cap = Math.min(cap, option.cap);
    }
  });
  const finalScore = Math.min(rawScore, cap);
  const result = sellerCategory(finalScore);
  return {
    answers: { completion: 'complete', responses: answerRows, raw_score: rawScore, final_score: finalScore, applied_cap: cap < 100 ? cap : null },
    score: finalScore,
    category: result.title,
    summary: result.text,
  };
}

function getPropertyFields(formKey, values) {
  const meta = formMeta[formKey];
  const kind = propertyKind(values.property_type);
  const isSeeker = meta.seeker;
  const fields = [
    { name: 'property_type', label: 'Mülk Tipi', type: 'select', required: true, options: propertyTypeOptions },
    { name: meta.priceName, label: `${meta.priceLabel} (${meta.priceUnit})`, type: 'text', placeholder: meta.sale ? 'Örn. 7,5' : 'Örn. 30000' },
    { name: 'timing', label: meta.timingLabel, type: 'select', options: timingOptions },
  ];

  if (kind === 'apartment') {
    fields.push(
      { name: 'rooms', label: 'Oda Sayısı', type: isSeeker ? 'dropdown-multi' : 'select', multiple: isSeeker, options: isSeeker ? [...roomOptions, 'Fark Etmez'] : roomOptions, exclusiveOptions: ['Fark Etmez'] },
      { name: 'net_m2', label: 'Net Kullanım Alanı (m²)', type: 'number' },
      { name: 'apartment_position', label: 'Dairenin Konumu', type: isSeeker ? 'dropdown-multi' : 'select', multiple: isSeeker, options: isSeeker ? [...apartmentPositionOptions, 'Fark Etmez'] : apartmentPositionOptions, exclusiveOptions: ['Fark Etmez'] },
      { name: 'kitchen_preference', label: 'Mutfak Tercihi', type: 'select', options: kitchenOptions },
      { name: 'elevator', label: 'Asansör', type: 'select', options: isSeeker ? ['Olmazsa Olmaz', 'Tercihen Olsun', 'Fark Etmez'] : ['Var', 'Yok'] },
      { name: 'parking', label: 'Otopark', type: 'dropdown-multi', multiple: true, options: isSeeker ? [...parkingOptions, 'Fark Etmez'] : parkingOptions, exclusiveOptions: ['Otopark Yok', 'Fark Etmez'] },
      { name: 'heating', label: 'Isınma Tipi', type: isSeeker ? 'dropdown-multi' : 'select', multiple: isSeeker, options: isSeeker ? [...heatingOptions, 'Fark Etmez'] : heatingOptions, exclusiveOptions: ['Fark Etmez'] },
    );
  } else if (kind === 'villa') {
    fields.push(
      { name: 'rooms', label: 'Oda Sayısı', type: isSeeker ? 'dropdown-multi' : 'select', multiple: isSeeker, options: isSeeker ? [...roomOptions, 'Fark Etmez'] : roomOptions, exclusiveOptions: ['Fark Etmez'] },
      { name: 'net_m2', label: 'Net Kullanım Alanı (m²)', type: 'number' },
      { name: 'garden_m2', label: 'Bahçe Alanı (m²)', type: 'number' },
      { name: 'parking', label: 'Otopark', type: 'dropdown-multi', multiple: true, options: isSeeker ? [...parkingOptions, 'Fark Etmez'] : parkingOptions, exclusiveOptions: ['Otopark Yok', 'Fark Etmez'] },
      { name: 'heating', label: 'Isınma Tipi', type: isSeeker ? 'dropdown-multi' : 'select', multiple: isSeeker, options: isSeeker ? [...heatingOptions, 'Fark Etmez'] : heatingOptions, exclusiveOptions: ['Fark Etmez'] },
    );
  } else if (kind === 'building') {
    fields.push(
      { name: 'total_floors', label: 'Toplam Kat Sayısı', type: 'number' },
      { name: 'unit_count', label: 'Bağımsız Bölüm Sayısı', type: 'number' },
      { name: 'net_m2', label: 'Toplam Net Kullanım Alanı (m²)', type: 'number' },
      { name: 'parking', label: 'Otopark', type: 'dropdown-multi', multiple: true, options: isSeeker ? [...parkingOptions, 'Fark Etmez'] : parkingOptions, exclusiveOptions: ['Otopark Yok', 'Fark Etmez'] },
      { name: 'heating', label: 'Isınma Tipi', type: isSeeker ? 'dropdown-multi' : 'select', multiple: isSeeker, options: isSeeker ? [...heatingOptions, 'Fark Etmez'] : heatingOptions, exclusiveOptions: ['Fark Etmez'] },
    );
  } else if (kind === 'land') {
    fields.push(
      { name: 'parcel_m2', label: 'Parsel Yüzölçümü (m²)', type: 'number' },
      { name: 'zoning_status', label: 'İmar Durumu', type: 'text', placeholder: 'Biliniyorsa yazın' },
      { name: 'road_frontage', label: 'Kadastro Yoluna Cephe Durumu', type: 'select', options: ['Var', 'Yok', 'Bilmiyorum'] },
    );
  }

  if (formKey === 'alici') fields.push({ name: 'purchase_purpose', label: 'Alım Amacı', type: 'select', options: ['Oturum', 'Yatırım', 'Her ikisi'] });
  if (formKey === 'kiraya-veren') fields.push({ name: 'property_status', label: 'Konut Durumu', type: 'select', options: ['Boş', 'Kiracılı', 'Yakında boşalacak'] });

  return fields;
}

function ChoiceInput({ field, value, onChange }) {
  if (!field.multiple) {
    return (
      <select className="ckr-select" value={value || ''} onChange={(event) => onChange(field.name, event.target.value)}>
        <option value="">Seçiniz</option>
        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  const selected = asArray(value);
  const exclusiveOptions = field.exclusiveOptions || [];
  const toggle = (option) => {
    let next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
    if (exclusiveOptions.includes(option) && !selected.includes(option)) next = [option];
    else next = next.filter((item) => !exclusiveOptions.includes(item));
    if (field.max && next.length > field.max) return;
    onChange(field.name, next);
  };
  return (
    <div className="ckr-choice-grid">
      {field.options.map((option) => (
        <button key={option} type="button" className={`ckr-choice-pill ${selected.includes(option) ? 'is-selected' : ''}`} onClick={() => toggle(option)}>
          {option}
        </button>
      ))}
      {field.max && <span className="ckr-field-hint">En fazla {field.max} seçenek seçilebilir.</span>}
    </div>
  );
}

function CompactMultiSelect({ question, value, onChange, buttonRef }) {
  const [open, setOpen] = useState(false);
  const selected = asArray(value);
  const toggle = (option) => {
    const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
    if (question.max && next.length > question.max) return;
    onChange(question.name, next);
  };
  return (
    <div className="ckr-compact-multi">
      <button ref={buttonRef} type="button" className="ckr-location-control" onClick={() => setOpen((current) => !current)}>
        <span>{selected.length ? selected.join(', ') : 'Seçiniz'}</span>
      </button>
      {open && (
        <div className="ckr-compact-dropdown">
          {question.options.map((option) => (
            <label key={option} className="ckr-compact-check">
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
              <span>{option}</span>
            </label>
          ))}
          {question.max && <p>En fazla {question.max} seçenek seçilebilir.</p>}
        </div>
      )}
    </div>
  );
}

function CompactFieldMultiSelect({ field, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = asArray(value);
  const exclusiveOptions = field.exclusiveOptions || [];
  const toggle = (option) => {
    let next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
    if (exclusiveOptions.includes(option) && !selected.includes(option)) next = [option];
    else next = next.filter((item) => !exclusiveOptions.includes(item));
    onChange(field.name, next);
  };
  return (
    <div className="ckr-compact-multi">
      <button type="button" className="ckr-location-control" onClick={() => setOpen((current) => !current)}>
        <span>{selected.length ? selected.join(', ') : 'Seçiniz'}</span>
      </button>
      {open && (
        <div className="ckr-compact-dropdown">
          {field.options.map((option) => (
            <label key={option} className="ckr-compact-check">
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SellerMotivationGauge({ result }) {
  const score = typeof result?.score === 'number' ? result.score : 0;
  const angle = -90 + (score * 1.8);
  return (
    <div className="ckr-gauge-card">
      <h4>Gayrimenkul Satış Motivasyonunuz</h4>
      <div className="ckr-gauge" aria-label={`Satış motivasyon puanı ${score}`}>
        <div className="ckr-gauge-arc" />
        <div className="ckr-gauge-mask" />
        <div className="ckr-gauge-needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="ckr-gauge-hub" />
        <div className="ckr-gauge-score"><strong>{score}</strong><span>{result.category}</span></div>
      </div>
      <p>{result.summary}</p>
      <small>Bu sonuç yanıtlarınıza dayalı satışa hazırlık göstergesidir; gerçek satış ihtimalini temsil etmez.</small>
    </div>
  );
}

export default function NeedAnalysisForms() {
  useReveal();
  const { activeForm, setActiveForm, formSource, setFormSource } = useForms();
  const [values, setValues] = useState({});
  const [step, setStep] = useState('details');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savedLead, setSavedLead] = useState(null);
  const [draftLead, setDraftLead] = useState(null);
  const [applicationId, setApplicationId] = useState(() => createApplicationId());
  const [draftToken, setDraftToken] = useState('');
  const [draftUnsupported, setDraftUnsupported] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const [autosaveError, setAutosaveError] = useState('');
  const [finalSaveStatus, setFinalSaveStatus] = useState('idle');
  const [finalSaveError, setFinalSaveError] = useState('');
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [warningOpen, setWarningOpen] = useState(false);
  const [kvkkOpen, setKvkkOpen] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [preferenceSubmitting, setPreferenceSubmitting] = useState('');
  const formCardRef = useRef(null);
  const motivationRef = useRef(null);
  const firstMissingRef = useRef(null);
  const autoSubmitKeyRef = useRef('');
  const lastAutosaveKeyRef = useRef('');
  const autosaveTimerRef = useRef(null);
  const draftPromiseRef = useRef(null);
  const completePromiseRef = useRef(null);
  const lastCompletionAllowIncompleteRef = useRef(false);

  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setValues({});
    setStep('details');
    setError('');
    setSavedLead(null);
    setDraftLead(null);
    setApplicationId(createApplicationId());
    setDraftToken('');
    setDraftUnsupported(false);
    setAutosaveStatus('idle');
    setAutosaveError('');
    setFinalSaveStatus('idle');
    setFinalSaveError('');
    setWarningOpen(false);
    setKvkkOpen(false);
    setPreferenceMessage('');
    setStartedAt(new Date().toISOString());
    autoSubmitKeyRef.current = '';
    lastAutosaveKeyRef.current = '';
    draftPromiseRef.current = null;
    completePromiseRef.current = null;
  }, [activeForm]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  const meta = formMeta[activeForm] || formMeta.alici;
  const propertyFields = useMemo(() => getPropertyFields(activeForm, values), [activeForm, values]);
  const motivationConfig = motivationConfigs[activeForm];
  const motivationPreview = motivationResult(activeForm, values.motivationAnswers || {}, false);
  const finalMotivation = motivationResult(activeForm, values.motivationAnswers || {}, true);

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }));
  const setConsent = (name, checked) => setValues((current) => ({
    ...current,
    [name]: checked,
    [`${name}_at`]: checked ? current[`${name}_at`] || new Date().toISOString() : '',
  }));
  const setMotivationAnswer = (name, value) => setValues((current) => ({ ...current, motivationAnswers: { ...(current.motivationAnswers || {}), [name]: value } }));
  const scrollFormCardIntoView = () => setTimeout(() => {
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);

  const changeTab = (key) => {
    setActiveForm(key);
    setFormSource({ button_source: 'analiz-sekmesi', form_type: key });
  };

  const detailMissing = () => {
    const required = propertyFields.filter((field) => field.required && !values[field.name]);
    if (!values.ad || !values.tel || !isValidTurkishMobile(values.tel)) required.push({ name: 'contact', label: 'İletişim bilgileri' });
    return required;
  };

  const detailErrorMessage = () => {
    if (!values.property_type) return 'Lütfen mülk tipini seçin.';
    if (!values.ad || !values.tel) return 'Lütfen ad soyad ve telefon alanlarını doldurun.';
    if (!isValidTurkishMobile(values.tel)) {
      return 'Lütfen geçerli bir Türkiye cep telefonu numarası girin. Numara +90 5xx, 05xx veya doğrudan 5xx ile başlayabilir.';
    }
    if (!values.kvkk_acknowledged) return "KVKK Aydınlatma Metni'ni okudum ve bilgilendirildim kutusunu işaretlemeden kayıt oluşturulamaz.";
    return '';
  };

  const goMotivation = async () => {
    const detailError = detailErrorMessage();
    if (detailError) {
      setError(detailError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await ensureDraft();
      autoSubmitKeyRef.current = '';
      setStep('motivation');
      scrollFormCardIntoView();
    } catch (err) {
      setError(err.message || 'Taslak başvuru oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const buildPropertyFeatures = (motivation, applicationStatus = 'draft') => {
    const features = {};
    propertyFields.forEach((field) => {
      const value = values[field.name];
      if (value && field.name !== meta.priceName) features[field.label] = value;
    });
    features['Form aşaması'] = applicationStatus === 'draft'
      ? 'Taslak / motivasyon aşamasında'
      : (motivation?.category === 'Değerlendirilmedi' ? 'Motivasyon Değerlendirilmedi' : 'Sonuç görüntülendi');
    features['Başvuru takip notu'] = 'Takip edilecek yarım başvuru';
    features['Son ekran tercihi'] = 'Henüz seçilmedi';
    return features;
  };

  const mapPayload = (allowIncompleteMotivation = false, applicationStatus = 'draft') => {
    const selectedLocation = values.location || {};
    const locationRaw = locationSummary(selectedLocation);
    const motivation = motivationResult(activeForm, values.motivationAnswers || {}, allowIncompleteMotivation);
    const priceText = values[meta.priceName] || '';
    const priceWithUnit = priceText ? `${priceText} ${meta.priceUnit}` : '';
    return {
      request_type: meta.requestType,
      application_id: applicationId,
      application_status: applicationStatus,
      property_type: values.property_type || '',
      location: { ...selectedLocation, raw: locationRaw, district: selectedLocation.district || '', neighborhood: selectedLocation.neighborhood || selectedLocation.settlement || '' },
      property_features: buildPropertyFeatures(motivation, applicationStatus),
      budget_expectation: meta.requestType === 'buyer' || meta.requestType === 'tenant' ? priceWithUnit : '',
      price_expectation: meta.requestType === 'seller' || meta.requestType === 'landlord' ? priceWithUnit : '',
      timing: values.timing || '',
      contact: { name: values.ad || '', phone: formatTurkishMobileForApi(values.tel || ''), email: values.email || undefined },
      source: { ...formSource, form_type: activeForm, page_path: `${window.location.pathname}${window.location.hash}`, referrer: document.referrer || '' },
      notes: values.not || '',
      kvkk_acknowledged: !!values.kvkk_acknowledged,
      kvkk_acknowledged_at: values.kvkk_acknowledged ? values.kvkk_acknowledged_at || startedAt : undefined,
      marketing_consent: !!values.marketing_consent,
      marketing_consent_at: values.marketing_consent ? values.marketing_consent_at || startedAt : undefined,
      processing_legal_basis: processingLegalBasisText,
      motivation,
      honeypot: values.website || '',
      started_at: startedAt,
    };
  };

  const ensureDraft = async () => {
    if (draftUnsupported || savedLead) return draftLead;
    if (draftLead && draftToken) return draftLead;
    if (draftPromiseRef.current) return draftPromiseRef.current;

    const payload = mapPayload(true, 'draft');
    const payloadKey = JSON.stringify(payload);
    setAutosaveStatus('saving');
    setAutosaveError('');
    draftPromiseRef.current = createLeadDraft(payload)
      .then((lead) => {
        setDraftLead(lead);
        setDraftToken(lead.draft_token || '');
        setAutosaveStatus('saved');
        lastAutosaveKeyRef.current = payloadKey;
        return lead;
      })
      .catch((err) => {
        if (err.status === 404 || err.status === 405) {
          setDraftUnsupported(true);
          setAutosaveStatus('idle');
          return null;
        }
        setAutosaveStatus('error');
        setAutosaveError(err.message || 'Taslak kayıt oluşturulamadı.');
        throw err;
      })
      .finally(() => {
        draftPromiseRef.current = null;
      });
    return draftPromiseRef.current;
  };

  const completeApplication = async (allowIncompleteMotivation = false) => {
    if (finalSaveStatus === 'saved' && savedLead) return savedLead;
    if (completePromiseRef.current) return completePromiseRef.current;

    lastCompletionAllowIncompleteRef.current = allowIncompleteMotivation;
    const payload = mapPayload(allowIncompleteMotivation, 'completed');
    setSubmitting(true);
    setFinalSaveStatus('saving');
    setFinalSaveError('');
    setError('');

    completePromiseRef.current = (async () => {
      try {
        let lead = null;
        if (!draftUnsupported) {
          const draft = await ensureDraft();
          const token = draft?.draft_token || draftToken;
          if (draft && token) {
            lead = await completeLeadDraft(applicationId, token, payload);
          }
        }
        if (!lead) {
          lead = await createLead(payload);
        }
        setSavedLead(lead);
        setDraftLead(lead);
        setFinalSaveStatus('saved');
        return lead;
      } catch (err) {
        setFinalSaveStatus('error');
        setFinalSaveError(err.message || 'Başvurunuz veritabanına kaydedilemedi. Yanıtlarınız ekranda korunuyor.');
        return null;
      } finally {
        setSubmitting(false);
        completePromiseRef.current = null;
      }
    })();

    return completePromiseRef.current;
  };

  const submitLead = async (allowIncompleteMotivation = false) => {
    const detailError = detailErrorMessage();
    if (detailError) {
      setError(detailError);
      setStep('details');
      scrollFormCardIntoView();
      return;
    }
    const missingMotivation = getMissingQuestions(activeForm, values.motivationAnswers || {});
    if (missingMotivation.length && !allowIncompleteMotivation) {
      setWarningOpen(true);
      return;
    }
    setError('');
    setWarningOpen(false);
    setStep('result');
    scrollFormCardIntoView();
    await completeApplication(allowIncompleteMotivation);
  };

  useEffect(() => {
    if (step !== 'motivation' || submitting || finalSaveStatus === 'saved' || !motivationConfig) return;
    const answers = values.motivationAnswers || {};
    const missingMotivation = getMissingQuestions(activeForm, answers);
    if (missingMotivation.length) return;

    const submitKey = JSON.stringify({
      form: activeForm,
      contact: [values.ad, values.tel, values.email],
      propertyType: values.property_type,
      location: values.location,
      answers,
    });
    if (autoSubmitKeyRef.current === submitKey) return;
    autoSubmitKeyRef.current = submitKey;
    setStep('result');
    scrollFormCardIntoView();
    completeApplication(false);
    // completeApplication intentionally reads the latest form state; autoSubmitKeyRef prevents repeat submissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForm, finalSaveStatus, motivationConfig, step, submitting, values]);

  useEffect(() => {
    if (step !== 'motivation' || !applicationId || !draftToken || draftUnsupported || finalSaveStatus === 'saved') return undefined;
    const payload = mapPayload(true, 'draft');
    const payloadKey = JSON.stringify(payload);
    if (lastAutosaveKeyRef.current === payloadKey) return undefined;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveStatus('saving');
      setAutosaveError('');
      try {
        const updated = await updateLeadDraft(applicationId, draftToken, payload);
        setDraftLead(updated);
        setAutosaveStatus('saved');
        lastAutosaveKeyRef.current = payloadKey;
      } catch (err) {
        setAutosaveStatus('error');
        setAutosaveError(err.message || 'Otomatik kayıt tamamlanamadı.');
      }
    }, 700);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // mapPayload intentionally reflects the current field state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForm, applicationId, draftToken, draftUnsupported, finalSaveStatus, step, values]);

  const focusMissingQuestion = () => {
    setWarningOpen(false);
    setStep('motivation');
    setTimeout(() => {
      motivationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      firstMissingRef.current?.focus?.();
    }, 50);
  };

  const updatePreference = async (preference) => {
    if (!savedLead?.id) return;
    setPreferenceSubmitting(preference);
    setPreferenceMessage('');
    try {
      const updated = await updateLeadPreference(savedLead.id, { preference });
      setSavedLead(updated);
      setPreferenceMessage(preference === 'ADVISOR_REQUESTED'
        ? 'Tercihiniz kaydedildi. Başvurunuz danışman değerlendirmesi için işaretlendi.'
        : 'Tercihiniz kaydedildi. Kararınızı netleştirdiğinizde yeniden devam edebilirsiniz.');
    } catch (err) {
      setPreferenceMessage(err.message || 'Tercihiniz şu anda kayıt üzerine işlenemedi.');
    } finally {
      setPreferenceSubmitting('');
    }
  };

  const renderField = (field) => {
    const value = values[field.name] || (field.multiple ? [] : '');
    return (
      <div key={field.name} style={{ gridColumn: field.type === 'textarea' ? '1 / -1' : 'auto' }}>
        <label className="ckr-label">{field.label}{field.required && <span style={{ color: 'var(--ckr-gold)' }}> *</span>}</label>
        {field.type === 'select' ? (
          <select className="ckr-select" value={value} onChange={(event) => set(field.name, event.target.value)}>
            <option value="">Seçiniz</option>
            {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : field.type === 'dropdown-multi' ? (
          <CompactFieldMultiSelect field={field} value={value} onChange={set} />
        ) : field.type === 'choice' ? (
          <ChoiceInput field={field} value={value} onChange={set} />
        ) : field.type === 'textarea' ? (
          <textarea className="ckr-textarea" rows={3} value={value} onChange={(event) => set(field.name, event.target.value)} placeholder={field.placeholder || ''} />
        ) : (
          <input className="ckr-input" inputMode={field.type === 'number' ? 'decimal' : field.type === 'tel' ? 'tel' : undefined} autoComplete={field.type === 'tel' ? 'tel' : undefined} value={value} onChange={(event) => set(field.name, event.target.value)} placeholder={field.placeholder || ''} />
        )}
        {field.name === meta.priceName && pricePreview(meta, value) && <span className="ckr-field-hint">{pricePreview(meta, value)}</span>}
        {field.name === 'tel' && value && !isValidTurkishMobile(value) && <span className="ckr-field-hint ckr-field-hint-error">Geçerli format: +90 5xx xxx xx xx, 05xx xxx xx xx veya 5xx xxx xx xx.</span>}
      </div>
    );
  };

  const renderMotivationQuestion = (question, index) => {
    const missing = getMissingQuestions(activeForm, values.motivationAnswers || {});
    const isFirstMissing = missing[0]?.name === question.name;
    const value = values.motivationAnswers?.[question.name] || (question.multiple ? [] : '');
    return (
      <div className="ckr-motivation-row" key={question.name}>
        <label className="ckr-label">{index + 1}. {question.label}</label>
        {question.multiple ? (
          <CompactMultiSelect question={question} value={value} onChange={setMotivationAnswer} buttonRef={isFirstMissing ? firstMissingRef : undefined} />
        ) : (
          <select ref={isFirstMissing ? firstMissingRef : undefined} className="ckr-select" value={value} onChange={(event) => setMotivationAnswer(question.name, event.target.value)}>
            <option value="">Seçiniz</option>
            {optionLabels(question).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        )}
      </div>
    );
  };

  const whatsappPairs = [
    ['Konum / Bölge', locationSummary(values.location)],
    ...propertyFields.map((field) => [field.label, prettyValue(values[field.name])]),
    ['Ad Soyad', values.ad],
    ['Telefon', values.tel],
    ['E-posta', values.email],
    ['Motivasyon', finalMotivation?.score !== null && finalMotivation?.score !== undefined ? `${finalMotivation.score} puan - ${finalMotivation.category}` : finalMotivation?.category],
    ['Not', values.not],
  ];

  const warningModal = warningOpen ? (
    <div className="ckr-modal-backdrop" role="dialog" aria-modal="true" aria-label="Motivasyon soruları uyarısı">
      <div className="ckr-warning-modal">
        <AlertCircle size={24} />
        <p>Gayrimenkul alım satımında motivasyonunuzu bilmemiz hem sizin hem de bizim için önemli. Lütfen önce soruları cevaplayın!</p>
        <div>
          <button type="button" className="ckr-btn ckr-btn-ghost" onClick={focusMissingQuestion}>Sorulara Dön</button>
          <button type="button" className="ckr-btn ckr-btn-gold" disabled={submitting} onClick={() => submitLead(true)}>
            {submitting ? 'Gönderiliyor...' : 'Yine de Gönder'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const kvkkModal = kvkkOpen ? (
    <div className="ckr-modal-backdrop" role="dialog" aria-modal="true" aria-label="KVKK Aydınlatma Metni">
      <div className="ckr-warning-modal ckr-kvkk-modal">
        <h3>KVKK Aydınlatma Metni</h3>
        {kvkkNotice.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div>
          <button type="button" className="ckr-btn ckr-btn-gold" onClick={() => setKvkkOpen(false)}>Kapat</button>
        </div>
      </div>
    </div>
  ) : null;

  const autosaveText = {
    idle: draftUnsupported ? 'Otomatik kayıt bu backend sürümünde desteklenmiyor; başvuru sonunda normal kayıt denenir.' : '',
    saving: 'Taslak kaydediliyor...',
    saved: draftLead?.application_status === 'completed' ? 'Başvuru tamamlandı.' : 'Taslak otomatik kaydedildi.',
    error: autosaveError || 'Otomatik kayıt tamamlanamadı.',
  }[autosaveStatus];

  const finalSaveText = {
    idle: '',
    saving: 'Sonucunuz hazır. Veritabanı kaydı tamamlanıyor...',
    saved: 'Başvurunuz kaydedildi.',
    error: finalSaveError || 'Başvurunuz veritabanına kaydedilemedi.',
  }[finalSaveStatus];

  return (
    <section id="analiz" className="ckr-section" style={{ background: 'transparent', scrollMarginTop: 80 }}>
      <div className="ckr-container">
        <div className="ckr-fade-up" style={{ maxWidth: 640, marginBottom: 32 }}>
          <span className="ckr-eyebrow">İhtiyaç Analizi</span>
          <h2 style={{ fontSize: 'clamp(25px, 2.8vw, 34px)', fontWeight: 600, color: '#f3efe6', marginTop: 12, marginBottom: 14 }}>
            Durumunuza uygun analizi doldurun
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(233,235,228,0.64)', margin: 0 }}>
            Bilgileriniz güvenli şekilde kaydedilir; isterseniz sonucu WhatsApp üzerinden de iletebilirsiniz.
          </p>
        </div>

        <div className="ckr-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 26 }}>
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => changeTab(tab.key)}
              style={{
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14.5, fontWeight: 600,
                transition: 'all .2s ease',
                border: '1px solid ' + (activeForm === tab.key ? 'var(--ckr-gold)' : 'rgba(246,242,232,0.22)'),
                background: activeForm === tab.key ? 'var(--ckr-gold)' : 'rgba(255,255,255,0.06)',
                color: activeForm === tab.key ? '#241c0a' : 'rgba(233,235,228,0.75)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div ref={formCardRef} className="ckr-fade-up ckr-card" style={{ padding: 'clamp(22px, 4vw, 38px)' }}>
          <div className="ckr-form-progress" aria-label="Form ilerleme durumu">
            <span className={step === 'details' ? 'is-active' : ''}>1/2 Mülk Bilgileri</span>
            <span className={step === 'motivation' ? 'is-active' : ''}>2/2 Motivasyon Analizi</span>
            <span className={step === 'result' ? 'is-active' : ''}>Sonuç</span>
          </div>

          {step === 'details' && (
            <div className="ckr-form-page">
              <h3 style={{ fontSize: 22, fontWeight: 600, color: '#f3efe6', margin: '0 0 6px' }}>{meta.title}</h3>
              <p style={{ fontSize: 15, color: 'rgba(233,235,228,0.64)', margin: '0 0 24px' }}>{meta.intro}</p>
              <LocationSelector
                key={activeForm}
                mode={multiLocationForms.has(activeForm) ? 'multiple' : 'single'}
                value={values.location}
                onChange={(location) => set('location', location)}
              />
              <div className="ckr-form-grid">
                {propertyFields.map(renderField)}
              </div>
              <div className="ckr-form-subsection ckr-contact-subsection">
                <div className="ckr-form-subsection-head">
                  <h4>İletişim Bilgileri</h4>
                  <p>Başvuru kaydı için KVKK aydınlatma bilgilendirmesini onaylamanız gerekir. Reklam ve kampanya iletişimi ayrı, isteğe bağlıdır.</p>
                </div>
                <div className="ckr-form-grid">
                  {renderField({ name: 'ad', label: 'Ad Soyad', type: 'text', required: true })}
                  {renderField({ name: 'tel', label: 'Telefon', type: 'tel', required: true, placeholder: '+90 5xx xxx xx xx' })}
                  {renderField({ name: 'email', label: 'E-posta', type: 'text', placeholder: 'ornek@mail.com' })}
                  {renderField({ name: 'not', label: 'Eklemek İstedikleriniz', type: 'textarea' })}
                </div>
                <div className="ckr-consent-list">
                  <label className="ckr-consent-row">
                    <input
                      type="checkbox"
                      checked={!!values.kvkk_acknowledged}
                      onChange={(event) => setConsent('kvkk_acknowledged', event.target.checked)}
                    />
                    <span>
                      KVKK Aydınlatma Metni'ni okudum ve bilgilendirildim.
                      <button type="button" className="ckr-consent-link" onClick={() => setKvkkOpen(true)}>Metni aç</button>
                    </span>
                  </label>
                  <label className="ckr-consent-row">
                    <input
                      type="checkbox"
                      checked={!!values.marketing_consent}
                      onChange={(event) => setConsent('marketing_consent', event.target.checked)}
                    />
                    <span>Reklam, kampanya ve genel bilgilendirme iletişimi almak istiyorum. Bu izin başvuru kaydı için zorunlu değildir.</span>
                  </label>
                </div>
              </div>
              <input
                tabIndex="-1"
                autoComplete="off"
                value={values.website || ''}
                onChange={(event) => set('website', event.target.value)}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                aria-hidden="true"
              />
              {error && <p className="ckr-form-error">{error}</p>}
              {autosaveText && autosaveStatus !== 'idle' && <p className={`ckr-save-status is-${autosaveStatus}`}>{autosaveText}</p>}
              <button type="button" className="ckr-btn ckr-btn-primary" style={{ marginTop: 24 }} onClick={goMotivation} disabled={submitting}>
                {submitting ? 'Taslak oluşturuluyor...' : 'Devam'}
              </button>
            </div>
          )}

          {step === 'motivation' && (
            <div className="ckr-form-page">
              <div ref={motivationRef} className="ckr-form-subsection ckr-motivation-questions" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                <div className="ckr-form-subsection-head">
                  <h4>{motivationConfig.title}</h4>
                  <p>{motivationConfig.intro}</p>
                </div>
                <div className="ckr-motivation-compact-grid">
                  {motivationConfig.questions.map(renderMotivationQuestion)}
                </div>
                {motivationPreview && activeForm === 'satici' && (
                  <div className="ckr-motivation-result">
                    <strong>{motivationPreview.score} puan · {motivationPreview.category}</strong>
                    <span>{motivationPreview.summary}</span>
                  </div>
                )}
              </div>
              {error && <p className="ckr-form-error">{error}</p>}
              {autosaveText && <p className={`ckr-save-status is-${autosaveStatus}`}>{autosaveText}</p>}
              <div className="ckr-form-actions">
                <button type="button" className="ckr-btn ckr-btn-ghost" onClick={() => setStep('details')}>Geri</button>
                <button type="button" className="ckr-btn ckr-btn-primary" disabled={submitting} onClick={() => submitLead(false)}>
                  <Send size={16} /> {submitting ? 'Kaydediliyor...' : 'Başvuruyu Kaydet'}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && (
            <div className="ckr-result-panel">
              <CheckCircle2 size={42} style={{ color: 'var(--ckr-gold)' }} />
              <h3>{finalSaveStatus === 'saved' ? 'Başvurunuz kaydedildi' : 'Sonucunuz hazır'}</h3>
              {finalSaveText && (
                <div className={`ckr-save-status is-${finalSaveStatus}`}>
                  <span>{finalSaveText}</span>
                  {finalSaveStatus === 'error' && (
                    <button type="button" className="ckr-btn ckr-btn-ghost" onClick={() => completeApplication(lastCompletionAllowIncompleteRef.current)}>
                      Yeniden Dene
                    </button>
                  )}
                </div>
              )}
              {activeForm === 'satici' && typeof finalMotivation?.score === 'number' ? (
                <SellerMotivationGauge result={finalMotivation} />
              ) : (
                <div className="ckr-result-summary">
                  <strong>{finalMotivation?.category || 'Kişisel Değerlendirme'}</strong>
                  <p>{finalMotivation?.summary || 'Yanıtlarınız başvurunuzla birlikte kaydedildi.'}</p>
                </div>
              )}

              <div className="ckr-result-choice">
                <h4>Nasıl devam etmek istersiniz?</h4>
                <div className="ckr-result-choice-grid">
                  <button type="button" onClick={() => updatePreference('DECIDING_LATER')} disabled={!!preferenceSubmitting || finalSaveStatus !== 'saved'}>
                    <strong>Kararımı Netleştirip Haber Vereceğim</strong>
                    <span>Şimdilik değerlendirmemi tamamlayacağım. Karar verdiğimde yeniden iletişime geçebilirim.</span>
                  </button>
                  <button type="button" className="is-primary" onClick={() => updatePreference('ADVISOR_REQUESTED')} disabled={!!preferenceSubmitting || finalSaveStatus !== 'saved'}>
                    <strong>Formu Danışmana Yolla</strong>
                    <span>Yanıtlarımı ve mülk bilgilerimi danışmanla paylaşarak profesyonel değerlendirme almak istiyorum.</span>
                  </button>
                </div>
                {finalSaveStatus !== 'saved' && <p className="ckr-result-message">Bu iki tercih, başvuru kaydı veritabanında başarıyla tamamlandıktan sonra aktifleşir.</p>}
                {preferenceMessage && <p className="ckr-result-message">{preferenceMessage}</p>}
              </div>

              <div className="ckr-result-links">
                <h4>Doğru Kararlar, Doğru Bilgiyle Başlar.</h4>
                <p>Gayrimenkul sürecinizde daha bilinçli kararlar verebilmek için sosyal medya hesaplarımızı takip edebilir, sizin için hazırladığımız bilgilendirici blog yazılarını okuyabilirsiniz.</p>
                <div>
                  <a className="ckr-btn ckr-btn-ghost" href="https://www.instagram.com/canakkalekonutrehberi/" target="_blank" rel="noreferrer">Instagram'da Takip Et</a>
                  <a className="ckr-btn ckr-btn-ghost" href="https://www.facebook.com/p/Kutay-%C3%96zt%C3%BCrk-61561196368618/" target="_blank" rel="noreferrer">Facebook'ta Takip Et</a>
                  <a className="ckr-btn ckr-btn-gold" href="#blog">Blog Yazılarını Keşfet</a>
                </div>
              </div>

              <div className="ckr-form-actions">
                <button className="ckr-btn ckr-btn-gold" type="button" onClick={() => openWhatsApp(buildMessage(meta.title, whatsappPairs))}>
                  WhatsApp ile de Gönder
                </button>
                {savedLead && <span style={{ alignSelf: 'center', color: 'rgba(233,235,228,0.58)', fontSize: 13 }}>Kayıt no: {savedLead.id.slice(0, 8)}</span>}
                <button className="ckr-btn ckr-btn-ghost" type="button" onClick={() => {
                  if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
                  setStep('details');
                  setValues({});
                  setSavedLead(null);
                  setDraftLead(null);
                  setApplicationId(createApplicationId());
                  setDraftToken('');
                  setDraftUnsupported(false);
                  setAutosaveStatus('idle');
                  setAutosaveError('');
                  setFinalSaveStatus('idle');
                  setFinalSaveError('');
                  setPreferenceMessage('');
                  setStartedAt(new Date().toISOString());
                  autoSubmitKeyRef.current = '';
                  lastAutosaveKeyRef.current = '';
                }}>Yeni Analiz</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {warningModal && createPortal(warningModal, document.body)}
      {kvkkModal && createPortal(kvkkModal, document.body)}
    </section>
  );
}
