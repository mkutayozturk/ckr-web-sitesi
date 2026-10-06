import React, { useState, useEffect } from 'react';
import { Menu, X, MessageCircle } from 'lucide-react';
import { brand, navLinks } from '../../mock';
import { openWhatsApp } from '../../lib/whatsapp';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = scrolled || open;
  const txt = solid ? 'var(--ckr-text)' : 'rgba(246,242,232,0.92)';
  const brandColor = solid ? 'var(--ckr-petrol)' : '#f6f2e8';
  const subColor = solid ? 'var(--ckr-muted)' : 'rgba(246,242,232,0.6)';

  const handleNav = (e, href) => {
    e.preventDefault();
    setOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      transition: 'background-color .3s ease, box-shadow .3s ease, border-color .3s ease',
      backgroundColor: solid ? 'rgba(246,243,236,0.9)' : 'transparent',
      backdropFilter: solid ? 'blur(12px)' : 'none',
      WebkitBackdropFilter: solid ? 'blur(12px)' : 'none',
      borderBottom: solid ? '1px solid var(--ckr-border)' : '1px solid transparent',
    }}>
      <div className="ckr-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 74 }}>
        {/* Brand lockup */}
        <a href="#top" onClick={(e) => handleNav(e, '#top')} style={{ display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none', minWidth: 0 }}>
          <span style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 42, height: 42, borderRadius: 10,
            background: solid ? 'var(--ckr-petrol)' : 'rgba(246,242,232,0.12)',
            border: solid ? 'none' : '1px solid rgba(246,242,232,0.35)',
            color: solid ? '#f3efe4' : '#f6f2e8', fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 16, letterSpacing: '0.02em',
            transition: 'background .3s ease, color .3s ease, border-color .3s ease',
          }}>ÇKR</span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
            <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 17, color: brandColor, whiteSpace: 'nowrap', transition: 'color .3s ease' }}>{brand.name}</span>
            <span style={{ fontSize: 11.5, color: subColor, letterSpacing: '0.06em', whiteSpace: 'nowrap', transition: 'color .3s ease' }}>{brand.person}</span>
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex" style={{ alignItems: 'center', gap: 30 }}>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={(e) => handleNav(e, l.href)}
              style={{ fontSize: 14, fontWeight: 500, color: txt, textDecoration: 'none', transition: 'color .2s ease', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ckr-gold)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = txt)}>{l.label}</a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex">
          <button
            className={solid ? 'ckr-btn ckr-btn-primary' : 'ckr-btn'}
            style={solid ? {} : { background: 'rgba(246,242,232,0.12)', color: '#f3efe4', border: '1px solid rgba(246,242,232,0.35)' }}
            onClick={() => openWhatsApp('Merhaba, Çanakkale Konut Rehberi üzerinden bilgi almak istiyorum.')}>
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>

        {/* Mobile toggle */}
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menü"
          style={{ background: 'transparent', border: 'none', color: brandColor, cursor: 'pointer', padding: 6 }}>
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden" style={{ background: 'rgba(246,243,236,0.98)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--ckr-border)' }}>
          <div className="ckr-container" style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8, paddingBottom: 18 }}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => handleNav(e, l.href)}
                style={{ fontSize: 16, fontWeight: 500, color: 'var(--ckr-text)', textDecoration: 'none', padding: '13px 4px', borderBottom: '1px solid var(--ckr-border-soft)' }}>{l.label}</a>
            ))}
            <button className="ckr-btn ckr-btn-primary" style={{ marginTop: 14 }} onClick={() => openWhatsApp('Merhaba, Çanakkale Konut Rehberi üzerinden bilgi almak istiyorum.')}>
              <MessageCircle size={16} /> WhatsApp ile iletişim
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
