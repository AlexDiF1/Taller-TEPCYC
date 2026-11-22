/* Probador de control: botones, palancas (drift, ruido y recorrido), gatillos, vibración y resumen para la solicitud */
(() => {
  'use strict';
  const panel = document.querySelector('[data-probador]');
  const form = document.querySelector('[data-form-reparacion]');
  if (!panel || !form) return;
  const $ = (s) => panel.querySelector(s), $$ = (s) => [...panel.querySelectorAll(s)];
  const pon = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  const clase = (el, c) => { if (el && el.className !== c) el.className = c; };

  const FLECHAS = { 12: '↑', 13: '↓', 14: '←', 15: '→' };
  const CRUCETA = ['Arriba', 'Abajo', 'Izquierda', 'Derecha'];
  const CAPAS = {
    xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', ...CRUCETA, 'Guía'],
    ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', ...CRUCETA, 'PS'],
    nin: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', ...CRUCETA, 'Home']
  };
  /* Nombres de los botones según la marca que reporta el navegador; si no se reconoce, los de Xbox */
  const capaDe = (id) => (/xbox|xinput|045e/i.test(id) ? 'xbox' : /054c|sony|dualshock|dualsense|wireless controller/i.test(id) ? 'ps' : /057e|nintendo|joy-?con|pro controller/i.test(id) ? 'nin' : 'xbox');
  const nombreDe = (g) => g.id.replace(/\s*\(.*$/, '') || 'Control';

  const INICIAL = 'Conecta tu control por cable o Bluetooth y presiona cualquier botón.';
  const SECTORES = 48, ESTELA = 34, RECORRIDO = 14, ANCHO_GATILLO = 110, PEGADO_MS = 5000;
  const TAU = Math.PI * 2;

  /* ----- Umbrales de drift (unidades del control: 0 = centro, 1 = tope) -----
     Los juegos suelen ignorar desvíos menores a ~0.10 (zona muerta). */
  const DRIFT = { leve: 0.05, malo: 0.10, picoMalo: 0.14, ruido: 0.015 };
  const QUIETO = { mov: 0.02, fuerza: 0.35, ms: 600, min: 30, max: 240 };
  const MEDICION_MS = 3000, ZOOM = 0.15;

  const estado = $('[data-estado]'), pill = $('[data-pill]'), pillTexto = $('[data-pill-texto]'), mandos = $('[data-mandos]');
  const botones = $$('[data-b]'), nivelesPad = $$('[data-gatillo]'), etiquetas = $$('[data-et]');
  const chipsCaja = $('[data-chips]'), progreso = $('[data-progreso]'), barra = $('[data-barra]'), alerta = $('[data-alerta]');
  const vibrar = $('[data-vibrar]'), agregar = $('[data-agregar-resultado]'), avisoResultado = $('[data-resultado-aviso]');
  const driftBoton = $('[data-drift-medir]'), driftBotonTexto = $('[data-drift-boton-texto]'), driftGuia = $('[data-drift-guia]'), driftAlerta = $('[data-drift-alerta]');
  const GUIA = driftGuia ? driftGuia.textContent : '';
  const dato = (k) => $(`[data-dato="${k}"]`);
  const gat = [6, 7].map((n) => ({
    n, nombre: $(`[data-gatillo-nombre="${n}"]`), barra: $(`[data-gatillo-barra="${n}"]`), valor: $(`[data-gatillo-valor="${n}"]`),
    crudo: $(`[data-gatillo-crudo="${n}"]`), maxTexto: $(`[data-gatillo-max="${n}"]`), tope: $(`[data-gatillo-tope="${n}"]`), max: 0
  }));
  /* Paneles de los gatillos: porcentaje con un decimal, valor crudo del control y máximo alcanzado */
  function pintarGatillo(x, v) {
    x.max = Math.max(x.max, v);
    x.barra.style.setProperty('--v', v.toFixed(4));
    if (x.tope) x.tope.style.setProperty('--m', x.max.toFixed(4));
    pon(x.valor, (v * 100).toFixed(1));
    pon(x.crudo, v.toFixed(3));
    pon(x.maxTexto, `${(x.max * 100).toFixed(1)}%`);
  }

  const palancas = [['izq', 0, 1, 'Palanca izquierda', 'izquierda'], ['der', 2, 3, 'Palanca derecha', 'derecha']].map(([k, ix, iy, titulo, lado]) => ({
    k, ix, iy, titulo, lado,
    g: $(`[data-palanca="${k}"]`),
    c: $(`[data-lienzo="${k}"]`).getContext('2d'),
    z: $(`[data-zoom="${k}"]`) ? $(`[data-zoom="${k}"]`).getContext('2d') : null,
    ex: $(`[data-eje-x="${k}"]`), ey: $(`[data-eje-y="${k}"]`), dist: $(`[data-dist="${k}"]`), ang: $(`[data-ang="${k}"]`),
    centro: $(`[data-centro="${k}"]`), ruido: $(`[data-ruido="${k}"]`), rango: $(`[data-rango="${k}"]`), veredicto: $(`[data-veredicto="${k}"]`),
    x: 0, y: 0, sect: new Float32Array(SECTORES), estela: [], quietas: [], ax: 0, ay: 0, desde: 0, reposo: null, medido: null
  }));

  const soportado = typeof navigator.getGamepads === 'function';
  let bucle = 0, actual = '', elegido = null, firmaLista = '', capa = CAPAS.xbox, total = 17, chips = [];
  const probados = new Set(), inicioPulsado = new Map();
  let marcaPrevia = -1, cuentaHz = 0, ventanaHz = 0;
  let medicion = null;

  const conectados = () => [...navigator.getGamepads()].filter((g) => g && g.connected);

  /* Puede haber mandos virtuales: se usa el que tenga un botón presionado */
  function mando() {
    const lista = conectados();
    pintarMandos(lista);
    if (!lista.length) { elegido = null; return null; }
    const activo = lista.find((g) => g.buttons.some((b) => b.pressed));
    if (activo) elegido = activo.index;
    return lista.find((g) => g.index === elegido) || lista[0];
  }

  function pintarMandos(lista) {
    const firma = lista.map((g) => `${g.index}:${g.id}`).join('|');
    if (firma !== firmaLista) {
      firmaLista = firma;
      mandos.hidden = lista.length < 2;
      mandos.replaceChildren(...lista.map((g) => {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.indice = g.index; b.textContent = nombreDe(g);
        return b;
      }));
    }
    [...mandos.children].forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.indice) === elegido)));
  }

  /* ----- Formatos ----- */
  const signo = (v) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(4)}`;
  const angulo = (x, y) => (((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360).toFixed(1) + '°';

  /* Estadística de un grupo de lecturas [x, y]: centro promedio, temblor y pico */
  function estadistica(muestras) {
    const n = muestras.length;
    let sx = 0, sy = 0, pico = 0;
    muestras.forEach(([x, y]) => { sx += x; sy += y; pico = Math.max(pico, Math.hypot(x, y)); });
    const mx = sx / n, my = sy / n;
    let v = 0;
    muestras.forEach(([x, y]) => { v += (x - mx) ** 2 + (y - my) ** 2; });
    return { mx, my, m: Math.hypot(mx, my), ruido: Math.sqrt(v / n), pico, n };
  }

  /* ----- Mediciones de las palancas ----- */
  function medir(p, x, y, ahora) {
    const m = Math.hypot(x, y);
    p.x = x; p.y = y;
    if (m > 0.2) {
      const s = Math.floor((((Math.atan2(y, x) + TAU) % TAU) / TAU) * SECTORES) % SECTORES;
      p.sect[s] = Math.max(p.sect[s], Math.min(m, 1.15));
    }
    p.estela.push(x, y);
    if (p.estela.length > ESTELA * 2) p.estela.splice(0, 2);
    /* Detección automática: cuando la palanca lleva un momento quieta y suelta,
       se guardan sus lecturas y se calcula dónde quedó el centro y cuánto tiembla. */
    if (Math.hypot(x - p.ax, y - p.ay) > QUIETO.mov || m > QUIETO.fuerza) {
      p.ax = x; p.ay = y; p.desde = ahora; p.quietas.length = 0;
    } else if (ahora - p.desde > QUIETO.ms) {
      p.quietas.push([x, y]);
      if (p.quietas.length > QUIETO.max) p.quietas.shift();
      if (p.quietas.length >= QUIETO.min) p.reposo = estadistica(p.quietas);
    }
    if (medicion) {
      medicion.datos[p.k].push([x, y]);
      if (m > 0.45) medicion.movida = true;
    }
  }

  /* Veredicto: manda la prueba guiada; si no se ha hecho, la detección automática */
  function veredicto(p) {
    const s = p.medido || p.reposo;
    if (!s) return { t: 'Sin medir', c: '', s: null };
    if (s.m > DRIFT.malo || s.pico > DRIFT.picoMalo) return { t: 'Drift', c: 'mal', s };
    if (s.m > DRIFT.leve) return { t: 'Desvío leve', c: 'avisa', s };
    if (s.ruido > DRIFT.ruido) return { t: 'Inestable', c: 'avisa', s };
    return { t: 'Centrada', c: 'ok', s };
  }
  function veredictoRango(p) {
    let vistos = 0, suma = 0;
    p.sect.forEach((r) => { if (r > 0.65) { vistos++; suma += r; } });
    if (vistos < SECTORES * 0.85) return { t: `Gírala ${Math.round((vistos / SECTORES) * 100)}%`, c: '' };
    const media = Math.min(suma / vistos, 1);
    return media >= 0.93 ? { t: 'Completo', c: 'ok' } : { t: `Limitado ${Math.round(media * 100)}%`, c: 'mal' };
  }

  function pintarPalanca(p) {
    const m = Math.hypot(p.x, p.y);
    pon(p.ex, signo(p.x));
    pon(p.ey, signo(p.y));
    pon(p.dist, m.toFixed(4));
    pon(p.ang, m < 0.02 ? '—' : angulo(p.x, p.y));
    const v = veredicto(p);
    pon(p.veredicto, v.t); clase(p.veredicto, `veredicto ${v.c}`);
    pon(p.centro, v.s ? `${v.s.m.toFixed(4)}  (X ${signo(v.s.mx)} · Y ${signo(v.s.my)})` : 'Suéltala un momento');
    clase(p.centro, v.s ? (v.s.m > DRIFT.malo ? 'mal' : v.s.m > DRIFT.leve ? 'avisa' : 'ok') : '');
    pon(p.ruido, v.s ? `±${v.s.ruido.toFixed(4)}` : '—');
    clase(p.ruido, v.s ? (v.s.ruido > DRIFT.ruido ? 'avisa' : 'ok') : '');
    const r = veredictoRango(p);
    pon(p.rango, r.t); clase(p.rango, r.c);
  }

  function dibujar(p) {
    const c = p.c, S = 380, C = S / 2, R = C - 16;
    c.clearRect(0, 0, S, S);
    c.lineWidth = 2;
    c.fillStyle = 'rgba(255,255,255,.035)'; c.strokeStyle = 'rgba(255,255,255,.28)';
    c.beginPath(); c.arc(C, C, R, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.1)';
    c.beginPath(); c.moveTo(C - R, C); c.lineTo(C + R, C); c.moveTo(C, C - R); c.lineTo(C, C + R); c.stroke();
    c.setLineDash([6, 7]); c.strokeStyle = 'rgba(255,255,255,.3)';
    c.beginPath(); c.arc(C, C, R * DRIFT.malo, 0, TAU); c.stroke(); c.setLineDash([]);
    /* Silueta del recorrido alcanzado */
    if (p.sect.some((r) => r > 0)) {
      c.beginPath();
      p.sect.forEach((r, i) => {
        const a = ((i + 0.5) / SECTORES) * TAU, d = Math.min(r, 1.08) * R;
        c[i ? 'lineTo' : 'moveTo'](C + Math.cos(a) * d, C + Math.sin(a) * d);
      });
      c.closePath();
      c.fillStyle = 'rgba(216,30,40,.2)'; c.strokeStyle = 'rgba(255,70,80,.9)'; c.fill(); c.stroke();
    }
    c.strokeStyle = 'rgba(255,200,190,.55)'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < p.estela.length; i += 2) c[i ? 'lineTo' : 'moveTo'](C + p.estela[i] * R, C + p.estela[i + 1] * R);
    c.stroke();
    c.fillStyle = '#FF3B45'; c.beginPath(); c.arc(C + p.x * R, C + p.y * R, 19, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(C + p.x * R, C + p.y * R, 9, 0, TAU); c.fill();
  }

  /* Vista ampliada del centro: ±0.15 llena el círculo. Anillos en 0.05 y 0.10. */
  function dibujarZoom(p) {
    const c = p.z;
    if (!c) return;
    const S = 240, C = S / 2, R = C - 10, k = R / ZOOM;
    const punto = (x, y) => {
      const d = Math.hypot(x, y), lim = ZOOM * 0.98;
      const f = d > lim ? lim / d : 1;
      return [C + x * f * k, C + y * f * k, d > lim];
    };
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(217,35,48,.10)'; c.beginPath(); c.arc(C, C, R, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,176,46,.08)'; c.beginPath(); c.arc(C, C, DRIFT.malo * k, 0, TAU); c.fill();
    c.fillStyle = 'rgba(55,214,122,.10)'; c.beginPath(); c.arc(C, C, DRIFT.leve * k, 0, TAU); c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(C, C, R, 0, TAU); c.stroke();
    c.setLineDash([4, 5]);
    c.strokeStyle = 'rgba(255,196,92,.7)'; c.beginPath(); c.arc(C, C, DRIFT.malo * k, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(91,232,151,.7)'; c.beginPath(); c.arc(C, C, DRIFT.leve * k, 0, TAU); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = 'rgba(255,255,255,.12)';
    c.beginPath(); c.moveTo(C - R, C); c.lineTo(C + R, C); c.moveTo(C, C - R); c.lineTo(C, C + R); c.stroke();
    /* Nube de lecturas en reposo */
    c.fillStyle = 'rgba(255,255,255,.35)';
    p.quietas.forEach(([x, y]) => { const [px, py] = punto(x, y); c.fillRect(px - 1, py - 1, 2, 2); });
    /* Centro medido */
    const s = p.medido || p.reposo;
    if (s) {
      const [px, py] = punto(s.mx, s.my);
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.arc(px, py, 9, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(px - 13, py); c.lineTo(px + 13, py); c.moveTo(px, py - 13); c.lineTo(px, py + 13); c.stroke();
    }
    /* Posición actual (si sale del zoom, queda en el borde) */
    const [px, py, fuera] = punto(p.x, p.y);
    c.fillStyle = fuera ? 'rgba(255,59,69,.5)' : '#FF3B45';
    c.beginPath(); c.arc(px, py, 7, 0, TAU); c.fill();
  }

  /* ----- Prueba guiada de drift ----- */
  function empezarMedicion() {
    if (!actual || medicion) return;
    medicion = { inicio: performance.now(), datos: { izq: [], der: [] }, movida: false };
    driftBoton.classList.add('midiendo');
    driftBoton.disabled = true;
    pon(driftGuia, 'No toques las palancas…');
  }
  function avanzarMedicion(ahora) {
    if (!medicion) return;
    const t = (ahora - medicion.inicio) / MEDICION_MS;
    driftBoton.style.setProperty('--p', Math.min(t, 1).toFixed(3));
    pon(driftBotonTexto, `Midiendo… ${Math.max(0, Math.ceil(MEDICION_MS / 1000 - (ahora - medicion.inicio) / 1000))}`);
    if (t < 1) return;
    const m = medicion;
    medicion = null;
    driftBoton.classList.remove('midiendo');
    driftBoton.style.removeProperty('--p');
    driftBoton.disabled = false;
    pon(driftBotonTexto, 'Medir de nuevo');
    if (m.movida || m.datos.izq.length < 20) {
      pon(driftGuia, 'Se movió una palanca durante la prueba. Suéltalas bien y repite.');
      return;
    }
    palancas.forEach((p) => { p.medido = estadistica(m.datos[p.k]); });
    const muestras = m.datos.izq.length;
    pon(driftGuia, `Listo: ${muestras} lecturas por palanca en ${MEDICION_MS / 1000} segundos.`);
  }

  function pintarAlertaDrift() {
    if (!driftAlerta) return;
    const malas = [], leves = [];
    palancas.forEach((p) => {
      const v = veredicto(p);
      if (v.c === 'mal') malas.push(`la palanca ${p.lado} (marca ${v.s.m.toFixed(4)} sin tocarla)`);
      else if (v.c === 'avisa') leves.push(`la palanca ${p.lado} (${v.t.toLowerCase()}, ${v.s.m.toFixed(4)})`);
    });
    if (malas.length) {
      pon(driftAlerta, `Detectamos drift en ${malas.join(' y ')}. En los juegos el personaje o la cámara se moverían solos. Agrega el resultado a tu solicitud.`);
      clase(driftAlerta, 'drift__alerta');
    } else if (leves.length) {
      pon(driftAlerta, `Atención en ${leves.join(' y ')}. Es común en controles usados; si notas movimientos solos en los juegos, cuéntanos.`);
      clase(driftAlerta, 'drift__alerta drift__alerta--leve');
    }
    driftAlerta.hidden = !malas.length && !leves.length;
  }

  /* ----- Pintado general ----- */
  function pintarProgreso() {
    pon(progreso, `${probados.size} de ${total}`);
    barra.style.width = `${(probados.size / total) * 100}%`;
  }

  function nuevaSesion() {
    probados.clear(); inicioPulsado.clear();
    botones.forEach((b) => b.classList.remove('activo', 'probado'));
    chips.forEach((c) => c.classList.remove('activo', 'probado'));
    gat.forEach((g) => { g.max = 0; pintarGatillo(g, 0); });
    nivelesPad.forEach((r) => r.setAttribute('width', 0));
    medicion = null;
    if (driftBoton) {
      driftBoton.classList.remove('midiendo'); driftBoton.style.removeProperty('--p');
      driftBoton.disabled = !actual;
      pon(driftBotonTexto, 'Medir drift');
      pon(driftGuia, GUIA);
    }
    palancas.forEach((p) => {
      p.x = p.y = p.ax = p.ay = 0; p.desde = performance.now(); p.reposo = null; p.medido = null;
      p.sect.fill(0); p.estela.length = 0; p.quietas.length = 0;
      p.g.setAttribute('transform', 'translate(0 0)');
      pintarPalanca(p);
      dibujar(p); dibujarZoom(p);
    });
    pintarAlertaDrift();
    alerta.hidden = true;
    avisoResultado.hidden = true;
    pintarProgreso();
  }

  function pintarChips() {
    chipsCaja.replaceChildren(...capa.slice(0, total).map((nombre, n) => {
      const li = document.createElement('li');
      li.textContent = FLECHAS[n] || nombre;
      li.title = nombre;
      return li;
    }));
    chips = [...chipsCaja.children];
  }

  function prepararMando(g) {
    capa = CAPAS[capaDe(g.id)];
    total = Math.min(g.buttons.length, 17) || 1;
    etiquetas.forEach((t) => { t.textContent = capa[Number(t.dataset.et)]; });
    gat.forEach((x) => pon(x.nombre, capa[x.n]));
    pintarChips();
    nuevaSesion();
    pill.classList.add('conectado');
    pon(pillTexto, 'Conectado');
    const nombre = nombreDe(g);
    pon(estado, g.mapping === 'standard' ? `${nombre}. Presiona cada botón y gira las palancas.` : `${nombre}. En este modelo algunos botones pueden no coincidir con el dibujo.`);
    pon(dato('mapeo'), g.mapping === 'standard' ? 'Estándar' : 'Especial');
    pon(dato('hz'), '—');
    pon(dato('vibra'), g.vibrationActuator ? 'Disponible' : 'No disponible');
    vibrar.hidden = !g.vibrationActuator;
    agregar.disabled = false;
    marcaPrevia = -1; cuentaHz = 0; ventanaHz = performance.now();
  }

  function sinMando() {
    actual = '';
    capa = CAPAS.xbox;
    total = 17;
    etiquetas.forEach((t) => { t.textContent = capa[Number(t.dataset.et)]; });
    gat.forEach((x) => pon(x.nombre, capa[x.n]));
    pintarChips();
    nuevaSesion();
    pill.classList.remove('conectado');
    pon(pillTexto, 'Esperando');
    pon(estado, INICIAL);
    ['mapeo', 'hz', 'vibra'].forEach((k) => pon(dato(k), '—'));
    vibrar.hidden = true;
    agregar.disabled = true;
  }

  function leer() {
    bucle = requestAnimationFrame(leer);
    const g = mando();
    if (!g) { if (actual) sinMando(); return; }
    if (actual !== g.id) { actual = g.id; prepararMando(g); }
    const ahora = performance.now();

    /* Botones */
    let pegado = null, cambio = false;
    botones.forEach((el) => {
      const n = Number(el.dataset.b), b = g.buttons[n], on = !!b && (b.pressed || b.value > 0.1);
      el.classList.toggle('activo', on);
      if (chips[n]) chips[n].classList.toggle('activo', on);
      if (on && !probados.has(n)) { probados.add(n); el.classList.add('probado'); if (chips[n]) chips[n].classList.add('probado'); cambio = true; }
      if (b && b.pressed) {
        if (!inicioPulsado.has(n)) inicioPulsado.set(n, ahora);
        if (ahora - inicioPulsado.get(n) > PEGADO_MS) pegado = n;
      } else inicioPulsado.delete(n);
    });
    if (cambio) pintarProgreso();
    alerta.hidden = pegado === null;
    if (pegado !== null) pon(alerta, `«${capa[pegado]}» lleva varios segundos presionado. Si no lo estás tocando, puede estar pegado.`);

    /* Gatillos */
    nivelesPad.forEach((el) => {
      const b = g.buttons[Number(el.dataset.gatillo)];
      el.setAttribute('width', b ? (b.value * ANCHO_GATILLO).toFixed(1) : 0);
    });
    gat.forEach((x) => {
      const b = g.buttons[x.n];
      pintarGatillo(x, b ? Math.min(Math.max(b.value, 0), 1) : 0);
    });

    /* Palancas */
    palancas.forEach((p) => {
      const x = g.axes[p.ix] || 0, y = g.axes[p.iy] || 0;
      medir(p, x, y, ahora);
      p.g.setAttribute('transform', `translate(${(x * RECORRIDO).toFixed(2)} ${(y * RECORRIDO).toFixed(2)})`);
      pintarPalanca(p);
      dibujar(p);
      dibujarZoom(p);
    });
    avanzarMedicion(ahora);
    pintarAlertaDrift();

    /* Reportes por segundo: solo llegan cuando el control cambia */
    if (g.timestamp !== marcaPrevia) { marcaPrevia = g.timestamp; cuentaHz++; }
    if (ahora - ventanaHz >= 500) {
      if (cuentaHz >= 6) pon(dato('hz'), `${cuentaHz * 2} por seg.`);
      cuentaHz = 0; ventanaHz = ahora;
    }
  }

  function actualizar() {
    const visible = form.elements.equipo.value === 'control';
    panel.hidden = !visible;
    cancelAnimationFrame(bucle);
    if (visible && soportado) leer();
  }

  /* ----- Vibración ----- */
  const EFECTOS = {
    suave: [{ duration: 700, strongMagnitude: 0, weakMagnitude: 1 }],
    fuerte: [{ duration: 700, strongMagnitude: 1, weakMagnitude: 0 }],
    ambos: [{ duration: 900, strongMagnitude: 1, weakMagnitude: 1 }],
    pulso: [0, 320, 640].map((startDelay) => ({ startDelay, duration: 160, strongMagnitude: 1, weakMagnitude: 1 }))
  };
  vibrar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-efecto]');
    const g = b && mando();
    if (!g || !g.vibrationActuator) return;
    EFECTOS[b.dataset.efecto].forEach((f) => g.vibrationActuator.playEffect('dual-rumble', f).catch(() => {}));
  });

  /* ----- Resumen que se suma al campo de fallo ----- */
  const CABEZA = 'Resultado de la prueba del control';
  function resumen() {
    const g = mando();
    const faltan = capa.slice(0, total).filter((_, n) => !probados.has(n));
    const lineas = [
      `${CABEZA}${g ? ` (${nombreDe(g)})` : ''}:`,
      `- Botones que respondieron: ${probados.size} de ${total}`
    ];
    if (faltan.length) lineas.push(`- Sin respuesta o sin probar: ${faltan.join(', ')}`);
    palancas.forEach((p) => {
      const v = veredicto(p), r = veredictoRango(p);
      const detalle = v.s
        ? `${v.t.toUpperCase()}: centro ${v.s.m.toFixed(4)} (X ${signo(v.s.mx)}, Y ${signo(v.s.my)}), ruido ±${v.s.ruido.toFixed(4)}${p.medido ? ', prueba guiada' : ''}`
        : 'drift sin medir';
      lineas.push(`- ${p.titulo}: ${detalle}; recorrido ${r.c ? r.t : 'sin medir'}`);
    });
    lineas.push(`- Gatillos (máximo): ${gat.map((x) => `${capa[x.n]} ${(x.max * 100).toFixed(1)}%`).join(', ')}`);
    return lineas.join('\n');
  }
  agregar.addEventListener('click', () => {
    const fallo = form.querySelector('#fallo');
    /* Si se agrega de nuevo, reemplaza el resultado anterior */
    const i = fallo.value.indexOf(CABEZA);
    const base = (i >= 0 ? fallo.value.slice(0, i) : fallo.value).trimEnd();
    fallo.value = `${base ? `${base}\n\n` : ''}${resumen()}`;
    fallo.dispatchEvent(new Event('input', { bubbles: true }));
    avisoResultado.hidden = false;
  });
  $('[data-ir-fallo]').addEventListener('click', (e) => {
    e.preventDefault();
    const fallo = form.querySelector('#fallo');
    fallo.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    fallo.focus({ preventScroll: true });
  });

  if (driftBoton) driftBoton.addEventListener('click', empezarMedicion);
  $('[data-reiniciar]').addEventListener('click', nuevaSesion);
  mandos.addEventListener('click', (e) => {
    const b = e.target.closest('[data-indice]');
    if (b) elegido = Number(b.dataset.indice);
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'equipo') actualizar(); });

  sinMando();
  if (!soportado) pon(estado, 'Este navegador no permite probar controles. Prueba desde Chrome o Edge en un computador.');
  actualizar();
})();
