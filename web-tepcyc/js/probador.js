/* Probador de control: aparece al elegir "Control" y lee el mando conectado en vivo */
(() => {
  'use strict';
  const panel = document.querySelector('[data-probador]');
  const form = document.querySelector('[data-form-reparacion]');
  if (!panel || !form) return;
  const $ = (s) => panel.querySelector(s), $$ = (s) => [...panel.querySelectorAll(s)];
  const estado = $('[data-estado]'), vibrar = $('[data-vibrar]');
  const botones = $$('[data-b]'), gatillos = $$('[data-gatillo]');
  const palancas = [
    { g: $('[data-palanca="izq"]'), texto: $('[data-valor="izq"]'), x: 0, y: 1 },
    { g: $('[data-palanca="der"]'), texto: $('[data-valor="der"]'), x: 2, y: 3 }
  ];
  const RECORRIDO = 14, ANCHO_GATILLO = 110;
  const INICIAL = 'Conecta tu control por cable o Bluetooth y presiona cualquier botón.';
  const soportado = typeof navigator.getGamepads === 'function';
  let bucle = 0, actual = '';

  const mando = () => [...navigator.getGamepads()].find((g) => g && g.connected) || null;
  const decir = (t) => { if (estado.textContent !== t) estado.textContent = t; };

  function limpiar() {
    botones.forEach((b) => b.classList.remove('activo'));
    gatillos.forEach((g) => g.setAttribute('width', 0));
    palancas.forEach((p) => { p.g.setAttribute('transform', 'translate(0 0)'); p.texto.textContent = 'X 0.00 · Y 0.00'; });
    vibrar.hidden = true;
  }

  function leer() {
    bucle = requestAnimationFrame(leer);
    const g = mando();
    if (!g) {
      if (actual) { actual = ''; limpiar(); decir(INICIAL); }
      return;
    }
    if (actual !== g.id) {
      actual = g.id;
      decir(g.mapping === 'standard' ? 'Control conectado. Presiona cada botón para probarlo.' : 'Control conectado. En este modelo algunos botones pueden no coincidir con el dibujo.');
      vibrar.hidden = !g.vibrationActuator;
    }
    botones.forEach((el) => {
      const b = g.buttons[Number(el.dataset.b)];
      el.classList.toggle('activo', !!b && (b.pressed || b.value > 0.1));
    });
    gatillos.forEach((el) => {
      const b = g.buttons[Number(el.dataset.gatillo)];
      el.setAttribute('width', b ? (b.value * ANCHO_GATILLO).toFixed(1) : 0);
    });
    palancas.forEach((p) => {
      const x = g.axes[p.x] || 0, y = g.axes[p.y] || 0;
      p.g.setAttribute('transform', `translate(${(x * RECORRIDO).toFixed(1)} ${(y * RECORRIDO).toFixed(1)})`);
      p.texto.textContent = `X ${x.toFixed(2)} · Y ${y.toFixed(2)}`;
    });
  }

  function actualizar() {
    const visible = form.elements.equipo.value === 'control';
    panel.hidden = !visible;
    cancelAnimationFrame(bucle);
    if (visible && soportado) leer();
  }

  vibrar.addEventListener('click', () => {
    const g = mando();
    if (g && g.vibrationActuator) g.vibrationActuator.playEffect('dual-rumble', { duration: 700, strongMagnitude: 1, weakMagnitude: 1 }).catch(() => {});
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'equipo') actualizar(); });

  decir(soportado ? INICIAL : 'Este navegador no permite probar controles. Prueba desde Chrome o Edge en un computador.');
  actualizar();
})();
