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

  /* Buscador de orden: arma el mensaje de WhatsApp con el número */
  safe(() => {
    const form = $('[data-orden]');
    if (!form) return;
    const numero = $('[data-orden-numero]', form), mensaje = $('[data-orden-mensaje]', form);
    form.addEventListener('submit', (e) => {
      const valor = numero.value.trim();
      if (!valor) { e.preventDefault(); form.classList.add('error'); numero.focus(); return; }
      form.classList.remove('error');
      mensaje.value = `Hola, quiero consultar mi orden de reparación número: ${valor}`;
    });
    numero.addEventListener('input', () => form.classList.remove('error'));
  });

  /* Barra fija: se esconde con el botón de portada a la vista y en el cierre */
  safe(() => {
    const barra = $('[data-barra-movil]');
    if (!barra || !('IntersectionObserver' in window)) return;
    const visibles = new Set();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target)));
      barra.classList.toggle('oculta', visibles.size > 0);
    });
    $$('[data-boton],#contacto,.seccion .boton').forEach((el) => io.observe(el));
  });

  if (!hasGSAP || RM) return;

  /* Firma: el logo se arma alrededor de la consola y la barra enciende el botón */
  const trazar = (lista) => lista.forEach((p) => { p.setAttribute('pathLength', 1); p.style.strokeDasharray = '1'; });
  function firmaPortada() {
    const ondas = $$('.hero [data-ondas] path');
    trazar(ondas);
    gsap.timeline({ defaults: { ease: M.ease } })
      .fromTo(ondas, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.5, stagger: 0.03, ease: M.easeIO }, 0)
      .fromTo('[data-linea]', { yPercent: 112 }, { yPercent: 0, duration: M.dur, stagger: M.stagger * 2 }, 0.2)
      .fromTo('[data-sube]', { y: M.dist / 3, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: M.dur, stagger: 0.18 }, 0.42)
      .fromTo('[data-carga]', { scaleX: 0 }, { scaleX: 1, duration: 1.05, ease: CARGA }, 0.45)
      .fromTo('[data-boton]', { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: M.pop }, 1.5)
      /* El logo se carga de izquierda a derecha y el 2 cae encima */
      .fromTo('[data-logo-base]', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.95, ease: CARGA }, 0.05)
      .fromTo('[data-logo-dos]', { scale: 3, rotation: -16, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.32, ease: 'power4.in' }, 1.1)
      .to('[data-logo-hero]', { keyframes: [{ x: -7, y: 5, duration: 0.05 }, { x: 6, y: -4, duration: 0.05 }, { x: -3, y: 2, duration: 0.05 }, { x: 0, y: 0, duration: 0.06 }], ease: 'none' }, 1.42);
  }

  const alEntrar = (el, start = 'top 82%') => ({ trigger: el, start, once: true });

  /* Títulos por líneas */
  const titulos = () => $$('[data-titulo]').forEach((el) => safe(() => {
    if (window.SplitText) {
      const s = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'ln' });
      gsap.from(s.lines, { yPercent: 115, duration: M.dur + 0.1, stagger: M.stagger * 2, ease: M.ease, scrollTrigger: alEntrar(el) });
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
      if (colores.length) tl.from(colores, { scale: 0, transformOrigin: 'center', stagger: 0.07, duration: 0.4, ease: M.pop }, '-=.25');
    });
    /* Modelos: cada barra avanza con el scroll */
    $$('.modelos li').forEach((li) => {
      gsap.from($('b', li), { x: -M.dist, autoAlpha: 0, duration: M.dur, ease: M.ease, scrollTrigger: alEntrar(li, 'top 88%') });
      gsap.fromTo($('.rayas', li), { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: li, start: 'top 85%', end: 'top 45%', scrub: true } });
    });
    /* Pasos: la barra avanza de paso en paso */
    const carril = $('[data-carril]');
    if (carril) {
      const vertical = matchMedia('(max-width: 759px)').matches;
      gsap.fromTo('[data-avance]', vertical ? { scaleY: 0 } : { scaleX: 0 }, { ...(vertical ? { scaleY: 1 } : { scaleX: 1 }), ease: 'none', scrollTrigger: { trigger: carril, start: 'top 70%', end: vertical ? 'bottom 60%' : 'top 25%', scrub: true } });
    }
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
      safe(firmaPortada); safe(titulos); safe(efectos);
      ScrollTrigger.refresh();
    });
    addEventListener('load', () => ScrollTrigger.refresh());
  });
})();
