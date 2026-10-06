import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { brand, aboutText } from '../../mock';
import useReveal from '../../hooks/useReveal';

export default function AboutMe() {
  useReveal();
  return (
    <section id="ben-kimim" className="ckr-section" style={{ background: 'var(--ckr-cream)' }}>
      <div className="ckr-container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'center' }}>
          <div className="ckr-fade-up" style={{ position: 'relative' }}>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--ckr-border)', maxWidth: 420 }}>
              <img src={aboutText.portrait} alt={brand.person} style={{ width: '100%', height: 480, objectFit: 'cover', display: 'block' }} />
            </div>
            <div className="ckr-card" style={{ position: 'absolute', bottom: -18, right: 0, padding: '14px 20px', maxWidth: 220 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, color: 'var(--ckr-petrol)', fontSize: 17 }}>{brand.person}</div>
              <div style={{ fontSize: 13, color: 'var(--ckr-gold)' }}>Çanakkale Konut Danışmanı</div>
            </div>
          </div>

          <div className="ckr-fade-up">
            <span className="ckr-eyebrow">Ben Kimim</span>
            <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', fontWeight: 600, color: 'var(--ckr-petrol)', marginTop: 12, marginBottom: 20 }}>
              Ev beğendirmem; doğru kararı birlikte kurarız
            </h2>
            {aboutText.paragraphs.map((p, i) => (
              <p key={i} style={{ fontSize: 16, color: i === 0 ? 'var(--ckr-text)' : 'var(--ckr-muted)', marginTop: 0, marginBottom: 16 }}>{p}</p>
            ))}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 32px', marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--ckr-border)' }}>
              {aboutText.highlights.map((h) => (
                <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--ckr-gold)' }} />
                  <div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, color: 'var(--ckr-petrol)', fontSize: 17 }}>{h.value}</div>
                    <div style={{ fontSize: 13, color: 'var(--ckr-muted)' }}>{h.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
