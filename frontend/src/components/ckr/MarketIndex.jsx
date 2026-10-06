import React, { useState } from 'react';
import { Activity, Home, TrendingUp } from 'lucide-react';
import { marketMonths } from '../../mock';
import useReveal from '../../hooks/useReveal';

export default function MarketIndex() {
  useReveal();
  const [idx, setIdx] = useState(marketMonths.length - 1);
  const d = marketMonths[idx];

  const cardHead = (icon, label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      {icon}
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ckr-olive)', letterSpacing: '0.02em' }}>{label}</span>
    </div>
  );

  // Shared row heights keep year / title / main / footer aligned across the 3 cards
  const cardStyle = { padding: 26, background: 'var(--ckr-cream-card)', border: '1px solid var(--ckr-border)', borderRadius: 14, display: 'flex', flexDirection: 'column' };
  const yearRow = { fontSize: 13, fontWeight: 600, color: 'var(--ckr-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', height: 20 };
  const titleRow = { minHeight: 52, display: 'flex', alignItems: 'center' };
  const mainRow = { minHeight: 118, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '1px solid var(--ckr-border)', borderBottom: '1px solid var(--ckr-border)', padding: '16px 0', margin: '8px 0 14px' };
  const footRow = { fontSize: 13, color: 'var(--ckr-muted)', minHeight: 40 };

  return (
    <section id="piyasa" className="ckr-section" style={{ background: '#efe9db' }}>
      <div className="ckr-container">
        <div className="ckr-fade-up" style={{ maxWidth: 640, marginBottom: 40 }}>
          <span className="ckr-eyebrow">ÇKR Piyasa Endeksi</span>
          <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', fontWeight: 600, color: 'var(--ckr-petrol)', marginTop: 12, marginBottom: 14 }}>
            {d.month} {d.year} çanakkale konut piyasası
          </h2>
          <p style={{ fontSize: 16.5, color: 'var(--ckr-olive)', margin: 0 }}>
            Güncel satış adetleri, ipotek dağılımı ve kira artış oranıyla piyasanın gerçek yönü.
          </p>
        </div>

        <div className="ckr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 22 }}>
          {/* Card 1 - Piyasa Endeksi */}
          <div style={cardStyle}>
            <div style={yearRow}>{d.year}</div>
            <div style={titleRow}>{cardHead(<Activity size={18} style={{ color: 'var(--ckr-petrol)' }} />, 'Piyasa Endeksi')}</div>
            <div style={mainRow}>
              <span style={{ fontFamily: 'Fraunces, serif', fontSize: 30, fontWeight: 600, color: 'var(--ckr-petrol)', lineHeight: 1.1 }}>{d.status}</span>
            </div>
            <div style={footRow}>{d.statusNote}</div>
          </div>

          {/* Card 2 - Satış Adetleri */}
          <div style={cardStyle}>
            <div style={yearRow}>{d.month} {d.year}</div>
            <div style={titleRow}>{cardHead(<Home size={18} style={{ color: 'var(--ckr-petrol)' }} />, 'Konut Satış Adetleri')}</div>
            <div style={mainRow}>
              <span style={{ fontFamily: 'Fraunces, serif', fontSize: 34, fontWeight: 600, color: 'var(--ckr-petrol)', lineHeight: 1 }}>{d.totalSales} <span style={{ fontSize: 15, fontFamily: 'Inter, sans-serif', color: 'var(--ckr-muted)' }}>ad.</span></span>
              <div style={{ display: 'flex', gap: 22, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--ckr-olive)', fontWeight: 600 }}>İpoteksiz</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ckr-text)' }}>{d.salesIpoteksiz}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--ckr-olive)', fontWeight: 600 }}>İpotekli</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ckr-text)' }}>{d.salesIpotekli}</div>
                </div>
              </div>
            </div>
            <div style={footRow}>Toplam içinde ipotekli payı düşük; nakit alıcı ağırlıklı.</div>
          </div>

          {/* Card 3 - Kira Artış Oranı */}
          <div style={cardStyle}>
            <div style={yearRow}>{d.month} {d.year}</div>
            <div style={titleRow}>{cardHead(<TrendingUp size={18} style={{ color: 'var(--ckr-petrol)' }} />, 'Konut Kira Artış Oranı')}</div>
            <div style={mainRow}>
              <span style={{ fontFamily: 'Fraunces, serif', fontSize: 34, fontWeight: 600, color: 'var(--ckr-petrol)', lineHeight: 1 }}>{d.rentIncrease}</span>
              <span style={{ fontSize: 13, color: 'var(--ckr-olive)', marginTop: 10 }}>12 aylık ortalama artış</span>
            </div>
            <div style={footRow}>Kira artışı, enflasyon ve talep dengesine göre seyrediyor.</div>
          </div>
        </div>

        {/* Ay değiştirme butonları — kartların altında */}
        <div className="ckr-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24, justifyContent: 'center' }}>
          {marketMonths.map((m, i) => (
            <button key={m.id} onClick={() => setIdx(i)}
              style={{
                padding: '9px 18px', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                transition: 'all .2s ease',
                border: '1px solid ' + (i === idx ? 'var(--ckr-petrol)' : 'var(--ckr-border)'),
                background: i === idx ? 'var(--ckr-petrol)' : 'transparent',
                color: i === idx ? '#f3efe4' : 'var(--ckr-olive)',
              }}>
              {m.month} {m.year}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
