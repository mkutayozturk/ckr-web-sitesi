import React from 'react';
import { Phone, MapPin, MessageCircle } from 'lucide-react';
import { brand, navLinks } from '../../mock';
import { openWhatsApp } from '../../lib/whatsapp';

export default function Footer() {
  const handleNav = (e, href) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <footer id="iletisim" style={{ background: 'var(--ckr-petrol-deep)', color: 'rgba(240,234,221,0.82)' }}>
      <div className="ckr-container" style={{ paddingTop: 64, paddingBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ckr-gold)', color: '#241c0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 600 }}>ÇKR</span>
              <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, color: '#f6f2e8' }}>{brand.name}</span>
            </div>
            <p style={{ fontSize: 14.5, maxWidth: 300, margin: 0 }}>{brand.tagline}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 14 }}>
              <MapPin size={16} style={{ color: 'var(--ckr-gold-soft)' }} /> {brand.location}
            </div>
          </div>

          <div>
            <h4 style={{ color: '#f6f2e8', fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>Menü</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={(e) => handleNav(e, l.href)} style={{ color: 'rgba(240,234,221,0.8)', textDecoration: 'none', fontSize: 14, transition: 'color .2s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ckr-gold-soft)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,234,221,0.8)')}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ color: '#f6f2e8', fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>İletişim</h4>
            <p style={{ fontSize: 14, margin: '0 0 8px' }}>{brand.person}</p>
            <button className="ckr-btn ckr-btn-gold" style={{ marginTop: 6 }} onClick={() => openWhatsApp('Merhaba, Çanakkale Konut Rehberi üzerinden iletişime geçmek istiyorum.')}>
              <MessageCircle size={16} /> WhatsApp
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 14 }}>
              <Phone size={15} style={{ color: 'var(--ckr-gold-soft)' }} /> 0530 978 19 17
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(245,241,232,0.14)', marginTop: 44, paddingTop: 22, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'rgba(240,234,221,0.6)' }}>
          <span>© {new Date().getFullYear()} {brand.name} · {brand.person}</span>
          <span>Melis, ÇKR\'nin dijital yardımcı asistanıdır.</span>
        </div>
      </div>
    </footer>
  );
}
