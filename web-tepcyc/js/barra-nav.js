/* Barra de navegación en celular: la opción activa se abre en una cápsula */
(() => {
  'use strict';
  const nav = document.querySelector('[data-barra-nav]');
  if (!nav) return;
  const enlaces = [...nav.querySelectorAll('a')];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = enlaces.findIndex((a) => a.hasAttribute('aria-current'));

  function activar(i) {
    if (i === actual) return;
    actual = i;
    enlaces.forEach((a, n) => { if (n === i) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  /* En la portada: Inicio y Visítanos se mueven dentro de la misma página */
  enlaces.forEach((a, i) => a.addEventListener('click', () => { if (a.getAttribute('href').startsWith('#')) activar(i); }));
  const visita = document.getElementById('visitanos');
  const iVisita = enlaces.findIndex((a) => a.getAttribute('href') === '#visitanos');
  if (visita && iVisita >= 0 && 'IntersectionObserver' in window) {
    new IntersectionObserver((es) => activar(es[0].isIntersecting ? iVisita : 0), { rootMargin: '-50% 0px -50% 0px' }).observe(visita);
  }

  /* Mientras se escribe, la barra se aparta para no estorbar con el teclado */
  const escribe = (el) => el.matches && el.matches('input:not([type=radio]):not([type=checkbox]):not([type=hidden]),textarea');
  document.addEventListener('focusin', (e) => { if (escribe(e.target)) nav.classList.add('oculta'); });
  document.addEventListener('focusout', (e) => { if (escribe(e.target)) nav.classList.remove('oculta'); });

  /* Entrada desde abajo */
  if (window.gsap && !RM) gsap.from(nav, { yPercent: 170, duration: 0.8, delay: 0.7, ease: 'power4.out', clearProps: 'transform' });
})();
