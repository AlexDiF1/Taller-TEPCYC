/* Fondo de Reparación: X roja formada por dos cuñas y chevrones finos arriba y abajo */
(() => {
  'use strict';
  const lienzo = document.querySelector('[data-fondo-equis]');
  const ctx = lienzo && lienzo.getContext('2d');
  if (!ctx) return;
  /* Medidas pensadas sobre un lienzo de 900 x 1600, con el origen en el centro */
  const ANCHO = 900, ALTO = 1600;

  const figura = (puntos, relleno) => {
    ctx.fillStyle = relleno;
    ctx.beginPath();
    puntos.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y));
    ctx.closePath();
    ctx.fill();
  };
  const degradado = (x0, y0, x1, y1, paradas) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    paradas.forEach(([p, c]) => g.addColorStop(p, c));
    return g;
  };

  /* Cuña derecha superior: la simetría completa las otras tres */
  function cuna() {
    figura([[155, 0], [285, -238], [450, -405], [450, 0]],
      degradado(155, 0, 430, 0, [[0, 'rgba(176,10,14,.82)'], [0.45, 'rgba(112,6,10,.36)'], [1, 'rgba(70,4,6,0)']]));
    figura([[285, -238], [352, -292], [450, -372], [450, -430], [392, -392]],
      degradado(285, -238, 450, -410, [[0, 'rgba(165,10,14,.75)'], [1, 'rgba(90,6,8,.12)']]));
    figura([[3, 0], [285, -238], [155, 0]],
      degradado(0, 0, 285, -120, [[0, '#7C070B'], [0.32, '#B40C11'], [0.72, '#A50B10'], [1, '#6E070A']]));
    /* Vetas oscuras cerca de la punta exterior */
    [[188, 214], [214, 238], [240, 262]].forEach(([a, b]) => {
      figura([[a, -a * 0.835], [b, -b * 0.835], [b - 24, -b * 0.835 + 42], [a - 24, -a * 0.835 + 42]], 'rgba(20,0,2,.34)');
    });
    /* Filos brillantes */
    figura([[3, 0], [285, -238], [283, -233], [8, 0]], 'rgba(255,44,48,.55)');
    figura([[155, 0], [285, -238], [287, -232], [160, 0]], 'rgba(255,58,60,.42)');
  }

  /* Mitad de un chevrón: del vértice central hacia la derecha */
  function chevron(y, largo, grueso, color) {
    const caida = largo * 0.86;
    figura([[0, y], [largo, y - caida], [largo, y - caida - grueso], [0, y - grueso]],
      degradado(0, 0, largo, 0, [[0, color], [0.6, color.replace(/[\d.]+\)$/, (a) => `${parseFloat(a) * 0.55})`)], [1, color.replace(/[\d.]+\)$/, '0)')]]));
  }
  const CHEVRONES = [
    [-255, 135, 9, 'rgba(165,14,18,.72)'], [-350, 205, 8, 'rgba(178,14,18,.7)'], [-385, 90, 7, 'rgba(70,16,18,.75)'],
    [-435, 170, 7, 'rgba(150,12,16,.68)'], [-545, 270, 10, 'rgba(165,14,18,.66)'], [-610, 190, 7, 'rgba(70,16,18,.75)'],
    [-655, 92, 6, 'rgba(150,14,18,.62)'], [-735, 405, 9, 'rgba(62,18,20,.72)']
  ];

  function dibujar() {
    const W = innerWidth, H = Math.max(innerHeight, lienzo.clientHeight);
    const pr = Math.min(devicePixelRatio || 1, 2);
    lienzo.width = Math.round(W * pr);
    lienzo.height = Math.round(H * pr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020000';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    /* En escritorio la X crece con la misma escala en ambos ejes para no deformarse */
    const parejo = Math.min(W / ANCHO, H / 470) * pr;
    const sx = W >= 900 ? parejo : (W / ANCHO) * pr, sy = W >= 900 ? parejo : (H / ALTO) * pr;
    [1, -1].forEach((ex) => [1, -1].forEach((ey) => {
      ctx.setTransform(sx * ex, 0, 0, sy * ey, lienzo.width / 2, lienzo.height / 2);
      cuna();
      CHEVRONES.forEach((c) => chevron(...c));
    }));
    /* Velo oscuro sobre todo el dibujo */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(2,0,0,.68)';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  }

  /* En celular solo se redibuja si cambia el ancho: la barra del navegador no lo reinicia */
  let ancho = innerWidth, alto = innerHeight, espera = 0;
  addEventListener('resize', () => {
    if (innerWidth === ancho && (innerWidth < 900 || innerHeight === alto)) return;
    ancho = innerWidth; alto = innerHeight;
    clearTimeout(espera);
    espera = setTimeout(dibujar, 180);
  });
  dibujar();
})();
