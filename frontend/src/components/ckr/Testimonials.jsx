import React from 'react';
import { Quote } from 'lucide-react';
import { testimonials } from '../../mock';
import useReveal from '../../hooks/useReveal';

export default function Testimonials() {
  useReveal();
  return (
    <section className="ckr-section" style={{ background: 'transparent' }}>
      <div className="ckr-container">
        <div className="ckr-fade-up" style={{ maxWidth: 640, marginBottom: 40 }}>
          <span className="ckr-eyebrow">Geri Bildirimler</span>
          <h2 style={{ fontSize: 'clamp(25px, 2.8vw, 34px)', fontWeight: 600, color: '#f3efe6', marginTop: 12, marginBottom: 14 }}>
            Kararını veriyle verenlerin deneyimi
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(233,235,228,0.64)', margin: 0 }}>
            Alıcı, satıcı, kiraya veren ve kiracıların süreç sonrası paylaştığı gerçek yorumlar.
          </p>
        </div>

        <div className="ckr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 22 }}>
          {testimonials.map((t) => (
            <div key={t.name} className="ckr-card" style={{ padding: 26, display: 'flex', flexDirection: 'column' }}>
              <Quote size={26} style={{ color: 'var(--ckr-gold)', marginBottom: 12 }} />
              <p style={{ fontSize: 15.5, color: '#e9ebe4', flexGrow: 1, margin: '0 0 20px' }}>“{t.text}”</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid rgba(246,242,232,0.18)', paddingTop: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: '50%', background: 'var(--ckr-petrol)', color: '#f3efe4', fontFamily: 'Fraunces, serif', fontWeight: 600 }}>{t.name.charAt(0)}</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#f3efe6', fontSize: 15 }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ckr-gold)' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
