/* Probador de control: botones, palancas (drift y recorrido), gatillos, vibración y resumen para la solicitud */
(() => {
  'use strict';
  const panel = document.querySelector('[data-probador]');
  const form = document.querySelector('[data-form-reparacion]');
  if (!panel || !form) return;
  const $ = (s) => panel.querySelector(s), $$ = (s) => [...panel.querySelectorAll(s)];
  const pon = (el, t) => { if (el.textContent !== t) el.textContent = t; };

  const FLECHAS = { 12: '↑', 13: '↓', 14: '←', 15: '→' };
  const CRUCETA = ['Arriba', 'Abajo', 'Izquierda', 'Derecha'];
  const CAPAS = {
    xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', ...CRUCETA, 'Guía'],
    ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', ...CRUCETA, 'PS'],
    nin: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', ...CRUCETA, 'Home']
  };
  const capaDe = (id) => (/xbox|xinput|045e/i.test(id) ? 'xbox' : /054c|sony|dualshock|dualsense|wireless controller/i.test(id) ? 'ps' : /057e|nintendo|joy-?con|pro controller/i.test(id) ? 'nin' : 'xbox');
  const nombreDe = (g) => g.id.replace(/\s*\(.*$/, '') || 'Control';

  const INICIAL = 'Conecta tu control por cable o Bluetooth y presiona cualquier botón.';
  const SECTORES = 48, ESTELA = 34, RECORRIDO = 14, ANCHO_GATILLO = 110, PEGADO_MS = 5000, QUIETO_MS = 800;
  const TAU = Math.PI * 2;

  const estado = $('[data-estado]'), pill = $('[data-pill]'), pillTexto = $('[data-pill-texto]'), mandos = $('[data-mandos]');
  const botones = $$('[data-b]'), nivelesPad = $$('[data-gatillo]'), etiquetas = $$('[data-et]');
  const chipsCaja = $('[data-chips]'), progreso = $('[data-progreso]'), barra = $('[data-barra]'), alerta = $('[data-alerta]');
  const vibrar = $('[data-vibrar]'), agregar = $('[data-agregar-resultado]'), avisoResultado = $('[data-resultado-aviso]');
  const dato = (k) => $(`[data-dato="${k}"]`);
  const gat = [6, 7].map((n) => ({ n, nombre: $(`[data-gatillo-nombre="${n}"]`), barra: $(`[data-gatillo-barra="${n}"]`), valor: $(`[data-gatillo-valor="${n}"]`), max: 0 }));
  const palancas = [['izq', 0, 1, 'Palanca izquierda'], ['der', 2, 3, 'Palanca derecha']].map(([k, x, y, titulo]) => ({
    k, ix: x, iy: y, titulo,
    g: $(`[data-palanca="${k}"]`), texto: $(`[data-valor="${k}"]`), centro: $(`[data-centro="${k}"]`), rango: $(`[data-rango="${k}"]`),
    c: $(`[data-lienzo="${k}"]`).getContext('2d'), x: 0, y: 0, sect: new Float32Array(SECTORES), estela: [], reposo: null, ax: 0, ay: 0, desde: 0
  }));

  const soportado = typeof navigator.getGamepads === 'function';
  let bucle = 0, actual = '', elegido = null, firmaLista = '', capa = CAPAS.xbox, total = 17, chips = [];
  const probados = new Set(), inicioPulsado = new Map();
  let marcaPrevia = -1, cuentaHz = 0, ventanaHz = 0;

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
    /* El centro se lee solo cuando la palanca lleva un momento quieta y suelta */
    if (Math.hypot(x - p.ax, y - p.ay) > 0.03 || m > 0.4) { p.ax = x; p.ay = y; p.desde = ahora; }
    else if (ahora - p.desde > QUIETO_MS) p.reposo = m;
  }
  function veredictoCentro(p) {
    if (p.reposo === null) return { t: 'Suéltala', c: '' };
    const v = p.reposo.toFixed(2);
    if (p.reposo <= 0.06) return { t: `Centrada (${v})`, c: 'ok' };
    if (p.reposo <= 0.13) return { t: `Desvío leve (${v})`, c: 'avisa' };
    return { t: `Posible drift (${v})`, c: 'mal' };
  }
  function veredictoRango(p) {
    let vistos = 0, suma = 0;
    p.sect.forEach((r) => { if (r > 0.65) { vistos++; suma += r; } });
    if (vistos < SECTORES * 0.85) return { t: `Gírala ${Math.round((vistos / SECTORES) * 100)}%`, c: '' };
    const media = Math.min(suma / vistos, 1);
    return media >= 0.93 ? { t: 'Completo', c: 'ok' } : { t: `Limitado ${Math.round(media * 100)}%`, c: 'mal' };
  }
  const ponVeredicto = (el, v) => { pon(el, v.t); if (el.className !== v.c) el.className = v.c; };

  function dibujar(p) {
    const c = p.c, S = 380, C = S / 2, R = C - 16;
    c.clearRect(0, 0, S, S);
    c.lineWidth = 2;
    c.fillStyle = 'rgba(255,255,255,.035)'; c.strokeStyle = 'rgba(255,255,255,.28)';
    c.beginPath(); c.arc(C, C, R, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.1)';
    c.beginPath(); c.moveTo(C - R, C); c.lineTo(C + R, C); c.moveTo(C, C - R); c.lineTo(C, C + R); c.stroke();
    c.setLineDash([6, 7]); c.strokeStyle = 'rgba(255,255,255,.3)';
    c.beginPath(); c.arc(C, C, R * 0.13, 0, TAU); c.stroke(); c.setLineDash([]);
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

  /* ----- Pintado general ----- */
  function pintarProgreso() {
    pon(progreso, `${probados.size} de ${total}`);
    barra.style.width = `${(probados.size / total) * 100}%`;
  }

  function nuevaSesion() {
    probados.clear(); inicioPulsado.clear();
    botones.forEach((b) => b.classList.remove('activo', 'probado'));
    chips.forEach((c) => c.classList.remove('activo', 'probado'));
    gat.forEach((g) => { g.max = 0; g.barra.style.width = '0'; pon(g.valor, '0%'); });
    nivelesPad.forEach((r) => r.setAttribute('width', 0));
    palancas.forEach((p) => {
      p.x = p.y = p.ax = p.ay = 0; p.desde = performance.now(); p.reposo = null; p.sect.fill(0); p.estela.length = 0;
      p.g.setAttribute('transform', 'translate(0 0)');
      pon(p.texto, 'X 0.00 · Y 0.00');
      ponVeredicto(p.centro, { t: 'Sin medir', c: '' });
      ponVeredicto(p.rango, { t: 'Gírala completa', c: '' });
      dibujar(p);
    });
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
      const b = g.buttons[x.n], v = b ? b.value : 0;
      x.max = Math.max(x.max, v);
      x.barra.style.width = `${(v * 100).toFixed(0)}%`;
      pon(x.valor, `${Math.round(v * 100)}%`);
    });

    /* Palancas */
    palancas.forEach((p) => {
      const x = g.axes[p.ix] || 0, y = g.axes[p.iy] || 0;
      medir(p, x, y, ahora);
      p.g.setAttribute('transform', `translate(${(x * RECORRIDO).toFixed(1)} ${(y * RECORRIDO).toFixed(1)})`);
      pon(p.texto, `X ${x.toFixed(2)} · Y ${y.toFixed(2)}`);
      ponVeredicto(p.centro, veredictoCentro(p));
      ponVeredicto(p.rango, veredictoRango(p));
      dibujar(p);
    });

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
    const leer1 = (v) => (v.c ? v.t : 'sin medir');
    palancas.forEach((p) => lineas.push(`- ${p.titulo}: centro ${leer1(veredictoCentro(p))}, recorrido ${leer1(veredictoRango(p))}`));
    lineas.push(`- Gatillos (máximo): ${gat.map((x) => `${capa[x.n]} ${Math.round(x.max * 100)}%`).join(', ')}`);
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
