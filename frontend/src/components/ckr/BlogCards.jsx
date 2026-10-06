import React from 'react';
import { ArrowUpRight, Clock } from 'lucide-react';
import { blogPosts } from '../../mock';
import useReveal from '../../hooks/useReveal';

export default function BlogCards() {
  useReveal();
  return (
    <section id="rehber" className="ckr-section" style={{ background: '#efe9db' }}>
      <div className="ckr-container">
        <div className="ckr-fade-up" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 40 }}>
          <div style={{ maxWidth: 560 }}>
            <span className="ckr-eyebrow">Rehber & Blog</span>
            <h2 style={{ fontSize: 'clamp(25px, 2.8vw, 34px)', fontWeight: 600, color: 'var(--ckr-petrol)', marginTop: 12, marginBottom: 0 }}>
              Kararınızı güçlendiren rehber yazılar
            </h2>
          </div>
          <p style={{ fontSize: 15, color: 'var(--ckr-olive)', maxWidth: 320, margin: 0 }}>
            Piyasayı doğru okumak için sade, uygulanabilir bilgiler.
          </p>
        </div>

        <div className="ckr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 24 }}>
          {blogPosts.map((p) => (
            <article key={p.title} className="ckr-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform .25s ease, box-shadow .25s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 14px 34px rgba(32,59,53,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}>
              <div style={{ height: 190, overflow: 'hidden' }}>
                <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: 22, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ckr-gold)', background: 'rgba(169,139,82,0.12)', padding: '4px 10px', borderRadius: 999 }}>{p.tag}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--ckr-muted)' }}><Clock size={13} /> {p.read}</span>
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ckr-petrol)', margin: '0 0 10px', lineHeight: 1.25 }}>{p.title}</h3>
                <p style={{ fontSize: 14.5, color: 'var(--ckr-muted)', margin: 0, flexGrow: 1 }}>{p.excerpt}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 14, fontWeight: 600, color: 'var(--ckr-petrol)' }}>
                  Yazıyı oku <ArrowUpRight size={16} />
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
