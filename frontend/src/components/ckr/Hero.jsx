import React from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { brand } from '../../mock';
import { useForms } from '../../context/FormsContext';
import { openWhatsApp } from '../../lib/whatsapp';

const HERO_IMG = 'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/3772b21f9b6a5b2f_%C3%87ANAKKALE%20L%C4%B0MAN.png';

const stats = [
  ['Satılabilir fiyat', 'İlan değil, talep belirler'],
  ['Karar zemini', 'Ezber değil, veri'],
  ['Çanakkale', 'Odaklı bölge bilgisi'],
];

export default function Hero() {
  const { openForm } = useForms();

  return (
    <section id="top" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${HERO_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(95deg, rgba(18,36,38,0.82) 0%, rgba(18,36,38,0.6) 42%, rgba(18,36,38,0.28) 72%, rgba(18,36,38,0.15) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(18,36,38,0.55) 0%, rgba(18,36,38,0) 20%, rgba(18,36,38,0) 78%, rgba(18,36,38,0.35) 100%)' }} />

      <div className="ckr-container" style={{ position: 'relative', zIndex: 2, paddingTop: 128, paddingBottom: 96 }}>
        <div style={{ maxWidth: 680 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 15px', borderRadius: 999, background: 'rgba(246,242,232,0.08)', border: '1px solid rgba(246,242,232,0.22)', color: '#e9e3d4', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {brand.location} · Konut Danışmanlığı
          </span>

          <h1 style={{ color: '#f6f2e8', fontSize: 'clamp(33px, 4.6vw, 54px)', lineHeight: 1.12, margin: '26px 0 22px', fontWeight: 600 }}>
            Konut kararınızı ilan ezberiyle değil,{' '}
            <span style={{ color: 'var(--ckr-gold-soft)', fontStyle: 'italic', fontWeight: 500 }}>piyasa gerçekleriyle</span> verin.
          </h1>

          <p style={{ color: 'rgba(240,234,221,0.88)', fontSize: 'clamp(16px, 1.6vw, 18.5px)', lineHeight: 1.6, maxWidth: 580, margin: '0 0 36px' }}>
            Alıcı, satıcı, kiraya veren ve kiracılar için; bölge, bütçe, satılabilir fiyat ve kira potansiyelini birlikte okuyan, Çanakkale odaklı bir konut danışmanlığı.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 13 }}>
            <button className="ckr-btn ckr-btn-gold" onClick={() => openForm('alici')}>
              İhtiyaç Analizi Yap <ArrowRight size={16} />
            </button>
            <button className="ckr-btn" style={{ background: 'rgba(246,242,232,0.1)', color: '#f3efe4', border: '1px solid rgba(246,242,232,0.3)' }}
              onClick={() => openWhatsApp('Merhaba, Çanakkale Konut Rehberi üzerinden bilgi almak istiyorum.')}>
              <MessageCircle size={16} /> WhatsApp'tan Yazın
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 0', marginTop: 56, borderTop: '1px solid rgba(246,242,232,0.16)', paddingTop: 28 }}>
            {stats.map(([a, b], i) => (
              <div key={a} style={{ paddingInline: i === 0 ? '0 28px' : '28px', borderLeft: i === 0 ? 'none' : '1px solid rgba(246,242,232,0.16)' }}>
                <div style={{ color: '#f6f2e8', fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 600 }}>{a}</div>
                <div style={{ color: 'rgba(240,234,221,0.65)', fontSize: 13 }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
