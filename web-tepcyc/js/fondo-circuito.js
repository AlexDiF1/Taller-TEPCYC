/* Fondo de Reparación: pistas de circuito que bajan y energía que recorre las pistas */
(() => {
  'use strict';
  const lienzo = document.querySelector('[data-fondo-circuito]');
  const ctx = lienzo && lienzo.getContext('2d');
  if (!ctx) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CUADRO = 33, SEPARA = 11;
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
  halo.addColorStop(0, '#FFE9DC');
  halo.addColorStop(0.16, '#FF4A36');
  halo.addColorStop(0.45, 'rgba(255,30,20,.26)');
  halo.addColorStop(1, 'rgba(255,0,0,0)');
  cb.fillStyle = halo;
  cb.fillRect(0, 0, 64, 64);

  let W = 0, H = 0, pr = 1, pistas = [], energia = [], rnd = azar(11);

  /* Grupos de pistas paralelas que entran desde un lado y se quiebran a 45 grados */
  function grupo(y0, lado) {
    const n = 2 + Math.floor(rnd() * 5);
    const movs = [];
    let sentido = rnd() < 0.5 ? -1 : 1;
    const total = W * (0.08 + 0.14 * rnd());
    let suma = 0;
    while (suma < total) {
      const corre = 30 + rnd() * 84, cruza = 10 + rnd() * 30;
      movs.push({ corre, cruza: cruza * sentido });
      suma += corre + cruza;
      sentido = -sentido;
    }
    for (let i = 0; i < n; i++) {
      let x = lado > 0 ? -12 : W + 12, y = y0 + i * SEPARA;
      const pts = [{ x, y }];
      const corte = Math.max(1, movs.length - Math.floor(rnd() * Math.min(3, movs.length)));
      for (let m = 0; m < corte; m++) {
        x += movs[m].corre * lado;
        pts.push({ x, y });
        y += movs[m].cruza;
        x += Math.abs(movs[m].cruza) * lado;
        pts.push({ x, y });
      }
      x += (10 + rnd() * 18) * lado;
      pts.push({ x, y });
      let largo = 0;
      const acum = pts.map((p, k) => (k ? (largo += Math.hypot(p.x - pts[k - 1].x, p.y - pts[k - 1].y)) : 0));
      pistas.push({ pts, acum, largo, grueso: rnd() < 0.2 });
    }
    return y0 + n * SEPARA;
  }

  function construir() {
    W = innerWidth;
    H = Math.max(innerHeight, lienzo.clientHeight);
    pr = Math.min(devicePixelRatio || 1, 2);
    lienzo.width = capa.width = Math.round(W * pr);
    lienzo.height = capa.height = Math.round(H * pr);
    rnd = azar(11);
    const c = capa.getContext('2d');
    c.setTransform(pr, 0, 0, pr, 0, 0);
    c.fillStyle = '#060102';
    c.fillRect(0, 0, W, H);
    const luz = c.createLinearGradient(0, 0, W, 0);
    luz.addColorStop(0, 'rgba(92,12,10,.42)');
    luz.addColorStop(0.24, 'rgba(92,12,10,0)');
    luz.addColorStop(0.76, 'rgba(92,12,10,0)');
    luz.addColorStop(1, 'rgba(92,12,10,.42)');
    c.fillStyle = luz;
    c.fillRect(0, 0, W, H);

    pistas = [];
    [1, -1].forEach((lado) => { for (let y = -30 + rnd() * 30; y < H + 20;) y = grupo(y, lado) + 16 + rnd() * 46; });

    /* Color: naranja rojizo en los bordes, se apaga hacia el centro */
    const tinta = (a) => {
      const g = c.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, `rgba(255,112,42,${a})`);
      g.addColorStop(0.12, `rgba(232,34,36,${a})`);
      g.addColorStop(0.3, 'rgba(150,16,24,0)');
      g.addColorStop(0.7, 'rgba(150,16,24,0)');
      g.addColorStop(0.88, `rgba(232,34,36,${a})`);
      g.addColorStop(1, `rgba(255,112,42,${a})`);
      return g;
    };
    c.lineJoin = 'round';
    const trazar = (lista) => {
      c.beginPath();
      lista.forEach((p) => p.pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))));
      c.stroke();
    };
    c.strokeStyle = tinta(0.07); c.lineWidth = 5; trazar(pistas);
    c.strokeStyle = tinta(0.5); c.lineWidth = 1.1; trazar(pistas.filter((p) => !p.grueso));
    c.strokeStyle = tinta(0.62); c.lineWidth = 2.4; trazar(pistas.filter((p) => p.grueso));

    energia = Array.from({ length: Math.min(14, Math.max(5, Math.round(W / 90))) }, () => nueva({}, true));
    pintar(0);
  }

  function nueva(s, inicio) {
    s.p = pistas[Math.floor(rnd() * pistas.length)];
    s.d = inicio ? rnd() * s.p.largo : 0;
    s.v = 0.07 + rnd() * 0.09;
    return s;
  }

  function punto({ pts, acum }, d) {
    let i = 1;
    while (i < pts.length - 1 && acum[i] < d) i++;
    const t = (d - acum[i - 1]) / ((acum[i] - acum[i - 1]) || 1);
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
  }

  function pintar(ms, paso = 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(capa, 0, 0);
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    energia.forEach((s) => {
      s.d += s.v * paso;
      if (s.d >= s.p.largo) nueva(s, false);
      const q = punto(s.p, s.d);
      ctx.drawImage(brillo, q.x - 7, q.y - 7, 14, 14);
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
