import React from 'react';
import { Quote } from 'lucide-react';
import { testimonials } from '../../mock';

export default function Testimonials() {
  const marqueeItems = [...testimonials, ...testimonials];

  return (
    <section className="ckr-testimonial-strip" aria-label="Müşteri geri bildirimleri">
      <div className="ckr-testimonial-marquee">
        <div className="ckr-testimonial-track">
          {marqueeItems.map((t, i) => (
            <article key={`${t.name}-${i}`} className="ckr-testimonial-card">
              <Quote size={20} style={{ color: 'var(--ckr-gold)', flexShrink: 0 }} />
              <p>“{t.text}”</p>
              <div className="ckr-testimonial-person">
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
