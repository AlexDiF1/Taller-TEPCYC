/* Formulario de reparación: arma el mensaje y lo abre en WhatsApp */
(() => {
  'use strict';
  const WHATSAPP = '573180223184';
  const OTRO = 'Otro';
  const MODELOS = {
    consola: ['PS5', 'PS4', 'Xbox Series X|S', 'Xbox 360', 'Nintendo Switch', OTRO],
    control: ['PS5 (DualSense)', 'PS4 (DualShock 4)', 'Xbox Series', 'Xbox 360', 'Nintendo Switch (Joy-Con)', 'Nintendo Switch (Pro)', OTRO],
    celular: null
  };
  const NOMBRE_EQUIPO = { consola: 'Consola', control: 'Control', celular: 'Celular' };
  /* Código corto que viaja en el mensaje de WhatsApp: cuando el cliente escribe,
     el taller identifica el lead y lo da de alta como contacto con su nombre. */
  const REF = 'W-' + Math.random().toString(36).slice(2, 6).toUpperCase();

  const form = document.querySelector('[data-form-reparacion]');
  if (!form) return;
  const $ = (s) => form.querySelector(s);
  const modelo = $('#modelo'), otro = $('#modelo-otro'), nombre = $('#nombre'), fallo = $('#fallo');
  const autoriza = $('#autoriza-datos');
  // Versión de la política aceptada (cambiarla si cambia privacidad.html).
  const POLITICA = '2026-11-24';
  const campoModelo = $('[data-campo-modelo]'), campoOtro = $('[data-campo-otro]'), etiquetaOtro = $('[data-etiqueta-otro]');
  const confirmacion = $('[data-confirmacion]'), enlaceWa = $('[data-enlace-wa]');

  const equipo = () => form.elements.equipo.value;
  const error = (clave, mostrar, campo) => {
    $(`[data-error="${clave}"]`).hidden = !mostrar;
    if (campo) { if (mostrar) campo.setAttribute('aria-invalid', 'true'); else campo.removeAttribute('aria-invalid'); }
  };

  function mostrarOtro() {
    const eq = equipo(), esCelular = !MODELOS[eq];
    campoModelo.hidden = esCelular;
    campoOtro.hidden = !(esCelular || modelo.value === OTRO);
    etiquetaOtro.firstChild.textContent = esCelular ? 'Marca y modelo del celular ' : '¿Cuál modelo es? ';
  }

  function pintarEquipo() {
    const eq = equipo();
    modelo.replaceChildren(new Option('Elige el modelo', ''), ...(MODELOS[eq] || []).map((m) => new Option(m, m)));
    otro.value = '';
    error('modelo', false, modelo);
    error('modelo-otro', false, otro);
    mostrarOtro();
  }

  function validar() {
    const faltaSelect = !campoModelo.hidden && !modelo.value;
    const faltaOtro = !campoOtro.hidden && !otro.value.trim();
    const faltaFallo = !fallo.value.trim();
    const faltaNombre = !nombre.value.trim();
    const faltaAutoriza = !autoriza.checked;
    error('modelo', faltaSelect, modelo);
    error('modelo-otro', faltaOtro, otro);
    error('fallo', faltaFallo, fallo);
    error('nombre', faltaNombre, nombre);
    error('autoriza', faltaAutoriza, autoriza);
    autoriza.closest('.autoriza').setAttribute('aria-invalid', String(faltaAutoriza));
    const primero = faltaSelect ? modelo : faltaOtro ? otro : faltaFallo ? fallo : faltaNombre ? nombre : faltaAutoriza ? autoriza : null;
    if (primero) primero.focus();
    return !primero;
  }

  function mensaje() {
    const eq = equipo();
    const mod = campoOtro.hidden ? modelo.value : otro.value.trim();
    const lineas = [
      'Hola, quiero solicitar una reparación.', '',
      `Nombre: ${nombre.value.trim()}`,
      `Equipo: ${NOMBRE_EQUIPO[eq]}`,
      `Modelo: ${mod}`,
      `Fallo: ${fallo.value.trim()}`
    ];
    if ($('#desde').value) lineas.push(`Falla desde: ${$('#desde').value}`);
    lineas.push('', `Ref: ${REF}`);
    return lineas.join('\n');
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'equipo') pintarEquipo();
    if (e.target === modelo) { mostrarOtro(); if (modelo.value) error('modelo', false, modelo); }
  });
  fallo.addEventListener('input', () => error('fallo', false, fallo));
  otro.addEventListener('input', () => error('modelo-otro', false, otro));
  nombre.addEventListener('input', () => error('nombre', false, nombre));
  autoriza.addEventListener('change', () => {
    if (!autoriza.checked) return;
    error('autoriza', false, autoriza);
    autoriza.closest('.autoriza').setAttribute('aria-invalid', 'false');
  });

  /* Registra el lead en el panel (n8n) sin bloquear al cliente: es "dispara y olvida". */
  function registrarLead() {
    const eq = equipo();
    const mod = campoOtro.hidden ? modelo.value : otro.value.trim();
    try {
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          nombre: nombre.value.trim(),
          equipo: NOMBRE_EQUIPO[eq],
          modelo: mod,
          fallo: fallo.value.trim(),
          desde: ($('#desde') || {}).value || '',
          ref: REF,
          sitio_web: ($('#sitio-web') || {}).value || '',
          autoriza_datos: autoriza.checked,
          politica: POLITICA,
          pagina: location.pathname + location.search
        })
      }).catch(() => {});
    } catch (_) { /* si falla, el lead sigue por WhatsApp */ }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validar()) { confirmacion.hidden = true; return; }
    registrarLead();
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje())}`;
    enlaceWa.href = url;
    confirmacion.hidden = false;
    window.open(url, '_blank', 'noopener');
  });

  /* Si viene de un botón de la portada, deja elegido el equipo: reparacion.html?equipo=control */
  const pedido = new URLSearchParams(location.search).get('equipo');
  const radio = pedido && form.querySelector(`[name=equipo][value="${CSS.escape(pedido)}"]`);
  if (radio) radio.checked = true;
  pintarEquipo();
})();
