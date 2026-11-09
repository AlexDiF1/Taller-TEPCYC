/* Entrada animada de las subpáginas. Si GSAP falla, todo queda visible. */
(() => {
  'use strict';
  if (typeof window.gsap === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    /* En celulares lentos la animación no se frena: el contenido siempre aparece a tiempo */
    gsap.ticker.lagSmoothing(0);
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .fromTo('.sub-nav nav a', { y: -14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08, ease: 'back.out(2.4)', clearProps: 'transform' }, 0.2)
      .from('[data-entra]', { y: 28, autoAlpha: 0, duration: 0.7, stagger: 0.06, clearProps: 'all' }, 0.1)
      .fromTo('[data-carga]', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'steps(14)' }, 0.3);
  } catch (e) { console.warn('[sitio]', e); }
})();
