/* Barra de navegación en celular */
(() => {
  'use strict';
  const nav = document.querySelector('[data-barra-nav]');
  if (!nav) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Mientras se escribe, la barra se aparta para no estorbar con el teclado */
  const escribe = (el) => el.matches && el.matches('input:not([type=radio]):not([type=checkbox]):not([type=hidden]),textarea');
  document.addEventListener('focusin', (e) => { if (escribe(e.target)) nav.classList.add('oculta'); });
  document.addEventListener('focusout', (e) => { if (escribe(e.target)) nav.classList.remove('oculta'); });

  /* Entra desde abajo solo la primera vez: al cambiar de página se queda quieta */
  let yaVista = false;
  try { yaVista = sessionStorage.getItem('tepcyc-barra') === '1'; sessionStorage.setItem('tepcyc-barra', '1'); } catch (e) { /* sin almacenamiento: anima siempre */ }
  if (window.gsap && !RM && !yaVista) gsap.from(nav, { yPercent: 170, duration: 0.8, delay: 0.7, ease: 'power4.out', clearProps: 'transform' });
})();
