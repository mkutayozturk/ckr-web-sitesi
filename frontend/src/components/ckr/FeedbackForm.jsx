import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import useReveal from '../../hooks/useReveal';

export default function FeedbackForm() {
  useReveal();
  const [values, setValues] = useState({ ad: '', rol: '', mesaj: '' });
  const [sent, setSent] = useState(false);
  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!values.ad || !values.mesaj) return;
    // Frontend-only: store locally as a mock submission
    try {
      const prev = JSON.parse(localStorage.getItem('ckr_feedback') || '[]');
      prev.push({ ...values, date: new Date().toISOString() });
      localStorage.setItem('ckr_feedback', JSON.stringify(prev));
    } catch (_) {}
    setSent(true);
  };

  return (
    <section className="ckr-section" style={{ background: 'transparent' }}>
      <div className="ckr-container">
        <div className="ckr-fade-up ckr-card" style={{ padding: 'clamp(24px, 4vw, 44px)', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className="ckr-eyebrow">Geri Bildirim</span>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 600, color: 'var(--ckr-petrol)', marginTop: 12, marginBottom: 10 }}>
              Deneyiminizi paylaşın
            </h2>
            <p style={{ fontSize: 15.5, color: 'var(--ckr-muted)', margin: 0 }}>
              Görüş ve önerileriniz, rehberliği daha da iyileştirmemize yardımcı olur.
            </p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle2 size={44} style={{ color: 'var(--ckr-gold)' }} />
              <h3 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ckr-petrol)', margin: '12px 0 6px' }}>Teşekkürler!</h3>
              <p style={{ fontSize: 15, color: 'var(--ckr-muted)' }}>Geri bildiriminiz alındı.</p>
              <button className="ckr-btn ckr-btn-ghost" style={{ marginTop: 10 }} onClick={() => { setSent(false); setValues({ ad: '', rol: '', mesaj: '' }); }}>Yeni Geri Bildirim</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                <div>
                  <label className="ckr-label">Ad Soyad <span style={{ color: 'var(--ckr-gold)' }}>*</span></label>
                  <input className="ckr-input" value={values.ad} onChange={(e) => set('ad', e.target.value)} />
                </div>
                <div>
                  <label className="ckr-label">Rolünüz</label>
                  <select className="ckr-select" value={values.rol} onChange={(e) => set('rol', e.target.value)}>
                    <option value="">Seçiniz</option>
                    {['Alıcı', 'Satıcı', 'Kiraya Veren', 'Kiracı'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 18 }}>
                <label className="ckr-label">Mesajınız <span style={{ color: 'var(--ckr-gold)' }}>*</span></label>
                <textarea className="ckr-textarea" rows={4} value={values.mesaj} onChange={(e) => set('mesaj', e.target.value)} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button type="submit" className="ckr-btn ckr-btn-primary"><Send size={16} /> Gönder</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
