/* Comportamiento compartido por todas las páginas */
(() => {
  'use strict';
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    /* En el inicio la barra es transparente arriba y se vuelve sólida al bajar;
       en las demás páginas siempre es sólida. */
    if (nav.hasAttribute('data-nav-inicio')) {
      /* La portada trae su propio menú: la barra fija aparece al pasarla */
      const portada = document.querySelector('.hero');
      const marcar = () => nav.classList.toggle('solida', scrollY > (portada ? portada.offsetHeight - 80 : 24));
      marcar();
      addEventListener('scroll', marcar, { passive: true });
    } else {
      nav.classList.add('solida');
    }
  }

  /* Video del logo: con movimiento reducido se muestra el logo quieto (poster) */
  const video = document.querySelector('[data-video-logo]');
  if (video && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.removeAttribute('autoplay');
    video.pause();
  }
})();
