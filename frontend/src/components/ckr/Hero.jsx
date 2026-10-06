import React from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { brand } from '../../mock';
import { useForms } from '../../context/FormsContext';
import { openWhatsApp } from '../../lib/whatsapp';

const HERO_IMG = 'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/3772b21f9b6a5b2f_%C3%87ANAKKALE%20L%C4%B0MAN.png';
const PORTRAIT = 'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/c8441e999f910cd3_KAR%C5%9EILAMA%20RESM%C4%B0.png';

const badges = [
  'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/14582827b8b48269_1.png',
  'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/36d3aaf611e6c32e_2.png',
  'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/8cfd73b7d6e5274a_3.png',
  'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/9f148cf14c5934ce_4.png',
];

export default function Hero() {
  const { openForm } = useForms();

  return (
    <section id="top" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      {/* Fixed background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${HERO_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(95deg, rgba(18,36,38,0.78) 0%, rgba(18,36,38,0.55) 40%, rgba(18,36,38,0.22) 70%, rgba(18,36,38,0.1) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(18,36,38,0.5) 0%, rgba(18,36,38,0) 18%, rgba(18,36,38,0) 80%, rgba(18,36,38,0.35) 100%)' }} />

      {/* Portrait (desktop) */}
      <img
        src={PORTRAIT}
        alt={brand.person}
        className="hidden lg:block"
        style={{ position: 'absolute', right: 'max(16px, calc((100vw - 1180px) / 2))', bottom: 0, height: '90vh', maxHeight: 820, width: 'auto', objectFit: 'contain', objectPosition: 'bottom', zIndex: 2, filter: 'drop-shadow(0 20px 45px rgba(0,0,0,0.4))', pointerEvents: 'none' }}
      />

      {/* Content */}
      <div className="ckr-container" style={{ position: 'relative', zIndex: 3, paddingTop: 120, paddingBottom: 90 }}>
        <div style={{
          maxWidth: 640,
          background: 'rgba(16,33,34,0.34)',
          backdropFilter: 'blur(18px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.15)',
          border: '1px solid rgba(246,242,232,0.18)',
          borderRadius: 20,
          padding: 'clamp(26px, 3.5vw, 46px)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 15px', borderRadius: 999, background: 'rgba(246,242,232,0.1)', border: '1px solid rgba(246,242,232,0.24)', color: '#ece6d8', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {brand.location} · Konut Danışmanlığı
          </span>

          <h1 style={{ color: '#f6f2e8', fontSize: 'clamp(31px, 4vw, 50px)', lineHeight: 1.12, margin: '22px 0 20px', fontWeight: 600 }}>
            Konut kararınızı ilan ezberiyle değil,{' '}
            <span style={{ color: 'var(--ckr-gold-soft)', fontStyle: 'italic', fontWeight: 500 }}>piyasa gerçekleriyle</span> verin.
          </h1>

          <p style={{ color: 'rgba(240,234,221,0.9)', fontSize: 'clamp(15.5px, 1.5vw, 18px)', lineHeight: 1.6, maxWidth: 560, margin: '0 0 30px' }}>
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

          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 34, paddingTop: 26, borderTop: '1px solid rgba(246,242,232,0.16)' }}>
            {badges.map((b, i) => (
              <span key={i} style={{
                width: 76, height: 76, borderRadius: '50%', background: '#f7f4ec',
                border: '1px solid rgba(246,242,232,0.5)', boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                <img src={b} alt="" style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
