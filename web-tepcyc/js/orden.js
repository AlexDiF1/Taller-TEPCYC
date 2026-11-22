/* Consulta de orden: pregunta el estado real a la app del taller
   (/api/orden/... lo sirve este mismo sitio con server.py). Sin JS, el formulario abre WhatsApp.
   orden.html?n=1234 deja el número escrito. */
(() => {
  'use strict';
  const d = document;
  const form = d.querySelector('[data-orden]');
  if (!form) return;
  const $ = (s) => form.querySelector(s);
  const numero = $('[data-orden-numero]');
  const sufijo = $('[data-orden-sufijo]');
  const mensaje = $('[data-orden-mensaje]');
  const error = $('[data-orden-error]');
  const caja = d.querySelector('[data-orden-resultado]');
  const WA = '573180223184';
  const ETIQUETA = {
    pendiente: 'Pendiente',
    enRevision: 'En revisión',
    esperandoConfirmacion: 'Esperando tu confirmación',
    completada: 'Lista para recoger',
    rechazada: 'Rechazada por el cliente',
    fallida: 'No se pudo reparar',
  };
  const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const wa = (texto) => `https://wa.me/${WA}?text=${encodeURIComponent(texto)}`;
  const res = (clave) => caja && caja.querySelector(`[data-res-${clave}]`);
  const pon = (clave, texto) => { const el = res(clave); if (el) el.textContent = texto; };
  const ver = (clave, si) => { const el = res(clave); if (el) el.hidden = !si; };
  const dia = (iso) => (iso ? String(iso).slice(0, 10) : '');
  let consultando = false;

  const previo = new URLSearchParams(location.search).get('n');
  if (previo) numero.value = previo.slice(0, 30);

  function pintar(datos) {
    pon('estado', ETIQUETA[datos.estado] || datos.estado);
    res('estado').dataset.estado = datos.estado || '';
    pon('cliente', datos.cliente || ''); ver('cliente', !!datos.cliente);
    const eq = datos.equipo || {};
    pon('equipo', [eq.tipo, eq.marca, eq.modelo].filter(Boolean).join(' · ') || 'Equipo registrado');
    pon('falla-texto', datos.falla || ''); ver('falla', !!datos.falla);
    pon('total', pesos(datos.total)); pon('abono', pesos(datos.abono)); pon('saldo', pesos(datos.saldo));
    ver('cifras', true);
    const fechas = [];
    if (datos.estimadaEl) fechas.push(`Entrega estimada: ${dia(datos.estimadaEl)}`);
    if (datos.entregadaEl) fechas.push(`Entregada el ${dia(datos.entregadaEl)}`);
    pon('fecha', fechas.join(' · ')); ver('fecha', fechas.length > 0);
    res('pie').innerHTML = `¿Algo no cuadra? <a href="${wa(`Hola, quiero consultar mi orden ${datos.numero}`)}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>.`;
    caja.classList.remove('orden-res--error');
    caja.hidden = false;
  }

  function avisar(texto, valor) {
    pon('estado', 'Sin resultados');
    res('estado').dataset.estado = '';
    pon('equipo', texto);
    ['cliente', 'falla', 'cifras', 'fecha'].forEach((c) => ver(c, false));
    res('pie').innerHTML = `<a href="${wa(`Hola, quiero consultar mi orden ${valor}`)}" target="_blank" rel="noopener">Consúltanos por WhatsApp</a> y la revisamos contigo.`;
    caja.classList.add('orden-res--error');
    caja.hidden = false;
  }

  form.addEventListener('submit', (e) => {
    const valor = numero.value.trim();
    const ultimos = sufijo.value.replace(/\D/g, '');
    if (!valor || ultimos.length !== 4) {
      e.preventDefault();
      form.classList.add('error');
      if (error) error.hidden = false;
      if (caja) caja.hidden = true;
      (!valor ? numero : sufijo).focus();
      return;
    }
    form.classList.remove('error');
    if (error) error.hidden = true;
    mensaje.value = `Hola, quiero consultar mi orden de reparación número: ${valor} (mi teléfono termina en ${ultimos})`;
    if (!caja || typeof fetch !== 'function') return;
    e.preventDefault();
    if (consultando) return;
    consultando = true;
    form.classList.add('consultando');
    fetch(`/api/orden/${encodeURIComponent(valor)}?t=${encodeURIComponent(ultimos)}`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((datos) => (datos && datos.encontrada
        ? pintar(datos)
        : avisar(datos && datos.error ? datos.error : 'No encontramos una orden con ese número y esos 4 dígitos.', valor)))
      .catch(() => avisar('No pudimos consultar la orden en este momento.', valor))
      .finally(() => { consultando = false; form.classList.remove('consultando'); });
  });

  [numero, sufijo].forEach((campo) => campo.addEventListener('input', () => {
    if (campo === sufijo) campo.value = campo.value.replace(/\D/g, '').slice(0, 4);
    form.classList.remove('error');
    if (error) error.hidden = true;
  }));
})();
