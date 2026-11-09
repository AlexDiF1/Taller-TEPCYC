(() => {
  'use strict';
  const d = document, html = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const safe = (fn) => { try { fn(); } catch (e) { console.warn('[sitio]', e); } };
  const M = { ease: 'power4.out', easeIO: 'power3.inOut', pop: 'back.out(2.4)', dur: 0.75, stagger: 0.055, dist: 56, lerp: 0.11 };
  const CARGA = 'steps(14)';

  if (!hasGSAP) html.classList.remove('js');
  else {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* Scroll suave */
  let lenis = null;
  if (hasGSAP && !RM && window.Lenis) {
    lenis = new Lenis({ lerp: M.lerp, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* Anclas: funcionan siempre */
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const el = a.getAttribute('href').length > 1 && d.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: -10, duration: 1.3 });
    else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  });

  /* Buscador de orden: consulta el estado real en la app del taller
     (/api/orden/... lo sirve este mismo sitio, que hace de puente) y deja
     WhatsApp como respaldo. Sin JS, el formulario sigue abriendo WhatsApp. */
  safe(() => {
    const form = $('[data-orden]');
    if (!form) return;
    const numero = $('[data-orden-numero]', form), sufijo = $('[data-orden-sufijo]', form), mensaje = $('[data-orden-mensaje]', form);
    const caja = $('[data-orden-resultado]');
    const WA = '573180223184';
    const ETIQUETA = {
      pendiente: 'Pendiente',
      enRevision: 'En revisión',
      esperandoConfirmacion: 'Esperando confirmación',
      completada: 'Completada',
      rechazada: 'Rechazada por el cliente',
      fallida: 'Reparación fallida',
    };
    const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
    const wa = (texto) => `https://wa.me/${WA}?text=${encodeURIComponent(texto)}`;
    const res = (clave) => (caja ? caja.querySelector(`[data-res-${clave}]`) : null);
    const pon = (clave, texto) => { const el = res(clave); if (el) el.textContent = texto; };
    const dia = (iso) => (iso ? String(iso).slice(0, 10) : '');
    const cifras = res('cifras');
    let consultando = false;

    function pintar(datos) {
      pon('estado', ETIQUETA[datos.estado] || datos.estado);
      if (res('estado')) res('estado').dataset.estado = datos.estado;
      pon('cliente', datos.cliente || '');
      const elCliente = res('cliente');
      if (elCliente) elCliente.hidden = !datos.cliente;
      const eq = datos.equipo || {};
      pon('equipo', [eq.tipo, eq.marca, eq.modelo].filter(Boolean).join(' · ') || 'Equipo registrado');
      pon('falla-texto', datos.falla || '');
      const elFalla = res('falla');
      if (elFalla) elFalla.hidden = !datos.falla;
      pon('total', pesos(datos.total));
      pon('abono', pesos(datos.abono));
      pon('saldo', pesos(datos.saldo));
      if (cifras) cifras.hidden = false;
      const fechas = [];
      if (datos.estimadaEl) fechas.push(`Entrega estimada: ${dia(datos.estimadaEl)}`);
      if (datos.entregadaEl) fechas.push(`Entregada el ${dia(datos.entregadaEl)}`);
      pon('fecha', fechas.join(' · '));
      const elFecha = res('fecha');
      if (elFecha) elFecha.hidden = fechas.length === 0;
      const pie = res('pie');
      if (pie) pie.innerHTML = `¿Algo no cuadra? <a href="${wa(`Hola, quiero consultar mi orden ${datos.numero}`)}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>.`;
      if (caja) { caja.classList.remove('orden-res--error'); caja.hidden = false; }
    }

    function avisar(texto, valor) {
      pon('estado', 'Sin resultados');
      if (res('estado')) res('estado').dataset.estado = '';
      pon('equipo', texto);
      ['cliente', 'falla'].forEach((clave) => { const el = res(clave); if (el) el.hidden = true; });
      if (cifras) cifras.hidden = true;
      const elFecha = res('fecha');
      if (elFecha) elFecha.hidden = true;
      const pie = res('pie');
      if (pie) pie.innerHTML = `<a href="${wa(`Hola, quiero consultar mi orden ${valor}`)}" target="_blank" rel="noopener">Consúltanos por WhatsApp</a> y la revisamos contigo.`;
      if (caja) { caja.classList.add('orden-res--error'); caja.hidden = false; }
    }

    form.addEventListener('submit', (e) => {
      const valor = numero.value.trim();
      const ultimos = sufijo.value.replace(/\D/g, '');
      if (!valor || ultimos.length !== 4) {
        e.preventDefault();
        form.classList.add('error');
        if (caja) caja.hidden = true;
        (!valor ? numero : sufijo).focus();
        return;
      }
      form.classList.remove('error');
      mensaje.value = `Hola, quiero consultar mi orden de reparación número: ${valor} (mi teléfono termina en ${ultimos})`;
      if (!caja || typeof fetch !== 'function') return; /* respaldo: el formulario abre WhatsApp */
      e.preventDefault();
      if (consultando) return;
      consultando = true;
      form.classList.add('consultando');
      fetch(`/api/orden/${encodeURIComponent(valor)}?t=${encodeURIComponent(ultimos)}`, { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((d) => (d && d.encontrada ? pintar(d) : avisar('No encontramos una orden con ese número y esos 4 dígitos.', valor)))
        .catch(() => avisar('No pudimos consultar la orden en este momento.', valor))
        .finally(() => { consultando = false; form.classList.remove('consultando'); });
    });
    [numero, sufijo].forEach((campo) => campo.addEventListener('input', () => {
      if (campo === sufijo) campo.value = campo.value.replace(/\D/g, '').slice(0, 4);
      form.classList.remove('error');
    }));
  });

  if (!hasGSAP || RM) return;

  /* Firma: el logo se arma alrededor de la consola y la barra enciende el botón */
  const trazar = (lista) => lista.forEach((p) => { p.setAttribute('pathLength', 1); p.style.strokeDasharray = '1'; });
  function firmaPortada() {
    gsap.timeline({ defaults: { ease: M.ease } })
      .fromTo('[data-arcos-izq]', { x: -220, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.5, ease: M.easeIO }, 0)
      .fromTo('[data-arcos-der]', { x: 220, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.5, ease: M.easeIO }, 0)
      .fromTo('.nav__enlaces a', { y: -14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08, ease: M.pop, clearProps: 'transform' }, 0.25)
      .fromTo('[data-linea]', { yPercent: 112 }, { yPercent: 0, duration: M.dur, stagger: M.stagger * 2 }, 0.2)
      .fromTo('[data-sube]', { y: M.dist / 3, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: M.dur, stagger: 0.18 }, 0.42)
      .fromTo('[data-carga]', { scaleX: 0 }, { scaleX: 1, duration: 1.05, ease: CARGA }, 0.45)
      .fromTo('[data-boton]', { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: M.pop }, 1.5)
      /* El logo se carga de izquierda a derecha y el 2 cae encima */
      .fromTo('[data-logo-base]', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.95, ease: CARGA }, 0.05)
      .fromTo('[data-logo-dos]', { scale: 3, rotation: -16, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.32, ease: 'power4.in' }, 1.1)
      .to('[data-logo-hero]', { keyframes: [{ x: -7, y: 5, duration: 0.05 }, { x: 6, y: -4, duration: 0.05 }, { x: -3, y: 2, duration: 0.05 }, { x: 0, y: 0, duration: 0.06 }], ease: 'none' }, 1.42);
  }

  /* En computador el logo de la portada se mueve apenas con el mouse */
  function logoSigueMouse() {
    if (!matchMedia('(hover: hover) and (min-width: 900px)').matches) return;
    const logo = $('[data-logo-hero]');
    const irX = gsap.quickTo(logo, 'x', { duration: 0.9, ease: 'power3' }), irY = gsap.quickTo(logo, 'y', { duration: 0.9, ease: 'power3' });
    gsap.delayedCall(2.2, () => addEventListener('pointermove', (e) => {
      if (scrollY > innerHeight) return;
      irX((e.clientX / innerWidth - 0.5) * -20);
      irY((e.clientY / innerHeight - 0.5) * -14);
    }, { passive: true }));
  }

  const alEntrar = (el, start = 'top 82%') => ({ trigger: el, start, once: true });

  /* Títulos por líneas */
  const titulos = () => $$('[data-titulo]').forEach((el) => safe(() => {
    if (window.SplitText) {
      const s = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'ln' });
      /* Al terminar se quita la división: así el título se reacomoda si giran el celular */
      gsap.from(s.lines, { yPercent: 115, duration: M.dur + 0.1, stagger: M.stagger * 2, ease: M.ease, scrollTrigger: alEntrar(el), onComplete: () => s.revert() });
    } else gsap.from(el, { y: M.dist / 2, autoAlpha: 0, duration: M.dur, scrollTrigger: alEntrar(el) });
  }));

  function efectos() {
    /* Revelado discreto */
    $$('[data-reveal]').forEach((el) => gsap.from(el, { y: M.dist / 3, autoAlpha: 0, duration: M.dur, ease: M.ease, scrollTrigger: alEntrar(el, 'top 88%') }));
    /* Barra de carga que se llena al entrar cada sección */
    $$('[data-llena]').forEach((el) => gsap.from(el, { scaleX: 0, duration: 0.9, ease: CARGA, scrollTrigger: alEntrar(el, 'top 90%') }));
    /* Franja: el marco se dibuja por tramos */
    $$('[data-linea-x]').forEach((el, i) => gsap.from(el, { scaleX: 0, duration: 1.1, delay: i * 0.15, ease: M.easeIO, transformOrigin: i ? 'right center' : 'left center', scrollTrigger: alEntrar(el, 'top 95%') }));
    /* Cascadas */
    $$('[data-cascada]').forEach((c) => gsap.from(c.children, { y: M.dist, autoAlpha: 0, duration: M.dur, stagger: M.stagger * 2.4, ease: M.ease, scrollTrigger: alEntrar(c) }));
    /* Marco de la sección consolas */
    $$('[data-dibuja]').forEach((svg) => {
      const lineas = $$('path,circle:not(.color)', svg);
      trazar(lineas);
      const tl = gsap.timeline({ scrollTrigger: alEntrar(svg, 'top 78%') });
      tl.fromTo(lineas, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, stagger: 0.07, ease: M.easeIO });
      const colores = $$('.color', svg);
      if (colores.length) {
        tl.from(colores, { scale: 0, transformOrigin: 'center', stagger: 0.07, duration: 0.4, ease: M.pop }, '-=.25');
        /* Los botones del control se encienden por turnos solo mientras se ven */
        const turno = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2 })
          .to(colores, { scale: 1.24, transformOrigin: 'center', duration: 0.2, stagger: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 });
        tl.call(() => {
          const zona = ScrollTrigger.create({ trigger: svg, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? turno.play() : turno.pause()) });
          if (zona.isActive) turno.play();
        });
      }
    });
    /* Celulares: el marco de neón se enciende con un parpadeo */
    $$('.neon').forEach((el) => {
      gsap.set(el, { autoAlpha: 0 });
      gsap.to(el, { keyframes: [{ autoAlpha: 0.75, duration: 0.07 }, { autoAlpha: 0.15, duration: 0.1 }, { autoAlpha: 1, duration: 0.14 }], ease: 'none', scrollTrigger: alEntrar(el, 'top 85%') });
    });
    /* Modelos: cada barra avanza con el scroll */
    $$('.modelos li').forEach((li) => {
      gsap.from($('b', li), { x: -M.dist, autoAlpha: 0, duration: M.dur, ease: M.ease, scrollTrigger: alEntrar(li, 'top 88%') });
      gsap.fromTo($('.rayas', li), { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: li, start: 'top 85%', end: 'top 45%', scrub: true } });
    });
    /* Pasos: la barra avanza de paso en paso */
    const carril = $('[data-carril]');
    if (carril) {
      const pasos = $$('.pasos__lista li', carril);
      carril.classList.add('animado');
      const marcar = function () { const p = this.progress(); pasos.forEach((li, i) => li.classList.toggle('activo', p >= i / pasos.length)); };
      const avanzar = (eje, fin) => gsap.fromTo('[data-avance]', { [eje]: 0 }, { [eje]: 1, ease: 'none', onUpdate: marcar, scrollTrigger: { trigger: carril, start: 'top 70%', end: fin, scrub: true } });
      /* Se rehace si cambia el diseño, por ejemplo al girar el celular */
      const medios = gsap.matchMedia();
      medios.add('(max-width: 759px)', () => { avanzar('scaleY', 'bottom 60%'); });
      medios.add('(min-width: 760px)', () => { avanzar('scaleX', 'top 25%'); });
    }
    /* Preguntas: al abrir una, la página cambia de alto y hay que recalcular las animaciones */
    let recalculo = 0;
    $$('.preguntas details').forEach((d) => d.addEventListener('toggle', () => { clearTimeout(recalculo); recalculo = setTimeout(() => ScrollTrigger.refresh(), 420); }));
    /* Ondas que se dibujan con el scroll */
    $$('[data-ondas-scroll]').forEach((svg) => {
      const p = $$('path', svg); trazar(p);
      gsap.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', stagger: 0.02, scrollTrigger: { trigger: svg.parentElement, start: 'top 80%', end: 'bottom 70%', scrub: true } });
    });
    /* Cierre: el 2 cae como sello */
    const dos = $('[data-sello]');
    if (dos) gsap.from(dos, { scale: 2.5, rotation: -16, autoAlpha: 0, duration: 0.32, ease: 'power4.in', scrollTrigger: alEntrar(dos, 'top 92%') });
  }

  safe(() => {
    Promise.race([d.fonts ? d.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(() => {
      safe(firmaPortada); safe(titulos); safe(efectos); safe(logoSigueMouse);
      ScrollTrigger.refresh();
    });
    addEventListener('load', () => ScrollTrigger.refresh());
  });
})();
