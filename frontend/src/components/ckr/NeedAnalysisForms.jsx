import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { useForms } from '../../context/FormsContext';
import { buildMessage, openWhatsApp } from '../../lib/whatsapp';
import useReveal from '../../hooks/useReveal';

const tabs = [
  { key: 'alici', label: 'Alıcı' },
  { key: 'satici', label: 'Satıcı' },
  { key: 'kiraya-veren', label: 'Kiraya Veren' },
  { key: 'kiralayan', label: 'Kiralayan' },
];

const configs = {
  alici: {
    title: 'Alıcı İhtiyaç Analizi',
    intro: 'Doğru evi doğru fiyata bulabilmemiz için ihtiyacınızı netleştirelim.',
    fields: [
      { name: 'ad', label: 'Ad Soyad', type: 'text', required: true },
      { name: 'tel', label: 'Telefon', type: 'tel', required: true, placeholder: '05xx xxx xx xx' },
      { name: 'bolge', label: 'Tercih Edilen Bölge', type: 'text', placeholder: 'Örn. Cevatpaşa, Barbaros' },
      { name: 'butce', label: 'Bütçe Aralığı', type: 'text', placeholder: 'Örn. 2.5M - 3.5M ₺' },
      { name: 'oda', label: 'Oda Sayısı', type: 'select', options: ['1+1', '2+1', '3+1', '4+1 ve üzeri', 'Fark etmez'] },
      { name: 'amac', label: 'Alım Amacı', type: 'select', options: ['Oturum', 'Yatırım', 'Her ikisi'] },
      { name: 'aciliyet', label: 'Aciliyet', type: 'select', options: ['Düşük', 'Orta', 'Yüksek'] },
      { name: 'not', label: 'Eklemek İstedikleriniz', type: 'textarea' },
    ],
  },
  satici: {
    title: 'Satıcı İhtiyaç Analizi',
    intro: 'Satılabilir fiyatı ve doğru stratejiyi birlikte belirleyelim.',
    fields: [
      { name: 'ad', label: 'Ad Soyad', type: 'text', required: true },
      { name: 'tel', label: 'Telefon', type: 'tel', required: true, placeholder: '05xx xxx xx xx' },
      { name: 'bolge', label: 'Konutun Bölgesi', type: 'text' },
      { name: 'tip', label: 'Konut Tipi', type: 'select', options: ['Daire', 'Villa', 'Müstakil', 'Arsa/Diğer'] },
      { name: 'metrekare', label: 'Metrekare (m²)', type: 'text', placeholder: 'Örn. 110' },
      { name: 'ilanFiyat', label: 'Düşündüğünüz Fiyat', type: 'text', placeholder: 'Örn. 3.2M ₺' },
      { name: 'aciliyet', label: 'Satış Aciliyeti', type: 'select', options: ['Düşük', 'Orta', 'Yüksek'] },
      { name: 'not', label: 'Eklemek İstedikleriniz', type: 'textarea' },
    ],
  },
  'kiraya-veren': {
    title: 'Kiraya Veren İhtiyaç Analizi',
    intro: 'Kira potansiyelinizi gerçek piyasaya göre belirleyelim.',
    fields: [
      { name: 'ad', label: 'Ad Soyad', type: 'text', required: true },
      { name: 'tel', label: 'Telefon', type: 'tel', required: true, placeholder: '05xx xxx xx xx' },
      { name: 'bolge', label: 'Konutun Bölgesi', type: 'text' },
      { name: 'tip', label: 'Konut Tipi', type: 'select', options: ['Daire', 'Villa', 'Müstakil', 'Diğer'] },
      { name: 'beklenenKira', label: 'Beklenen Aylık Kira', type: 'text', placeholder: 'Örn. 18.000 ₺' },
      { name: 'durum', label: 'Konut Durumu', type: 'select', options: ['Boş', 'Kiracılı', 'Yakında boşalacak'] },
      { name: 'not', label: 'Eklemek İstedikleriniz', type: 'textarea' },
    ],
  },
  kiralayan: {
    title: 'Kiralayan İhtiyaç Analizi',
    intro: 'Bütçe ve ihtiyacınıza göre doğru bölgeyi önerelim.',
    fields: [
      { name: 'ad', label: 'Ad Soyad', type: 'text', required: true },
      { name: 'tel', label: 'Telefon', type: 'tel', required: true, placeholder: '05xx xxx xx xx' },
      { name: 'bolge', label: 'Tercih Edilen Bölge', type: 'text' },
      { name: 'butce', label: 'Aylık Kira Bütçesi', type: 'text', placeholder: 'Örn. 15.000 - 20.000 ₺' },
      { name: 'oda', label: 'Oda Sayısı', type: 'select', options: ['1+1', '2+1', '3+1', '4+1 ve üzeri', 'Fark etmez'] },
      { name: 'tasinma', label: 'Taşınma Zamanı', type: 'select', options: ['Hemen', '1 ay içinde', '2-3 ay içinde', 'Esnek'] },
      { name: 'not', label: 'Eklemek İstedikleriniz', type: 'textarea' },
    ],
  },
};

