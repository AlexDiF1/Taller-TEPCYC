/* Fondo de la Tienda: malla roja fina sobre negro, con nubes desenfocadas y señales que viajan */
(() => {
  'use strict';
  const lienzo = document.querySelector('[data-fondo-malla]');
  const ctx = lienzo && lienzo.getContext('2d');
  if (!ctx) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CUADRO = 33;
  let CELDA = 118, ALCANCE = 185;
  const capa = document.createElement('canvas');

  const azar = (s) => () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const brillo = document.createElement('canvas');
  brillo.width = brillo.height = 64;
  const cb = brillo.getContext('2d');
  const halo = cb.createRadialGradient(32, 32, 0, 32, 32, 32);
  halo.addColorStop(0, '#FFE4E4');
  halo.addColorStop(0.16, '#FF3A3A');
  halo.addColorStop(0.45, 'rgba(255,0,0,.28)');
  halo.addColorStop(1, 'rgba(255,0,0,0)');
  cb.fillStyle = halo;
  cb.fillRect(0, 0, 64, 64);

  let W = 0, H = 0, pr = 1, aristas = [], destellos = [], senales = [], rnd = azar(7);

  /* La malla es más densa abajo y casi desaparece arriba a la izquierda, donde va el título */
  const densidad = (x, y) => Math.min(0.92, 0.12 + 0.82 * (y / H) + 0.22 * (x / W));

  function nubes(c) {
    const area = W * H;
    for (let i = 0, t = area / 16000; i < t; i++) {
      const x = rnd() * W, y = H * (0.18 + 0.82 * rnd()), r = 50 + rnd() * 130;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(110,2,6,${(0.035 + rnd() * 0.08).toFixed(3)})`);
      g.addColorStop(1, 'rgba(110,2,6,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  /* Formas fuera de foco: se pintan pequeñas y se amplían, funciona en todos los navegadores */
  function desenfoque(c) {
    const f = 10, chico = document.createElement('canvas');
    chico.width = Math.ceil(W / f); chico.height = Math.ceil(H / f);
    const m = chico.getContext('2d');
    for (let i = 0, t = W * H / 24000; i < t; i++) {
      const x = rnd() * chico.width, y = chico.height * (0.25 + 0.75 * rnd()), s = 3 + rnd() * 8;
      m.fillStyle = `rgba(185,8,12,${(0.25 + rnd() * 0.4).toFixed(3)})`;
      m.beginPath();
      m.moveTo(x, y); m.lineTo(x + s, y + rnd() * s); m.lineTo(x + rnd() * s - s / 2, y + s); m.closePath(); m.fill();
    }
    c.save();
    c.globalAlpha = 0.28;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(chico, 0, 0, W, H);
    c.restore();
  }

  function construir() {
    W = innerWidth;
    H = Math.max(innerHeight, lienzo.clientHeight);
    CELDA = W < 600 ? 80 : 118;
    ALCANCE = CELDA * 1.55;
    pr = Math.min(devicePixelRatio || 1, 2);
    lienzo.width = capa.width = Math.round(W * pr);
    lienzo.height = capa.height = Math.round(H * pr);
    rnd = azar(7);
    const c = capa.getContext('2d');
    c.setTransform(pr, 0, 0, pr, 0, 0);
    c.fillStyle = '#020000';
    c.fillRect(0, 0, W, H);
    nubes(c);
    desenfoque(c);

    const nodos = [];
    const cols = Math.ceil(W / CELDA) + 1, filas = Math.ceil(H / CELDA) + 1;
    for (let f = 0; f < filas; f++) for (let k = 0; k < cols; k++) {
      const x = (k + rnd() * 0.95 - 0.2) * CELDA, y = (f + rnd() * 0.95 - 0.2) * CELDA;
      if (rnd() < densidad(x, y)) nodos.push({ x, y, r: 1.4 + rnd() * 1.2 });
    }

    const vistas = new Set();
    aristas = [];
    nodos.forEach((n, i) => {
      const cerca = nodos.map((o, j) => ({ j, d: Math.hypot(o.x - n.x, o.y - n.y) })).filter((o) => o.j !== i && o.d < ALCANCE).sort((a, b) => a.d - b.d).slice(0, 2);
      if (cerca.length === 2 && cerca[1].d < CELDA * 1.05 && rnd() < 0.34) {
        const a = nodos[cerca[0].j], b = nodos[cerca[1].j];
        const g = c.createLinearGradient(n.x, n.y, b.x, b.y);
        g.addColorStop(0, 'rgba(220,22,26,.3)');
        g.addColorStop(1, 'rgba(120,0,4,.08)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(n.x, n.y); c.lineTo(a.x, a.y); c.lineTo(b.x, b.y); c.closePath(); c.fill();
      }
      cerca.forEach(({ j }) => {
        const clave = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (vistas.has(clave)) return;
        vistas.add(clave);
        aristas.push([n, nodos[j]]);
      });
    });
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(225,28,32,.42)';
    c.beginPath();
    aristas.forEach(([a, b]) => { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); });
    c.stroke();
    c.fillStyle = '#C81E22';
    nodos.forEach((n) => { c.beginPath(); c.arc(n.x, n.y, n.r, 0, Math.PI * 2); c.fill(); });

    const area = W * H;
    destellos = Array.from({ length: Math.min(18, Math.max(5, Math.round(area / 70000))) }, () => {
      const n = nodos[Math.floor(rnd() * nodos.length)];
      return { x: n.x, y: n.y, t: 13 + rnd() * 9, f: 0.0008 + rnd() * 0.0013, o: rnd() * 6.28 };
    });
    senales = Array.from({ length: Math.min(10, Math.max(3, Math.round(area / 130000))) }, () => nueva({}));
    pintar(0);
  }

  function nueva(s) {
    const a = aristas[Math.floor(rnd() * aristas.length)];
    s.a = a[0]; s.b = a[1]; s.p = rnd() * 0.4; s.v = 0.0005 + rnd() * 0.0006;
    return s;
  }

  function pintar(ms, paso = 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(capa, 0, 0);
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    destellos.forEach((d) => {
      ctx.globalAlpha = RM ? 0.8 : 0.45 + 0.55 * Math.sin(ms * d.f + d.o);
      ctx.drawImage(brillo, d.x - d.t / 2, d.y - d.t / 2, d.t, d.t);
    });
    ctx.globalAlpha = 1;
    if (RM) return;
    senales.forEach((s) => {
      s.p += s.v * paso;
      if (s.p >= 1) nueva(s);
      ctx.drawImage(brillo, s.a.x + (s.b.x - s.a.x) * s.p - 6, s.a.y + (s.b.y - s.a.y) * s.p - 6, 12, 12);
    });
  }

  let previo = 0, bucle = 0;
  function animar(ms) {
    bucle = requestAnimationFrame(animar);
    if (ms - previo < CUADRO) return;
    pintar(ms, Math.min(ms - previo, 100));
    previo = ms;
  }
  const arrancar = () => { cancelAnimationFrame(bucle); previo = performance.now(); bucle = requestAnimationFrame(animar); };

  let espera = 0;
  addEventListener('resize', () => {
    if (innerWidth === W && (innerWidth < 900 ? lienzo.clientHeight <= H : innerHeight === H)) return;
    clearTimeout(espera);
    espera = setTimeout(construir, 180);
  });
  document.addEventListener('visibilitychange', () => {
    if (RM) return;
    if (document.hidden) cancelAnimationFrame(bucle); else arrancar();
  });

  construir();
  if (!RM) arrancar();
})();
