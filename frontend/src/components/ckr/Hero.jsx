import React from 'react';
import { brand } from '../../mock';
import { useForms } from '../../context/FormsContext';

const HERO_IMG = 'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/3772b21f9b6a5b2f_%C3%87ANAKKALE%20L%C4%B0MAN.png';
const PORTRAIT = 'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/c8441e999f910cd3_KAR%C5%9EILAMA%20RESM%C4%B0.png';

const badges = [
  '/badges/badge-1.png',
  '/badges/badge-2.png',
  '/badges/badge-3.png',
  '/badges/badge-4.png',
];

export default function Hero() {
  const { openForm } = useForms();

  return (
    <section id="top" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      {/* Fixed background (no dark overlay — keeps the image tone consistent across the page) */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${HERO_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />

      {/* Content */}
      <div className="ckr-site" style={{ position: 'relative', zIndex: 3, paddingTop: 116, paddingBottom: 56 }}>
        {/* Wide frosted glass panel that also covers the portrait */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(16,33,34,0.34)',
          backdropFilter: 'blur(18px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.15)',
          border: '1px solid rgba(246,242,232,0.18)',
          borderRadius: 24,
          boxShadow: '0 24px 70px rgba(0,0,0,0.3)',
          padding: 'clamp(26px, 3.4vw, 48px)',
          minHeight: 540,
        }}>
          {/* Portrait inside the panel (desktop) */}
          <img
            src={PORTRAIT}
            alt={brand.person}
            className="hidden lg:block"
            style={{ position: 'absolute', right: 'clamp(28px, 5vw, 78px)', bottom: 0, height: '102%', maxHeight: 640, width: 'auto', objectFit: 'contain', objectPosition: 'bottom right', filter: 'drop-shadow(0 16px 36px rgba(0,0,0,0.42))', pointerEvents: 'none' }}
          />

          <div className="relative z-[2] lg:max-w-[60%]">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 15px', borderRadius: 999, background: 'rgba(246,242,232,0.1)', border: '1px solid rgba(246,242,232,0.24)', color: '#ece6d8', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              REMAX CORNER - Gayrimenkul Danışmanı
            </span>

            <h1 style={{ color: '#f6f2e8', fontSize: 'clamp(30px, 3.6vw, 48px)', lineHeight: 1.12, margin: '22px 0 20px', fontWeight: 600 }}>
              Konut kararınızı ilan ezberiyle değil,{' '}
              <span style={{ color: 'var(--ckr-gold-soft)', fontStyle: 'italic', fontWeight: 500 }}>piyasa gerçekleriyle</span> verin.
            </h1>

            <p style={{ color: 'rgba(240,234,221,0.9)', fontSize: 'clamp(15.5px, 1.4vw, 18px)', lineHeight: 1.6, maxWidth: 540, margin: '0 0 30px' }}>
              Çanakkale'de evinizi satarken, satın alırken veya kiralarken doğru kararı vermeniz için gerçek piyasa değerlerini, bölgesel fırsatları ve alıcı davranışlarını birlikte değerlendiriyoruz.
            </p>

            <div className="ckr-hero-actions">
              <button className="ckr-btn ckr-hero-action ckr-hero-action-black" onClick={() => openForm('satici', 'hero-satici-kiraya-vermek')}>
                Mülkümü Satmak/Kiraya Vermek İstiyorum
              </button>
              <button className="ckr-btn ckr-hero-action ckr-hero-action-white"
                onClick={() => openForm('alici', 'hero-alici-kiralayan')}>
                Mülk Satın Almak/Kiralamak İstiyorum
              </button>
              <button className="ckr-btn ckr-hero-action ckr-hero-action-brown" onClick={() => openForm('satici', 'hero-deger-tespiti')}>
                Hemen Değer Tespiti İste!
              </button>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 32, paddingTop: 26, borderTop: '1px solid rgba(246,242,232,0.16)' }}>
              {badges.map((b, i) => (
                <span key={i} style={{
                  width: 112, height: 112, borderRadius: '50%', background: 'transparent',
                  border: '0', boxShadow: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
                }}>
                  <img src={b} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.34))' }} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
