import { useEffect } from 'react';

// Adds .in-view to elements with .ckr-fade-up when they scroll into view
export default function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.ckr-fade-up');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
