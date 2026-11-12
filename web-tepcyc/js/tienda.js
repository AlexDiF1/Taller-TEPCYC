/* Tienda: filtros, carrito guardado en el navegador y pedido por WhatsApp */
(() => {
  'use strict';
  const WHATSAPP = '573180223184';
  const CLAVE = 'tepcyc-carrito';
  const d = document, $ = (s) => d.querySelector(s);
  const datos = window.TIENDA || { productos: [] };
  const catalogo = new Map(datos.productos.map((p) => [p.id, p]));
  const CATS = {
    nuevas: { sello: 'Nueva', etiqueta: 'consola nueva', garantia: 'Garantía de 1 año' },
    usadas: { sello: 'Usada', etiqueta: 'consola usada', garantia: 'Garantía de 4 meses' },
    controles: { sello: 'Control', etiqueta: 'control', garantia: '' }
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hayGsap = typeof window.gsap !== 'undefined' && !RM;
  const pesos = (n) => '$' + Number(n).toLocaleString('es-CO');
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DIBUJO = '<svg viewBox="0 0 120 80" aria-hidden="true"><path d="M34 14h52c13 0 20 10 23 25 3 14 3 27-6 29-8 2-14-8-20-16H37c-6 8-12 18-20 16-9-2-9-15-6-29 3-15 10-25 23-25Z"/><path d="M36 26v14M29 33h14"/><circle cx="84" cy="28" r="2"/><circle cx="92" cy="36" r="2"/></svg>';

  /* Carrito: { idProducto: cantidad } */
  let carrito = {};
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    Object.entries(guardado).forEach(([id, c]) => { if (catalogo.has(id) && Number.isInteger(c) && c > 0) carrito[id] = c; });
  } catch (e) { carrito = {}; }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(carrito)); } catch (e) { /* sin almacenamiento: sigue en memoria */ } };

  const caja = $('[data-productos]'), filtros = $('[data-filtros]'), dialogo = $('[data-carrito]'), botonCarrito = $('[data-abrir-carrito]');
  const lineas = $('[data-lineas]'), vacio = $('[data-vacio]'), pie = $('[data-pie]'), enviar = $('[data-enviar]');

  if (datos.ejemplo) $('[data-aviso-ejemplo]').hidden = false;

  function pintarProductos(cat) {
    const lista = datos.productos.filter((p) => cat === 'todos' || p.categoria === cat);
    if (!lista.length) {
      caja.innerHTML = `<p class="aviso productos__vacio">Por ahora no tenemos productos publicados aquí. <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">Pregúntanos por WhatsApp</a>.</p>`;
      return;
    }
    caja.innerHTML = lista.map((p) => {
      const c = CATS[p.categoria] || { sello: '', garantia: '' };
      const foto = p.foto
        ? `<img src="${esc(p.foto)}" alt="${esc(p.nombre)}" loading="lazy">`
        : `<div class="producto__falta">${DIBUJO}<span>Foto pendiente</span></div>`;
      return `<article class="producto">
        <div class="producto__foto">${foto}${c.sello ? `<span class="producto__sello">${c.sello}</span>` : ''}</div>
        <div class="producto__info">
          <h2>${esc(p.nombre)}</h2>
          ${c.garantia ? `<p class="producto__garantia">${c.garantia}</p>` : ''}
          <p class="producto__precio">${pesos(p.precio)}</p>
          <button class="boton" type="button" data-agregar="${esc(p.id)}"><span>Agregar</span></button>
        </div>
      </article>`;
    }).join('');
    if (hayGsap) gsap.from(caja.children, { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.04, ease: 'power2.out', clearProps: 'all' });
  }

  function elegirFiltro(cat) {
    filtros.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    pintarProductos(cat);
  }

  const items = () => Object.entries(carrito).map(([id, cant]) => ({ p: catalogo.get(id), cant }));
  const totalPesos = () => items().reduce((s, i) => s + i.p.precio * i.cant, 0);

  function mensaje() {
    const filas = items().map(({ p, cant }) => {
      const c = CATS[p.categoria];
      return `- ${cant} x ${p.nombre}${c ? ` (${c.etiqueta})` : ''}: ${pesos(p.precio * cant)}`;
    });
    return ['Hola, quiero hacer este pedido desde la página web:', '', ...filas, '', `Total: ${pesos(totalPesos())}`, '', '¿Está disponible?'].join('\n');
  }

  function pintarCarrito() {
    const lista = items(), cuenta = lista.reduce((s, i) => s + i.cant, 0), total = totalPesos();
    lineas.innerHTML = lista.map(({ p, cant }) => `<li class="linea">
      <span class="linea__nombre">${esc(p.nombre)}${CATS[p.categoria] ? ` <small>(${CATS[p.categoria].etiqueta})</small>` : ''}</span>
      <span class="linea__precio">${pesos(p.precio * cant)}</span>
      <span class="cantidad">
        <button type="button" data-restar="${esc(p.id)}" aria-label="Quitar uno de ${esc(p.nombre)}">−</button>
        <output>${cant}</output>
        <button type="button" data-sumar="${esc(p.id)}" aria-label="Agregar uno de ${esc(p.nombre)}">+</button>
      </span>
      <button type="button" class="linea__quitar" data-quitar="${esc(p.id)}">Quitar</button>
    </li>`).join('');
    vacio.hidden = cuenta > 0;
    lineas.hidden = pie.hidden = cuenta === 0;
    const globo = $('[data-cuenta]');
    globo.textContent = cuenta > 99 ? '99+' : cuenta;
    globo.hidden = cuenta === 0;
    botonCarrito.setAttribute('aria-label', cuenta ? `Ver carrito, ${cuenta} en total` : 'Ver carrito, vacio');
    $('[data-total]').textContent = pesos(total);
    if (cuenta) enviar.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje())}`;
    else enviar.removeAttribute('href');
    guardar();
  }

  /* Un punto rojo sale del botón y aterriza en el carrito */
  function volarAlCarrito(origen) {
    const a = origen.getBoundingClientRect(), z = botonCarrito.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const punto = d.createElement('i');
    punto.className = 'punto-vuelo';
    punto.style.left = `${x0 - 9}px`;
    punto.style.top = `${y0 - 9}px`;
    d.body.append(punto);
    gsap.timeline({
      onComplete() {
        punto.remove();
        gsap.fromTo(botonCarrito, { scale: 1.08 }, { scale: 1, duration: 0.5, ease: 'power2.out', clearProps: 'scale' });
      }
    })
      .to(punto, { x: z.left + z.width / 2 - x0, duration: 0.75, ease: 'power2.inOut' }, 0)
      .to(punto, { y: z.top + z.height / 2 - y0, duration: 0.75, ease: 'power2.in' }, 0)
      .to(punto, { scale: 0.6, duration: 0.75, ease: 'power1.in' }, 0);
  }

  function cambiar(id, delta) {
    if (!catalogo.has(id)) return;
    const nueva = (carrito[id] || 0) + delta;
    if (nueva > 0) carrito[id] = nueva; else delete carrito[id];
    pintarCarrito();
  }

  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agregar]');
    if (!b) return;
    cambiar(b.dataset.agregar, 1);
    const texto = b.querySelector('span');
    texto.textContent = 'Agregado';
    clearTimeout(b._t);
    b._t = setTimeout(() => { texto.textContent = 'Agregar'; }, 1000);
    if (hayGsap) volarAlCarrito(b);
  });
  /* Si una foto no carga, se muestra el dibujo en lugar del ícono roto */
  caja.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') e.target.outerHTML = `<div class="producto__falta">${DIBUJO}<span>Foto pendiente</span></div>`;
  }, true);
  filtros.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) elegirFiltro(b.dataset.cat); });
  botonCarrito.addEventListener('click', () => dialogo.showModal());
  $('[data-cerrar-carrito]').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) { dialogo.close(); return; }
    const b = e.target.closest('[data-sumar],[data-restar],[data-quitar]');
    if (!b) return;
    if (b.dataset.sumar) cambiar(b.dataset.sumar, 1);
    else if (b.dataset.restar) cambiar(b.dataset.restar, -1);
    else cambiar(b.dataset.quitar, -carrito[b.dataset.quitar]);
    if (!Object.keys(carrito).length) dialogo.close();
  });
  $('[data-vaciar]').addEventListener('click', () => { carrito = {}; pintarCarrito(); dialogo.close(); });

  /* Si viene de un botón de la portada: tienda.html?cat=usadas */
  const pedido = new URLSearchParams(location.search).get('cat');
  elegirFiltro(pedido && CATS[pedido] ? pedido : 'todos');
  pintarCarrito();
})();
