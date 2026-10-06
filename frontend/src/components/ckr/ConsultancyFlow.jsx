import React from 'react';
import { consultancySteps } from '../../mock';
import useReveal from '../../hooks/useReveal';

export default function ConsultancyFlow() {
  useReveal();
  return (
    <section id="danismanlik" className="ckr-section" style={{ background: 'transparent' }}>
      <div className="ckr-container">
        <div className="ckr-fade-up" style={{ maxWidth: 640, marginBottom: 44 }}>
          <span className="ckr-eyebrow">Danışmanlık Akışı</span>
          <h2 style={{ fontSize: 'clamp(25px, 2.8vw, 34px)', fontWeight: 600, color: '#f3efe6', marginTop: 12, marginBottom: 14 }}>
            Ezberle değil, net bir süreçle ilerliyoruz
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(233,235,228,0.72)', margin: 0 }}>
            Dört adımda; ihtiyacınızdan piyasa gerçeklerine, oradan sağlam bir karara.
          </p>
        </div>

        <div className="ckr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 22 }}>
          {consultancySteps.map((s) => (
            <div key={s.no} className="ckr-card" style={{ padding: 26, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: 'Fraunces, serif', fontSize: 34, fontWeight: 600, color: 'var(--ckr-gold)', opacity: 0.6 }}>{s.no}</span>
              <h3 style={{ fontSize: 19, fontWeight: 600, color: '#f3efe6', margin: '8px 0 10px' }}>{s.title}</h3>
              <p style={{ fontSize: 14.5, color: 'rgba(233,235,228,0.64)', margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
