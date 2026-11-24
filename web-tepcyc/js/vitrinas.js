/* Portada, sección «Tienda»: cada tarjeta pregunta por WhatsApp (así viene en el HTML).
   Si el catálogo del taller tiene productos de esa categoría, la tarjeta pasa a abrir la tienda. */
(() => {
  'use strict';
  const tarjetas = document.querySelectorAll('[data-vitrina]');
  if (!tarjetas.length || !window.fetch) return;
  fetch('/api/productos', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : { productos: [] }))
    .then((datos) => {
      const cuenta = {};
      (datos.productos || []).forEach((p) => { cuenta[p.categoria] = (cuenta[p.categoria] || 0) + 1; });
      tarjetas.forEach((a) => {
        const n = cuenta[a.dataset.vitrina] || 0;
        if (!n) return;
        a.href = `tienda.html?cat=${a.dataset.vitrina}`;
        a.removeAttribute('target');
        a.removeAttribute('rel');
        const texto = a.querySelector('[data-vitrina-texto]');
        if (texto) texto.textContent = n === 1 ? 'Ver 1 en la tienda' : `Ver ${n} en la tienda`;
      });
    })
    .catch(() => { /* sin conexión con el taller: se quedan en WhatsApp */ });
})();
