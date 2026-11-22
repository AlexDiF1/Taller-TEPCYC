/* Animación de la portada original: los arcos entran, el logo se carga de izquierda
   a derecha, el 2 cae encima con un temblor y la barra enciende el botón.
   Sin GSAP o con movimiento reducido, todo queda visible y quieto. */
(() => {
  'use strict';
  if (typeof window.gsap === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ease = 'power2.out', easeIO = 'power1.inOut', carga = 'power1.inOut';
  try {
    gsap.timeline({ defaults: { ease } })
      .fromTo('[data-arcos-izq]', { x: -28, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.4, ease: easeIO }, 0)
      .fromTo('[data-arcos-der]', { x: 28, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.4, ease: easeIO }, 0)
      .fromTo('.h-nav__enlaces a', { y: -8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.08, clearProps: 'transform' }, 0.25)
      .fromTo('[data-linea]', { yPercent: 100 }, { yPercent: 0, duration: 1, stagger: 0.08 }, 0.2)
      .fromTo('[data-sube]', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.15 }, 0.42)
      .fromTo('[data-carga]', { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: carga }, 0.45)
      .fromTo('[data-boton]', { scale: 0.96, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7 }, 1.2)
      .fromTo('[data-logo-base]', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: carga }, 0.05)
      .fromTo('[data-logo-dos]', { scale: 3, rotation: -16, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.32, ease: 'power4.in' }, 1.06)
      .to('[data-logo-hero]', { keyframes: [{ x: -7, y: 5, duration: 0.05 }, { x: 6, y: -4, duration: 0.05 }, { x: -3, y: 2, duration: 0.05 }, { x: 0, y: 0, duration: 0.06 }], ease: 'none' }, 1.38)
      .from('[data-linea-x]', { scaleX: 0, duration: 1.3, stagger: 0.12, ease: easeIO }, 0.6);

    /* En computador el logo se mueve apenas con el mouse */
    if (matchMedia('(hover: hover) and (min-width: 900px)').matches) {
      const logo = document.querySelector('[data-logo-hero]');
      const irX = gsap.quickTo(logo, 'x', { duration: 1.2, ease }), irY = gsap.quickTo(logo, 'y', { duration: 1.2, ease });
      gsap.delayedCall(2.2, () => addEventListener('pointermove', (e) => {
        if (scrollY > innerHeight) return;
        irX((e.clientX / innerWidth - 0.5) * -6);
        irY((e.clientY / innerHeight - 0.5) * -4);
      }, { passive: true }));
    }
  } catch (e) { console.warn('[portada]', e); }
})();