export default function NeedAnalysisForms() {
  useReveal();
  const { activeForm, setActiveForm } = useForms();
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { setValues({}); setError(''); setDone(false); }, [activeForm]);

  const cfg = configs[activeForm] || configs.alici;
  const set = (name, v) => setValues((p) => ({ ...p, [name]: v }));

  const submit = (e) => {
    e.preventDefault();
    const missing = cfg.fields.filter((f) => f.required && !values[f.name]);
    if (missing.length) { setError('Lütfen ad ve telefon alanlarını doldurun.'); return; }
    setError('');
    const pairs = cfg.fields.map((f) => [f.label, values[f.name]]);
    openWhatsApp(buildMessage(cfg.title, pairs));
    setDone(true);
  };

  return (
    <section id="analiz" className="ckr-section" style={{ background: 'transparent', scrollMarginTop: 80 }}>
      <div className="ckr-container">
        <div className="ckr-fade-up" style={{ maxWidth: 640, marginBottom: 32 }}>
          <span className="ckr-eyebrow">İhtiyaç Analizi</span>
          <h2 style={{ fontSize: 'clamp(25px, 2.8vw, 34px)', fontWeight: 600, color: '#f3efe6', marginTop: 12, marginBottom: 14 }}>
            Durumunuza uygun analizi doldurun
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(233,235,228,0.64)', margin: 0 }}>
            Bilgilerinizi paylaşın; hazır mesajınızı WhatsApp üzerinden anında iletebilirsiniz.
          </p>
        </div>

        <div className="ckr-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 26 }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveForm(t.key)}
              style={{
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14.5, fontWeight: 600,
                transition: 'all .2s ease',
                border: '1px solid ' + (activeForm === t.key ? 'var(--ckr-gold)' : 'rgba(246,242,232,0.22)'),
                background: activeForm === t.key ? 'var(--ckr-gold)' : 'rgba(255,255,255,0.06)',
                color: activeForm === t.key ? '#241c0a' : 'rgba(233,235,228,0.75)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="ckr-fade-up ckr-card" style={{ padding: 'clamp(22px, 4vw, 38px)' }}>
          {done ? (
            <div style={{ textAlign: 'left', padding: '20px 0' }}>
              <CheckCircle2 size={44} style={{ color: 'var(--ckr-gold)' }} />
              <h3 style={{ fontSize: 24, fontWeight: 600, color: '#f3efe6', margin: '14px 0 8px' }}>Mesajınız hazır!</h3>
              <p style={{ fontSize: 15.5, color: 'rgba(233,235,228,0.64)', maxWidth: 520 }}>
                WhatsApp penceresi açılmadıysa, aşağıdaki butonla tekrar deneyebilirsiniz. En kısa sürede dönüş yapılacaktır.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                <button className="ckr-btn ckr-btn-gold" onClick={() => { const pairs = cfg.fields.map((f) => [f.label, values[f.name]]); openWhatsApp(buildMessage(cfg.title, pairs)); }}>
                  WhatsApp'ı Tekrar Aç
                </button>
                <button className="ckr-btn ckr-btn-ghost" onClick={() => { setDone(false); setValues({}); }}>Yeni Analiz</button>
              </div>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 22, fontWeight: 600, color: '#f3efe6', margin: '0 0 6px' }}>{cfg.title}</h3>
              <p style={{ fontSize: 15, color: 'rgba(233,235,228,0.64)', margin: '0 0 24px' }}>{cfg.intro}</p>
              <form onSubmit={submit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
                  {cfg.fields.map((f) => (
                    <div key={f.name} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                      <label className="ckr-label">{f.label}{f.required && <span style={{ color: 'var(--ckr-gold)' }}> *</span>}</label>
                      {f.type === 'select' ? (
                        <select className="ckr-select" value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)}>
                          <option value="">Seçiniz</option>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea className="ckr-textarea" rows={3} value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder || ''} />
                      ) : (
                        <input className="ckr-input" type={f.type} value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder || ''} />
                      )}
                    </div>
                  ))}
                </div>
                {error && <p style={{ color: '#a4452f', fontSize: 14, marginTop: 16, marginBottom: 0 }}>{error}</p>}
                <button type="submit" className="ckr-btn ckr-btn-primary" style={{ marginTop: 24 }}>
                  <Send size={16} /> WhatsApp ile Gönder
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
