import React, { useState } from 'react';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { useForms } from '../../context/FormsContext';
import useReveal from '../../hooks/useReveal';

function interpret(type, val) {
  if (val < 34) return type === 'alici'
    ? 'Düşük aciliyet. Acele etmeden bölge ve bütçe çalışması yapalım.'
    : 'Düşük aciliyet. Satışı doğru zamanlamayla planlayabiliriz.';
  if (val < 67) return type === 'alici'
    ? 'Orta düzey motivasyon. Doğru fırsat çıktığında hızlı karar verebilirsiniz.'
    : 'Orta düzey motivasyon. Satılabilir fiyatla pazarlığa açık bir strateji uygun.';
  return type === 'alici'
    ? 'Yüksek aciliyet. Net bütçe ve hızlı aksiyon planı çıkaralım.'
    : 'Yüksek aciliyet. Gerçekçi fiyatla hızlı alıcı bulma stratejisi kuralım.';
}

function Gauge({ type, title, formKey }) {
  const [val, setVal] = useState(50);
  const { openForm } = useForms();
  return (
    <div className="ckr-card" style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <TrendingUp size={18} style={{ color: 'var(--ckr-gold)' }} />
        <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ckr-petrol)', margin: 0 }}>{title}</h3>
      </div>
      <p style={{ fontSize: 14, color: 'var(--ckr-muted)', marginTop: 0, marginBottom: 22 }}>
        {type === 'alici' ? 'Ev alma aciliyetiniz ne düzeyde?' : 'Satış aciliyetiniz ne düzeyde?'}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--ckr-olive)' }}>Düşük</span>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 30, fontWeight: 600, color: 'var(--ckr-petrol)' }}>{val}</span>
        <span style={{ fontSize: 13, color: 'var(--ckr-olive)' }}>Yüksek</span>
      </div>

      <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--ckr-petrol)', cursor: 'pointer' }} />

      <div style={{ background: 'var(--ckr-cream-2)', borderRadius: 10, padding: '14px 16px', marginTop: 18, minHeight: 64 }}>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ckr-text)' }}>{interpret(type, val)}</p>
      </div>

      <button className="ckr-btn ckr-btn-ghost" style={{ marginTop: 18, width: '100%' }} onClick={() => openForm(formKey)}>
        Detaylı Analize Geç <ArrowRight size={16} />
      </button>
    </div>
  );
}

export default function Motivation() {
  useReveal();
  return (
    <section id="motivasyon" className="ckr-section" style={{ background: 'transparent' }}>
      <div className="ckr-container">
        <div className="ckr-fade-up" style={{ maxWidth: 640, marginBottom: 44 }}>
          <span className="ckr-eyebrow">Motivasyon Ölçümü</span>
          <h2 style={{ fontSize: 'clamp(25px, 2.8vw, 34px)', fontWeight: 600, color: 'var(--ckr-petrol)', marginTop: 12, marginBottom: 14 }}>
            Kararın ilk adımı: niyetinizi netleştirin
          </h2>
          <p style={{ fontSize: 17, color: 'var(--ckr-muted)', margin: 0 }}>
            Alıcı ve satıcı motivasyonunuzu kısaca ölçelim. Bu, hangi adımdan başlayacağımızı ve stratejiyi belirler.
          </p>
        </div>
        <div className="ckr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          <Gauge type="alici" title="Alıcı Motivasyonu" formKey="alici" />
          <Gauge type="satici" title="Satıcı Motivasyonu" formKey="satici" />
        </div>
      </div>
    </section>
  );
}
