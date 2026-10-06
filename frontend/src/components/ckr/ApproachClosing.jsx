import React from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useForms } from '../../context/FormsContext';
import { openWhatsApp } from '../../lib/whatsapp';
import useReveal from '../../hooks/useReveal';

const principles = [
  'İlan fiyatı ile gerçekleşebilir satış fiyatı aynı şey değildir.',
  'Satılabilir fiyat, alıcının gerçekten ilgi gösterdiği fiyattır.',
  'Alıcı piyasasında fiyatı satıcı değil, talep belirler.',
  'ÇKR ezbere ilan yorumlamaz; karar zemini oluşturur.',
];

export default function ApproachClosing() {
  useReveal();
  const { openForm } = useForms();
  return (
    <section className="ckr-section" style={{ background: 'transparent' }}>
      <div className="ckr-container">
        <div style={{ background: 'rgba(16,33,34,0.66)', backdropFilter: 'blur(14px) saturate(1.1)', WebkitBackdropFilter: 'blur(14px) saturate(1.1)', border: '1px solid rgba(246,242,232,0.16)', borderRadius: 22, padding: 'clamp(28px, 4vw, 54px)' }}>
        <div className="ckr-fade-up" style={{ maxWidth: 760 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: 12, fontWeight: 600, color: 'var(--ckr-gold-soft)' }}>ÇKR Yaklaşımı</span>
          <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 40px)', fontWeight: 600, color: '#f6f2e8', marginTop: 14, marginBottom: 30, lineHeight: 1.15 }}>
            Alıcı ve satıcıyı piyasa gerçekleriyle buluşturmak
          </h2>
        </div>

        <div className="ckr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 40 }}>
          {principles.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '18px 20px', background: 'rgba(245,241,232,0.06)', border: '1px solid rgba(245,241,232,0.14)', borderRadius: 12 }}>
              <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, color: 'var(--ckr-gold-soft)', fontSize: 18 }}>0{i + 1}</span>
              <p style={{ margin: 0, color: 'rgba(240,234,221,0.92)', fontSize: 15.5 }}>{p}</p>
            </div>
          ))}
        </div>

        <div className="ckr-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <button className="ckr-btn ckr-btn-gold" onClick={() => openForm('alici')}>
            İhtiyaç Analizine Başla <ArrowRight size={17} />
          </button>
          <button className="ckr-btn" style={{ background: 'transparent', color: '#f3efe4', border: '1px solid rgba(245,241,232,0.35)' }}
            onClick={() => openWhatsApp('Merhaba, ÇKR yaklaşımı hakkında konuşmak istiyorum.')}>
            <MessageCircle size={17} /> Konuşalım
          </button>
        </div>
        </div>
      </div>
    </section>
  );
}
