import React from 'react';
import { ArrowRight, MessageCircle, ShieldCheck } from 'lucide-react';
import { brand } from '../../mock';
import { useForms } from '../../context/FormsContext';
import { openWhatsApp } from '../../lib/whatsapp';

const HERO_IMG = 'https://images.unsplash.com/photo-1655918986943-add6734678bb';

export default function Hero() {
  const { openForm } = useForms();

  return (
    <section id="top" style={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${HERO_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(22,41,42,0.72) 0%, rgba(22,41,42,0.68) 45%, rgba(22,41,42,0.8) 100%)' }} />

      <div className="ckr-container" style={{ position: 'relative', zIndex: 2, paddingTop: 120, paddingBottom: 80 }}>
        <div style={{ maxWidth: 720 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, background: 'rgba(245,241,232,0.12)', border: '1px solid rgba(245,241,232,0.22)', color: '#e9e3d4', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <ShieldCheck size={15} /> {brand.location} · {brand.short}
          </span>

          <h1 style={{ color: '#f6f2e8', fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 600, lineHeight: 1.08, marginTop: 24, marginBottom: 20 }}>
            Konut kararınızı ilan ezberiyle değil,<br />
            <span style={{ color: 'var(--ckr-gold-soft)', fontStyle: 'italic' }}>piyasa gerçekleriyle</span> verin.
          </h1>

          <p style={{ color: 'rgba(240,234,221,0.9)', fontSize: 'clamp(16px, 2vw, 19px)', maxWidth: 600, marginBottom: 34 }}>
            Alıcı, satıcı, kiraya veren ve kiracılar için; bölge, bütçe, satılabilir fiyat ve kira potansiyelini birlikte okuyan çanakkale odaklı bir konut danışmanlığı.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <button className="ckr-btn ckr-btn-gold" onClick={() => openForm('alici')}>
              İhtiyaç Analizi Yap <ArrowRight size={17} />
            </button>
            <button className="ckr-btn" style={{ background: 'rgba(245,241,232,0.1)', color: '#f3efe4', border: '1px solid rgba(245,241,232,0.3)' }}
              onClick={() => openWhatsApp('Merhaba, Çanakkale Konut Rehberi üzerinden bilgi almak istiyorum.')}>
              <MessageCircle size={17} /> WhatsApp'tan Yazın
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 40px', marginTop: 48 }}>
            {[['Satılabilir fiyat', 'ilan değil, talep belirler'], ['Karar zemini', 'ezber değil, veri'], ['Çanakkale', 'odaklı bölge bilgisi']].map(([a, b]) => (
              <div key={a} style={{ borderLeft: '2px solid var(--ckr-gold)', paddingLeft: 14 }}>
                <div style={{ color: '#f6f2e8', fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600 }}>{a}</div>
                <div style={{ color: 'rgba(240,234,221,0.75)', fontSize: 13.5 }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
