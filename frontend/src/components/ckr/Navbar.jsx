import React, { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { brand, navLinks } from '../../mock';
import { openWhatsApp } from '../../lib/whatsapp';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (e, href) => {
    e.preventDefault();
    setOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'background-color .3s ease, box-shadow .3s ease, border-color .3s ease',
        backgroundColor: scrolled ? 'rgba(245,241,232,0.92)' : 'rgba(245,241,232,0)',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--ckr-border)' : '1px solid transparent',
      }}
    >
      <div className="ckr-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        <a href="#top" onClick={(e) => handleNav(e, '#top')} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, background: 'var(--ckr-petrol)',
            color: '#f3efe4', fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 17,
          }}>ÇKR</span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 16, color: 'var(--ckr-petrol)' }}>{brand.name}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ckr-muted)', letterSpacing: '0.04em' }}>{brand.person}</span>
          </span>
        </a>

        <nav className="hidden lg:flex" style={{ alignItems: 'center', gap: 28 }}>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={(e) => handleNav(e, l.href)}
              style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ckr-text)', textDecoration: 'none', transition: 'color .2s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ckr-gold)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ckr-text)')}
            >{l.label}</a>
          ))}
        </nav>

        <div className="hidden lg:flex">
          <button className="ckr-btn ckr-btn-primary" onClick={() => openWhatsApp('Merhaba, Çanakkale Konut Rehberi üzerinden bilgi almak istiyorum.')}>
            <Phone size={16} /> WhatsApp
          </button>
        </div>

        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menü"
          style={{ background: 'transparent', border: 'none', color: 'var(--ckr-petrol)', cursor: 'pointer', padding: 6 }}>
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden" style={{ background: 'rgba(245,241,232,0.98)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--ckr-border)' }}>
          <div className="ckr-container" style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10, paddingBottom: 18 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => handleNav(e, l.href)}
                style={{ fontSize: 16, fontWeight: 500, color: 'var(--ckr-text)', textDecoration: 'none', padding: '12px 4px', borderBottom: '1px solid rgba(228,221,205,0.6)' }}>{l.label}</a>
            ))}
            <button className="ckr-btn ckr-btn-primary" style={{ marginTop: 12 }} onClick={() => openWhatsApp('Merhaba, Çanakkale Konut Rehberi üzerinden bilgi almak istiyorum.')}>
              <Phone size={16} /> WhatsApp ile iletişim
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
