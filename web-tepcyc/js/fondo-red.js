/* Fondo de Reparación: red de puntos y líneas con chispas que titilan y señales que viajan */
(() => {
  'use strict';
  const lienzo = document.querySelector('[data-fondo-red]');
  const ctx = lienzo && lienzo.getContext('2d');
  if (!ctx) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CELDA = 170, CUADRO = 33;
  const capa = document.createElement('canvas');

  /* Azar con semilla: el fondo sale igual en cada visita */
  const azar = (s) => () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* Destello ya pintado: es mucho más liviano que calcular sombras en cada cuadro */
  const destello = document.createElement('canvas');
  destello.width = destello.height = 96;
  const cd = destello.getContext('2d');
  const halo = cd.createRadialGradient(48, 48, 0, 48, 48, 48);
  halo.addColorStop(0, '#FFF6B8');
  halo.addColorStop(0.14, '#FFD23C');
  halo.addColorStop(0.32, 'rgba(255,110,24,.5)');
  halo.addColorStop(1, 'rgba(255,50,20,0)');
  cd.fillStyle = halo;
  cd.fillRect(0, 0, 96, 96);

  let W = 0, H = 0, pr = 1, aristas = [], vecinos = [], chispas = [], senales = [], rnd = azar(2);

  function circulo(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  function construir() {
    W = innerWidth;
    H = Math.max(innerHeight, lienzo.clientHeight);
    pr = Math.min(devicePixelRatio || 1, 2);
    lienzo.width = capa.width = Math.round(W * pr);
    lienzo.height = capa.height = Math.round(H * pr);
    rnd = azar(2);
    const c = capa.getContext('2d');
    c.setTransform(pr, 0, 0, pr, 0, 0);
    const area = W * H;

    /* Base vino, más clara al centro y oscura en los bordes */
    const centro = c.createRadialGradient(W / 2, H * 0.58, 0, W / 2, H * 0.58, Math.max(W, H) * 0.8);
    centro.addColorStop(0, '#160305');
    centro.addColorStop(0.55, '#0D0203');
    centro.addColorStop(1, '#040101');
    c.fillStyle = centro;
    c.fillRect(0, 0, W, H);

    /* Puntos repartidos en una rejilla irregular */
    const nodos = [];
    const cols = Math.ceil(W / CELDA) + 1, filas = Math.ceil(H / CELDA) + 1;
    for (let f = 0; f < filas; f++) for (let k = 0; k < cols; k++) {
      nodos.push({
        x: (k + rnd() * 0.9 - 0.2) * CELDA,
        y: (f + rnd() * 0.9 - 0.2) * CELDA,
        r: rnd() < 0.14 ? 9 + rnd() * 3.5 : 3.5 + rnd() * 3.5
      });
    }

    /* Cada punto se une a sus tres vecinos más cercanos */
    const vistas = new Set();
    aristas = [];
    vecinos = nodos.map(() => []);
    nodos.forEach((n, i) => {
      const cerca = nodos.map((o, j) => ({ j, d: (o.x - n.x) ** 2 + (o.y - n.y) ** 2 })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
      if (rnd() < 0.42) {
        const a = nodos[cerca[0].j], b = nodos[cerca[1].j];
        c.fillStyle = `rgba(120,14,18,${(0.04 + rnd() * 0.05).toFixed(3)})`;
        c.beginPath(); c.moveTo(n.x, n.y); c.lineTo(a.x, a.y); c.lineTo(b.x, b.y); c.closePath(); c.fill();
      }
      cerca.forEach(({ j }) => {
        const clave = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (vistas.has(clave)) return;
        vistas.add(clave);
        aristas.push([n, nodos[j]]);
        vecinos[i].push(j); vecinos[j].push(i);
      });
    });
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(170,24,26,.13)';
    c.beginPath();
    aristas.forEach(([a, b]) => { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); });
    c.stroke();

    /* Círculos desenfocados y polvo naranja */
    for (let i = 0, t = area / 8500; i < t; i++) circulo(c, rnd() * W, rnd() * H, 3 + rnd() * rnd() * 16, `rgba(190,30,32,${(0.035 + rnd() * 0.06).toFixed(3)})`);
    for (let i = 0, t = area / 3800; i < t; i++) circulo(c, rnd() * W, rnd() * H, 0.5 + rnd() * 1.1, `rgba(255,${70 + Math.floor(rnd() * 70)},40,${(0.25 + rnd() * 0.4).toFixed(3)})`);
    nodos.forEach((n) => circulo(c, n.x, n.y, n.r, '#7A1014'));

    /* Partes animadas */
    const totalChispas = Math.min(24, Math.max(7, Math.round(area / 62000)));
    chispas = Array.from({ length: totalChispas }, () => ({ x: rnd() * W, y: rnd() * H, t: 24 + rnd() * 16, f: 0.0007 + rnd() * 0.0012, o: rnd() * 6.28 }));
    senales = Array.from({ length: Math.min(9, Math.max(3, Math.round(area / 150000))) }, () => nueva({}));
    pintar(0);
  }

  function nueva(s) {
    const a = aristas[Math.floor(rnd() * aristas.length)];
    s.a = a[0]; s.b = a[1]; s.p = rnd() * 0.5; s.v = 0.0004 + rnd() * 0.0005;
    return s;
  }

  function pintar(ms, paso = 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(capa, 0, 0);
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    chispas.forEach((c) => {
      ctx.globalAlpha = RM ? 0.9 : 0.5 + 0.5 * Math.sin(ms * c.f + c.o);
      ctx.drawImage(destello, c.x - c.t / 2, c.y - c.t / 2, c.t, c.t);
    });
    ctx.globalAlpha = 1;
    if (RM) return;
    senales.forEach((s) => {
      s.p += s.v * paso;
      if (s.p >= 1) nueva(s);
      ctx.drawImage(destello, s.a.x + (s.b.x - s.a.x) * s.p - 7, s.a.y + (s.b.y - s.a.y) * s.p - 7, 14, 14);
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

  /* Solo se redibuja si cambia el ancho: la barra del navegador del celular no lo reinicia */
  let espera = 0;
  addEventListener('resize', () => {
    if (innerWidth === W && lienzo.clientHeight <= H) return;
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
