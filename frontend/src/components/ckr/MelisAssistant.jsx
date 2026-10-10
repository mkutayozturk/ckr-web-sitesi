import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ArrowRight } from 'lucide-react';
import { melis } from '../../mock';
import { useForms } from '../../context/FormsContext';

export default function MelisAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: 'melis', text: melis.greeting }]);
  const { openForm } = useForms();
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  const choose = (opt) => {
    setMessages((m) => [...m, { from: 'user', text: opt.label }, { from: 'melis', text: opt.reply, cta: opt.target }]);
  };

  return (
    <>
      {/* Launcher */}
      <button onClick={() => setOpen(!open)} aria-label="Melis asistan"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 60,
          width: 62, height: 62, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--ckr-petrol)', color: '#f3efe4',
          boxShadow: '0 10px 28px rgba(22,41,42,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
        {open ? <X size={26} /> : <MessageCircle size={26} />}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 98, right: 24, zIndex: 60,
          width: 'min(360px, calc(100vw - 32px))', height: 'min(520px, calc(100vh - 140px))',
          background: 'var(--ckr-cream-card)', border: '1px solid var(--ckr-border)', borderRadius: 16,
          boxShadow: '0 20px 48px rgba(22,41,42,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: 'var(--ckr-petrol)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--ckr-gold)', color: '#241c0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 18 }}>M</span>
            <div>
              <div style={{ color: '#f6f2e8', fontWeight: 600, fontSize: 16 }}>{melis.name}</div>
              <div style={{ color: 'rgba(240,234,221,0.7)', fontSize: 12 }}>{melis.role}</div>
            </div>
          </div>

          {/* Body */}
          <div ref={bodyRef} style={{ flexGrow: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 12, fontSize: 14.5, lineHeight: 1.5,
                  background: m.from === 'user' ? 'var(--ckr-petrol)' : 'var(--ckr-cream-2)',
                  color: m.from === 'user' ? '#f3efe4' : 'var(--ckr-text)',
                  borderTopRightRadius: m.from === 'user' ? 2 : 12,
                  borderTopLeftRadius: m.from === 'user' ? 12 : 2,
                }}>{m.text}</div>
                {m.cta && (
                  <button className="ckr-btn ckr-btn-gold" style={{ marginTop: 8, fontSize: 13.5, padding: '9px 16px' }}
                    onClick={() => { openForm(m.cta, `melis-${m.cta}`); setOpen(false); }}>
                    Formu Aç <ArrowRight size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Options */}
          <div style={{ borderTop: '1px solid var(--ckr-border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--ckr-muted)', marginBottom: 2 }}>Bir seçenek seçin:</div>
            {melis.options.map((o) => (
              <button key={o.key} onClick={() => choose(o)}
                style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  border: '1px solid var(--ckr-border)', background: '#fff', color: 'var(--ckr-text)', fontSize: 14, fontWeight: 500,
                  transition: 'all .18s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ckr-petrol)'; e.currentTarget.style.background = 'var(--ckr-cream)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ckr-border)'; e.currentTarget.style.background = '#fff'; }}>
                {o.label}
              </button>
            ))}
            <div style={{ fontSize: 11, color: 'var(--ckr-muted)', textAlign: 'center', marginTop: 4 }}>{melis.disclaimer}</div>
          </div>
        </div>
      )}
    </>
  );
}
