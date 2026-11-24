/* @ds-bundle: {"format":4,"namespace":"Apicca","components":[{"name":"Glifo"},{"name":"Superficie"},{"name":"Celda"},{"name":"Mapa"},{"name":"AccionComun"},{"name":"Rotulo"},{"name":"LeyendaEtapa"},{"name":"LeyendaEjes"},{"name":"FichaApice"},{"name":"FilaApice"},{"name":"Boton"},{"name":"BotonIcono"},{"name":"Campo"},{"name":"SelectorEje"},{"name":"Cabecera"},{"name":"Icono"}]} */
/* APICCA · Mapa. Glifos de eje, reglas de patrón y mapa teselado como funciones que devuelven HTML o SVG.
   Sin React ni bibliotecas: cada componente es una función (props) => cadena de HTML.
   Los colores salen de los tokens (var(--eje-agua), var(--tinta)…). Los datos de demostración son ficticios. */
(function () {
  'use strict';
  var S3 = Math.sqrt(3);
  var EJES = ['agua', 'alimento', 'cobijo', 'energía', 'comunicación'];
  var CLAVE = { 'agua': 'agua', 'alimento': 'alimento', 'cobijo': 'cobijo', 'energía': 'energia', 'comunicación': 'comunicacion' };
  var GLIFO = { 'agua': 'círculo', 'alimento': 'trapecio', 'cobijo': 'cuadrado', 'energía': 'triángulo', 'comunicación': 'barra diagonal' };
  var ETAPAS = ['idea', 'prototipo', 'en marcha'];
  var REGLA = { 'idea': 'tresbolillo', 'prototipo': 'encaje', 'en marcha': 'eco' };
  var NOTA_REGLA = { 'tresbolillo': 'Glifos sueltos.', 'encaje': 'Los glifos ya se tocan.', 'eco': 'El glifo se propaga.' };
  var NEGRO = 'var(--glifo-sobre-eje)';
  var LOGO = { claro: '/_blob/4786ef46cb4c6a072a6e37104d2d0b2d', oscuro: '/_blob/a9e7c096e13ac89427659c2cb22a201b' }; // copias del logo, sin tocar

  function eje_(e) {
    if (CLAVE[e]) return e;
    for (var k in CLAVE) if (CLAVE[k] === e) return k;
    throw new Error('Eje desconocido: ' + e);
  }
  function colorEje(e) { return 'var(--eje-' + CLAVE[eje_(e)] + ')'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function f1(v) { return v.toFixed(1); }
  function n(v) { return v.toFixed(1).replace(/\.0$/, ''); }
  function trunc(v) { return Math.trunc(v); }

  // ---------- los cinco glifos, en unidades (-1..1) ----------
  var CIRC = [];
  for (var k0 = 0; k0 < 48; k0++) CIRC.push([0.9 * Math.cos(k0 * Math.PI / 24), 0.9 * Math.sin(k0 * Math.PI / 24)]);
  var UNIDAD = {
    'agua': CIRC,
    'alimento': [[-1, -0.62], [1, -0.62], [0.58, 0.62], [-0.58, 0.62]],
    'cobijo': [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]],
    'energía': [[0, -0.92], [0.98, 0.78], [-0.98, 0.78]],
    'comunicación': [[-1, 0.6], [0.6, -1], [1, -0.6], [-0.6, 1]]
  };
  function poli(pts) { return 'M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z'; }
  function g(eje, cx, cy, s, ang, base) {
    var r = (ang || 0) * Math.PI / 180, c = Math.cos(r), d = Math.sin(r);
    return poli((base || UNIDAD[eje]).map(function (p) { return [cx + s * (p[0] * c - p[1] * d), cy + s * (p[0] * d + p[1] * c)]; }));
  }

  // ---------- las tres reglas de patrón (1 unidad = 1 px a escala 1) ----------
  var GIRO = { 'alimento': 180, 'cobijo': 45, 'energía': 180, 'comunicación': 90 };
  function tres(eje, W, H, c) {
    c = c || 40;
    var d = '', J = trunc(H / (c * 0.825)) + 2, I = trunc(W / c) + 2;
    for (var j = 0; j < J; j++) for (var i = -1; i < I; i++) {
      var par = j % 2, x = (i + par * 0.5) * c + c / 2, y = j * c * 0.825 + 1;
      d += eje === 'agua' ? g(eje, x, y, (par ? 6 : 13) * c / 40) : g(eje, x, y, 12 * c / 40, par ? GIRO[eje] : 0);
    }
    return d;
  }
  function barras(W, h, y, espejo) {
    var t = h * 0.62, junta = h * 0.16, d = '', x = -2 * h;
    while (x < W + h) {
      var a = espejo ? y : y + h, b = espejo ? y + h : y;
      d += 'M' + n(x) + ' ' + n(a) + 'L' + n(x + h) + ' ' + n(b) + 'H' + n(x + h + t) + 'L' + n(x + t) + ' ' + n(a) + 'Z';
      x += t + junta;
    }
    return d;
  }
  function enc(eje, W, H, u) {
    u = u || 50;
    var d = '', ni = trunc(W / u) + 3, nj = trunc(H / u) + 3, i, j;
    if (eje === 'agua') {
      for (j = 0; j < nj; j++) for (i = 0; i < ni; i++) d += g(eje, u / 2 + u * i, u / 2 + u * j, u / 1.8);
      return d;
    }
    if (eje === 'alimento') {
      var T = 0.844 * u, B = 0.49 * u, Hh = 0.668 * u;
      for (j = 0; j < trunc(H / Hh) + 2; j++) for (i = -1; i < trunc(W / (T + B)) + 2; i++) {
        var x = (T + B) * i + (T + B) / 2 * (j % 2) + T / 2, y = Hh * j;
        d += 'M' + n(x - T / 2) + ' ' + n(y) + 'H' + n(x + T / 2) + 'L' + n(x + B / 2) + ' ' + n(y + Hh) + 'H' + n(x - B / 2) + 'Z';
      }
      return d;
    }
    if (eje === 'cobijo') {
      for (j = 0; j < nj; j++) for (i = 0; i < ni; i++) if ((i + j) % 2 === 0) d += 'M' + n(u * i) + ' ' + n(u * j) + 'h' + n(u) + 'v' + n(u) + 'h' + n(-u) + 'Z';
      return d;
    }
    if (eje === 'energía') {
      for (j = 0; j < nj; j++) for (i = 0; i < ni + 1; i++) d += 'M' + n(u * i + (j % 2) * u / 2 - u) + ' ' + n(u * j + u) + 'h' + n(u) + 'l' + n(-u / 2) + ' ' + n(-u) + 'Z';
      return d;
    }
    var h = 0.6 * u; // comunicación: espiga, cada hilera de barras se inclina al revés que la anterior
    for (j = 0; j < trunc(H / h) + 2; j++) d += barras(W, h, h * j, j % 2);
    return d;
  }
  var TRI = [[0, -1.1337], [0.98, 0.5663], [-0.98, 0.5663]]; // el triángulo con el incentro en el origen
  function ecoD(eje, ecos, alcance) {
    var pieza, paso;
    if (eje === 'energía') {
      pieza = function (k) { return g(eje, 0, 0, (k === 0 ? 13.5 : 9 + 20 * k) / 0.5663, 0, TRI); }; paso = 20;
    } else if (eje === 'comunicación') {
      pieza = function (k) { var a = 24 + 18 * k, b = 6 + 18 * k; return g(eje, 0, 0, 1, -45, [[-a, -b], [a, -b], [a, b], [-a, b]]); }; paso = 18;
    } else {
      pieza = function (k) { return g(eje, 0, 0, 14 + 27 * k); }; paso = 27 * { 'agua': 0.9, 'alimento': 0.62, 'cobijo': 0.8 }[eje];
    }
    var total = ecos != null ? ecos : trunc((alcance || 400) / paso) + 2, s = '';
    for (var k = 1; k <= total; k++) s += pieza(k);
    return [pieza(0), s];
  }

  function svg(W, H, vb, fondo, llenos, trazos, encima, estilo) {
    var s = '<svg width="' + n(W) + '" height="' + n(H) + '" viewBox="' + vb + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display: block; flex-shrink: 0' + (estilo || '') + '">';
    if (fondo) s += '<rect x="-4000" y="-4000" width="8000" height="8000" style="fill: ' + fondo + '"></rect>';
    if (llenos) s += '<path d="' + llenos + '" style="fill: ' + NEGRO + '"></path>';
    (trazos || []).forEach(function (t) {
      if (t[0]) s += '<path d="' + t[0] + '" style="fill: none; stroke: ' + NEGRO + '; stroke-width: ' + t[1] + 'px; stroke-linejoin: miter; stroke-miterlimit: 8"></path>';
    });
    return s + (encima || '') + '</svg>';
  }
  var CORTA = { 'tres': 'tresbolillo', 'enc': 'encaje', 'tresbolillo': 'tresbolillo', 'encaje': 'encaje', 'eco': 'eco' };

  /** Una superficie de W x H px con la regla del eje. regla: 'tresbolillo' | 'encaje' | 'eco'. o.escala = px por unidad. */
  function patron(eje, regla, W, H, o) {
    o = o || {}; eje = eje_(eje); regla = CORTA[regla];
    var escala = o.escala || 0.55, ancla = o.ancla || [0.5, 0.5], vw = W / escala, vh = H / escala, fondo = o.color || colorEje(eje);
    if (regla === 'tresbolillo') return svg(W, H, '0 0 ' + n(vw) + ' ' + n(vh), fondo, tres(eje, vw, vh, o.modulo || 40));
    if (regla === 'encaje') return svg(W, H, '0 0 ' + n(vw) + ' ' + n(vh), fondo, enc(eje, vw, vh, o.modulo || 50));
    var e = ecoD(eje, o.ecos, Math.hypot(vw, vh));
    return svg(W, H, n(-vw * ancla[0]) + ' ' + n(-vh * ancla[1]) + ' ' + n(vw) + ' ' + n(vh), fondo, e[0], [[e[1], 9]]);
  }
  function franjas(ejes, pinta, W, H) {
    var w = W / ejes.length;
    return '<div style="display: flex; width: ' + n(W) + 'px; height: ' + n(H) + 'px; overflow: hidden; flex-shrink: 0">' + ejes.map(function (e) { return pinta(e, w, H); }).join('') + '</div>';
  }

  // ---------- el glifo suelto ----------
  function cortaY(pts, m) {
    var sal = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      if (p[1] >= m) sal.push(p);
      if ((p[1] >= m) !== (q[1] >= m)) { var t = (m - p[1]) / (q[1] - p[1]); sal.push([p[0] + t * (q[0] - p[0]), m]); }
    }
    return sal;
  }
  /** El glifo centrado en (cx, cy), de semilado s. modo: 'macizo' | 'contorno' | 'mitad'. */
  function forma(eje, cx, cy, s, modo, color) {
    eje = eje_(eje); modo = modo || 'macizo'; color = color || NEGRO;
    var ys = UNIDAD[eje].map(function (p) { return p[1]; }), medio = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    var pts = UNIDAD[eje].map(function (p) { return [cx + s * p[0], cy + s * (p[1] - medio)]; });
    if (modo === 'macizo') return '<path d="' + poli(pts) + '" style="fill: ' + color + '"></path>';
    var t = Math.max(1.3, s * 0.17);
    var sal = '<path d="' + poli(pts) + '" style="fill: none; stroke: ' + color + '; stroke-width: ' + f1(t) + 'px; stroke-linejoin: miter"></path>';
    if (modo === 'mitad') sal += '<path d="' + poli(cortaY(pts, cy)) + '" style="fill: ' + color + '"></path>';
    return sal;
  }
  function ficha(eje, lado, modo, k, alto) {
    alto = alto || lado;
    return '<svg width="' + n(lado) + '" height="' + n(alto) + '" viewBox="0 0 ' + n(lado) + ' ' + n(alto) + '" aria-hidden="true" style="display: block; flex-shrink: 0"><rect width="' + n(lado) + '" height="' + n(alto) + '" style="fill: ' + colorEje(eje) + '"></rect>' + forma(eje, lado / 2, alto / 2, Math.min(lado, alto) * (k || 0.29), modo) + '</svg>';
  }

  // ---------- datos de demostración (ficticios) ----------
  function A(ejes, etapa, zona, ofrece, necesita) { return { ejes: ejes, etapa: etapa, zona: zona, ofrece: ofrece || '', necesita: necesita || '' }; }
  var APICES = {
    'Tanques de agua lluvia': A(['agua'], 'en marcha', '092A', 'Agua para regar las huertas y lavar las herramientas.', 'Canaletas y alguien que sepa de plomería.'),
    'Huerta de la Candelaria': A(['alimento'], 'en marcha', '092A', 'Cosecha compartida y abono.', 'Semillas criollas y manos los sábados.'),
    'Compostera comunitaria': A(['alimento'], 'prototipo', '092A'),
    'Techo verde del colegio': A(['cobijo', 'alimento'], 'prototipo', '092A'),
    'Bodega de herramientas': A(['cobijo'], 'en marcha', '092A'),
    'Paneles solares de la casa cultural': A(['energía'], 'idea', '092A'),
    'Mapa de fuentes de agua': A(['agua', 'comunicación'], 'en marcha', '42D2', 'Sin declarar.', 'Fotos de las pilas públicas que sigan funcionando.'),
    'Bicicleta generadora': A(['energía', 'comunicación'], 'prototipo', '42D2'),
    'Refugio de lluvia en el parque': A(['cobijo', 'agua'], 'idea', '42D2', 'Sin declarar.', 'Madera y lonas.'),
    'Luces solares del sendero': A(['energía'], 'en marcha', '0933'),
    'Casa de los oficios': A(['cobijo', 'comunicación'], 'prototipo', '0933')
  };
  var ACCIONES = {
    'Agua lluvia para las huertas': { eje: 'agua', apices: ['Tanques de agua lluvia', 'Huerta de la Candelaria', 'Mapa de fuentes de agua'] },
    'Energía para la casa cultural': { eje: 'energía', apices: ['Paneles solares de la casa cultural', 'Luces solares del sendero'] },
    'Semillas del sur al norte': { eje: 'alimento', apices: ['Huerta de la Candelaria', 'Compostera comunitaria'] }
  };
  // Disposición apaisada de P1 · Inicio (coordenadas axiales q, r; celdas hexagonales planas arriba, como H3).
  var DISP_ANCHA = {
    zonas: [
      { cod: '092A', total: 9, centro: [8, 1], mas: [8, 1], ap: [[7, 1, 'Tanques de agua lluvia'], [7, 2, 'Huerta de la Candelaria'], [9, 0, 'Compostera comunitaria'], [8, 0, 'Techo verde del colegio'], [8, 2, 'Bodega de herramientas'], [9, 1, 'Paneles solares de la casa cultural']] },
      { cod: '42D2', total: 3, centro: [3, 1], ap: [[4, 1, 'Mapa de fuentes de agua'], [3, 0, 'Bicicleta generadora'], [2, 2, 'Refugio de lluvia en el parque']] },
      { cod: '0933', total: 2, centro: [12, 2], ap: [[11, 2, 'Luces solares del sendero'], [12, 2, 'Casa de los oficios']] }
    ],
    rutas: [
      { nombre: 'Agua lluvia para las huertas', celdas: [[5, 1], [6, 1]], de: [4, 1], a: [7, 1], rot: [[5, 1], 'ne'] },
      { nombre: 'Energía para la casa cultural', celdas: [[10, 1], [10, 2]], de: [9, 1], a: [11, 2], rot: [[10, 1], 'ne'] },
      { nombre: 'Semillas del sur al norte', celdas: [[6, 3], [5, 4], [4, 5], [3, 6], [2, 7]], de: [7, 2], a: null, rot: [[4, 5], 'se'] },
      { nombre: 'Semillas del sur al norte', celdas: [[10, -1], [11, -2], [12, -3], [13, -4]], de: [9, 0], a: null, sinRotulo: true }
    ]
  };
  var DISP_ALTA = {
    zonas: [
      { cod: '42D2', total: 3, centro: [2, 1], ap: [[3, 0, 'Mapa de fuentes de agua'], [2, 0, 'Bicicleta generadora'], [1, 2, 'Refugio de lluvia en el parque']] },
      { cod: '092A', total: 9, centro: [7, 0], mas: [7, 0], ap: [[6, 0, 'Tanques de agua lluvia'], [6, 1, 'Huerta de la Candelaria'], [8, -1, 'Compostera comunitaria'], [7, -1, 'Techo verde del colegio'], [7, 1, 'Bodega de herramientas'], [8, 0, 'Paneles solares de la casa cultural']] },
      { cod: '0933', total: 2, centro: [7, 5], ap: [[8, 4, 'Luces solares del sendero'], [7, 5, 'Casa de los oficios']] }
    ],
    rutas: [
      { nombre: 'Agua lluvia para las huertas', celdas: [[4, 0], [5, 0]], de: [3, 0], a: [6, 0] },
      { nombre: 'Energía para la casa cultural', celdas: [[9, 0], [9, 1], [9, 2], [9, 3]], de: [8, 0], a: [8, 4] },
      { nombre: 'Semillas del sur al norte', celdas: [[5, 2], [4, 3], [3, 4], [2, 5], [1, 6], [0, 7]], de: [6, 1], a: null },
      { nombre: 'Semillas del sur al norte', celdas: [[9, -2]], de: [8, -1], a: null, sinRotulo: true }
    ]
  };

  // ---------- celdas hexagonales ----------
  var VEC = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]; // la vecina al otro lado de la arista k (entre los vértices k y k+1)
  var HEX = 'clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';
  function clave(c) { return c[0] + ',' + c[1]; }
  function verticesHex(x, y, r) { var v = []; for (var k = 0; k < 6; k++) v.push([x + r * Math.cos(Math.PI / 3 * k), y + r * Math.sin(Math.PI / 3 * k)]); return v; }

  function superficie(ejes, etapa, w, h, escala) {
    if (typeof ejes === 'string') ejes = [ejes];
    return franjas(ejes.map(eje_), function (e, ww, hh) { return patron(e, REGLA[etapa], ww, hh, { escala: escala || 0.5 }); }, w, h);
  }
  function rutaInterior(eje, w, h) {
    return '<svg width="' + n(w) + '" height="' + n(h) + '" viewBox="0 0 ' + n(w) + ' ' + n(h) + '" aria-hidden="true" style="display: block"><rect width="' + n(w) + '" height="' + n(h) + '" style="fill: var(--ruta)"></rect>' + forma(eje, w / 2, h / 2, h * 0.24, 'macizo', colorEje(eje)) + '</svg>';
  }
  function masInterior(texto, R) {
    return '<div class="ap-celda-mas" style="font-size: ' + n(R * 0.5) + 'px">' + esc(texto) + '</div>';
  }
  function anillo(x, y, R) {
    return '<path d="' + poli(verticesHex(x, y, R + 1)) + '" style="fill: none; stroke: var(--papel); stroke-width: 5px; stroke-linejoin: miter"></path>' +
      '<path d="' + poli(verticesHex(x, y, R + 7)) + '" style="fill: none; stroke: var(--tinta); stroke-width: 7px; stroke-linejoin: miter"></path>';
  }
  function contornoHex(x, y, Rc) {
    return '<path d="' + poli(verticesHex(x, y, Rc - 1)) + '" style="fill: none; stroke: var(--contorno-superficie); stroke-width: var(--trazo-contorno); stroke-linejoin: miter"></path>';
  }

  /** Una celda suelta. tipo: 'apice' | 'ruta' | 'vacia' | 'mas'. */
  function Celda(p) {
    p = p || {};
    var tipo = p.tipo || 'apice', W = p.ancho || 100, R = W / 2 + 2.5, Rc = W / 2, h = W * S3 / 2, m = p.elegida ? 12 : 0;
    var dato = p.nombre && APICES[p.nombre] ? APICES[p.nombre] : null;
    var ejes = p.ejes || (dato ? dato.ejes : ['agua']), etapa = p.etapa || (dato ? dato.etapa : 'idea');
    var dentro = '', titulo = p.titulo || '';
    if (tipo === 'apice') { dentro = superficie(ejes, etapa, W, h, p.escala || 0.42); titulo = titulo || ((p.nombre ? p.nombre + ', ' : '') + ejes.join(' y ') + ', Etapa ' + etapa); }
    else if (tipo === 'ruta') { var ej = p.eje || ejes[0]; dentro = rutaInterior(ej, W, h); titulo = titulo || ('Acción Común' + (p.nombre ? ' ' + p.nombre : '') + ', eje ' + ej); }
    else if (tipo === 'mas') { dentro = masInterior('+' + (p.cuantos || 0), R); titulo = titulo || ('Hay ' + (p.cuantos || 0) + ' Ápices más en esta zona'); }
    var x = m + Rc, y = m + h / 2, encima = '';
    if (tipo === 'vacia') encima += '<path d="' + poli(verticesHex(x, y, R - 1)) + '" style="fill: none; stroke: var(--trama); stroke-width: var(--trazo-divisor)"></path>';
    if (tipo === 'apice' && p.contorno !== false) encima += contornoHex(x, y, Rc);
    if (p.elegida) encima += anillo(x, y, R);
    var celda = tipo === 'vacia' ? '' : '<div' + (titulo ? ' title="' + esc(titulo) + '"' : '') + ' style="position: absolute; left: ' + n(m) + 'px; top: ' + n(m) + 'px; width: ' + n(W) + 'px; height: ' + n(h) + 'px; overflow: hidden; ' + HEX + '">' + dentro + '</div>';
    var ancho = W + 2 * m, alto = h + 2 * m;
    return '<div class="ap-celda" style="position: relative; width: ' + n(ancho) + 'px; height: ' + n(alto) + 'px; flex-shrink: 0">' + celda +
      '<svg width="' + n(ancho) + '" height="' + n(alto) + '" viewBox="0 0 ' + n(ancho) + ' ' + n(alto) + '" aria-hidden="true" style="position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none">' + encima + '</svg></div>';
  }

  /** El mapa teselado. Cada zona son siete celdas (centro y anillo), con borde de zona. */
  function Mapa(p) {
    p = p || {};
    var W = p.ancho || 1010, H = p.alto || 836, R = p.radio || 50, x0 = p.x0 != null ? p.x0 : -58, y0 = p.y0 != null ? p.y0 : -12;
    var disp = p.disposicion === 'alta' ? DISP_ALTA : (p.disposicion && typeof p.disposicion === 'object' ? p.disposicion : DISP_ANCHA);
    var apices = p.apices || APICES, escala = p.escala || 0.42, tam = p.tamRotulo || 12, corto = !!p.rotuloCorto;
    var rotulos = p.rotulos !== false, rotulosRuta = p.rotulosRuta !== false, contorno = p.contorno !== false;
    var pintaApice = p.pintaApice || function (nombre, w, h) { var a = apices[nombre]; return superficie(a.ejes, a.etapa, w, h, escala); };
    var acciones = p.acciones || ACCIONES;
    var pintaRuta = p.pintaRuta || function (nombre, w, h) { return rutaInterior(acciones[nombre].eje, w, h); };
    function pos(c) { return [x0 + 1.5 * R * c[0], y0 + S3 * R * (c[1] + c[0] / 2)]; }
    var Rc = R - 2.5, wc = 2 * Rc, hc = S3 * Rc;
    function celda(c, dentro, titulo) {
      var q = pos(c);
      return '<div title="' + esc(titulo || '') + '" style="position: absolute; left: ' + n(q[0] - Rc) + 'px; top: ' + n(q[1] - hc / 2) + 'px; width: ' + n(wc) + 'px; height: ' + n(hc) + 'px; overflow: hidden; ' + HEX + '">' + dentro + '</div>';
    }
    var ocupadas = {}, cuerpo = '', borde = '', encima = '', contornos = '', rot = '';
    disp.zonas.forEach(function (z) {
      var flor = [z.centro].concat(VEC.map(function (v) { return [z.centro[0] + v[0], z.centro[1] + v[1]]; }));
      var enFlor = {}; flor.forEach(function (c) { enFlor[clave(c)] = 1; });
      flor.forEach(function (c) {
        var q = pos(c), vs = verticesHex(q[0], q[1], R);
        for (var k = 0; k < 6; k++) if (!enFlor[clave([c[0] + VEC[k][0], c[1] + VEC[k][1]])]) {
          var a = vs[k], b = vs[(k + 1) % 6];
          borde += 'M' + n(a[0]) + ' ' + n(a[1]) + 'L' + n(b[0]) + ' ' + n(b[1]);
        }
      });
      var conAp = {};
      z.ap.forEach(function (t) {
        var c = [t[0], t[1]], nombre = t[2], a = apices[nombre], q = pos(c);
        ocupadas[clave(c)] = 1; conAp[clave(c)] = 1;
        cuerpo += celda(c, pintaApice(nombre, wc, hc), nombre + ', ' + a.ejes.join(' y ') + ', Etapa ' + a.etapa);
        if (contorno) contornos += contornoHex(q[0], q[1], Rc);
        if (nombre === p.elegido) encima += anillo(q[0], q[1], R);
      });
      if (z.mas && !conAp[clave(z.mas)]) {
        ocupadas[clave(z.mas)] = 1;
        cuerpo += celda(z.mas, masInterior('+' + (z.total - z.ap.length), R), 'Hay ' + (z.total - z.ap.length) + ' Ápices más en la zona ' + z.cod);
      }
      if (rotulos) {
        var arriba = flor.reduce(function (m, c) { return pos(c)[1] < pos(m)[1] ? c : m; }, flor[0]);
        var q2 = pos(arriba), yy = q2[1] - S3 * R / 2 > 26 ? q2[1] - S3 * R / 2 - 11 : Math.max.apply(null, flor.map(function (c) { return pos(c)[1]; })) + S3 * R / 2 - 11;
        var texto = 'ZONA ' + z.cod + (corto ? '' : ' · ' + z.total + (z.total === 1 ? ' ÁPICE' : ' ÁPICES'));
        rot += '<span class="ap-rotulo-zona" style="position: absolute; left: ' + n(q2[0]) + 'px; top: ' + n(yy) + 'px; transform: translateX(-50%); font-size: ' + tam + 'px">' + esc(texto) + '</span>';
      }
    });
    disp.rutas.forEach(function (r) {
      r.celdas.forEach(function (c) { ocupadas[clave(c)] = 1; cuerpo += celda(c, pintaRuta(r.nombre, wc, hc), 'Acción Común ' + r.nombre); });
      if (rotulosRuta && !r.sinRotulo) {
        var c = r.rot ? r.rot[0] : r.celdas[0], lado = r.rot ? r.rot[1] : 'ne', q = pos(c);
        var yy = q[1] + (lado[0] === 'n' ? -1 : 1) * S3 * R / 2 - 11;
        var xx = lado[1] === 'e' ? 'left: ' + n(q[0] + R / 2 + 8) + 'px' : 'right: ' + n(W - (q[0] - R / 2 - 8)) + 'px';
        rot += '<span class="ap-rotulo-accion" style="position: absolute; ' + xx + '; top: ' + n(yy) + 'px; font-size: ' + tam + 'px">' + esc(r.nombre.toUpperCase()) + '</span>';
      }
    });
    var vacias = '';
    for (var q = -2; q < trunc(W / (1.5 * R)) + 3; q++) {
      for (var r_ = -trunc(q / 2) - 3; r_ < trunc(H / (S3 * R)) + 3 - trunc(q / 2); r_++) {
        var c = [q, r_], xy = pos(c);
        if (!ocupadas[clave(c)] && -R < xy[0] && xy[0] < W + R && -R < xy[1] && xy[1] < H + R) vacias += poli(verticesHex(xy[0], xy[1], R - 1));
      }
    }
    return '<div class="ap-mapa" role="img" aria-label="' + esc(p.etiqueta || 'Mapa de Ápices y Acciones Comunes') + '" style="position: relative; width: ' + W + 'px; height: ' + H + 'px; overflow: hidden; flex-shrink: 0">' +
      '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" style="position: absolute; left: 0; top: 0"><path d="' + vacias + '" style="fill: none; stroke: var(--trama); stroke-width: var(--trazo-divisor)"></path></svg>' +
      cuerpo +
      '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" style="position: absolute; left: 0; top: 0; pointer-events: none">' +
      (contornos ? '<g>' + contornos + '</g>' : '') +
      '<path d="' + borde + '" style="fill: none; stroke: var(--tinta); stroke-width: var(--trazo-zona); stroke-linecap: round"></path>' + encima + '</svg>' +
      rot + '</div>';
  }

  // ---------- componentes ----------
  /** El glifo de un eje: sobre su losa de color (fondo: true) o suelto en currentColor. */
  function Glifo(p) {
    p = p || {};
    var eje = eje_(p.eje || 'agua'), tam = p.tam || 24, modo = p.modo || 'macizo';
    if (p.fondo === false) return '<svg width="' + tam + '" height="' + tam + '" viewBox="0 0 ' + tam + ' ' + tam + '" role="img" aria-label="' + esc(eje) + '" style="display: block; flex-shrink: 0">' + forma(eje, tam / 2, tam / 2, tam * 0.33, modo, 'currentColor') + '</svg>';
    return ficha(eje, tam, modo, p.k || 0.29).replace('aria-hidden="true"', 'role="img" aria-label="' + esc(eje) + '"');
  }
  /** Superficie de patrón: uno o varios ejes (franjas verticales) en la regla de su Etapa. Lleva contorno salvo contorno: false. */
  function Superficie(p) {
    p = p || {};
    var dato = p.nombre && APICES[p.nombre] ? APICES[p.nombre] : null;
    var ejes = p.ejes || (p.eje ? [p.eje] : dato ? dato.ejes : ['agua']), etapa = p.etapa || (dato ? dato.etapa : 'idea');
    var con = p.contorno !== false, W = p.ancho || 240, H = p.alto || 96, borde = con ? 'border: var(--trazo-contorno) solid var(--contorno-superficie); ' : '';
    var b = con ? 4 : 0;
    var regla = p.regla ? CORTA[p.regla] : REGLA[etapa];
    var dentro = franjas(ejes.map(eje_), function (e, ww, hh) { return patron(e, regla, ww, hh, { escala: p.escala || 0.5 }); }, W - b, H - b);
    return '<div class="ap-superficie" role="img" aria-label="' + esc(ejes.join(' y ') + (p.regla ? ', ' + regla : ', Etapa ' + etapa)) + '" style="' + borde + 'width: ' + n(W) + 'px; height: ' + n(H) + 'px; box-sizing: border-box; flex-shrink: 0">' + dentro + '</div>';
  }
  /** Rótulo: 'zona' (papel con texto en tinta), 'accion' (tinta con texto en papel) o 'seccion' (sin fondo). */
  function Rotulo(p) {
    p = p || {};
    var tipo = p.tipo || 'seccion', cls = tipo === 'zona' ? 'ap-rotulo-zona' : tipo === 'accion' ? 'ap-rotulo-accion' : 'rotulo ap-rotulo';
    return '<span class="' + cls + (p.suave ? ' ap-suave' : '') + '">' + esc(tipo === 'seccion' ? p.texto : String(p.texto || '').toUpperCase()) + '</span>';
  }
  /** La Acción Común: una fila de celdas de ruta entre dos Ápices, con su rótulo y los dos extremos. */
  function AccionComun(p) {
    p = p || {};
    var nombre = p.nombre || 'Agua lluvia para las huertas', accion = ACCIONES[nombre] || { eje: p.eje || 'agua' };
    var de = p.de || 'Mapa de fuentes de agua', a = p.a || 'Tanques de agua lluvia', tramos = p.tramos || 2;
    var R = p.radio || 64, Rc = R - 2.5, wc = 2 * Rc, hc = S3 * Rc, escala = p.escala || 0.5;
    var cadena = [[0, 0]];
    for (var k = 1; k <= tramos + 1; k++) cadena.push([k, -Math.floor(k / 2)]);
    var CW = p.ancho || Math.ceil(1.5 * R * (tramos + 1) + 2 * R + 4), CH = p.alto || Math.ceil(S3 * R * 1.5 + 8);
    var x0 = R + 2, y0 = S3 * R / 2 + 4;
    function pos(c) { return [x0 + 1.5 * R * c[0], y0 + S3 * R * (c[1] + c[0] / 2)]; }
    var ocup = {};
    cadena.forEach(function (c) { ocup[clave(c)] = 1; });
    var celdas = '', contornos = '';
    cadena.forEach(function (c, i) {
      var q = pos(c), extremo = i === 0 || i === cadena.length - 1, ap = APICES[i === 0 ? de : a];
      var interior = extremo ? superficie(ap.ejes, ap.etapa, wc, hc, escala) : rutaInterior(accion.eje, wc, hc);
      celdas += '<div title="' + esc(extremo ? (i === 0 ? de : a) : 'Acción Común ' + nombre) + '" style="position: absolute; left: ' + n(q[0] - Rc) + 'px; top: ' + n(q[1] - hc / 2) + 'px; width: ' + n(wc) + 'px; height: ' + n(hc) + 'px; overflow: hidden; ' + HEX + '">' + interior + '</div>';
      if (extremo) contornos += contornoHex(q[0], q[1], Rc);
    });
    var vacias = '';
    for (var q = -2; q < tramos + 6; q++) for (var r = -6; r < 6; r++) {
      if (ocup[clave([q, r])]) continue;
      var xy = pos([q, r]);
      if (-R < xy[0] && xy[0] < CW + R && -R < xy[1] && xy[1] < CH + R) vacias += poli(verticesHex(xy[0], xy[1], R - 1));
    }
    function pie(nm, alinea) {
      var d = APICES[nm];
      return '<div class="ap-accion-pie" style="text-align: ' + alinea + '"><span class="ap-accion-nombre">' + esc(nm) + '</span><span class="meta ap-suave">' + esc(d.ejes.join(' y ') + ' · ' + d.etapa) + '</span></div>';
    }
    return '<div class="ap-accion" style="width: ' + CW + 'px">' + Rotulo({ tipo: 'accion', texto: nombre }) +
      '<div style="position: relative; width: ' + CW + 'px; height: ' + CH + 'px; overflow: hidden">' +
      '<svg width="' + CW + '" height="' + CH + '" viewBox="0 0 ' + CW + ' ' + CH + '" aria-hidden="true" style="position: absolute; left: 0; top: 0"><path d="' + vacias + '" style="fill: none; stroke: var(--trama); stroke-width: var(--trazo-divisor)"></path></svg>' + celdas +
      '<svg width="' + CW + '" height="' + CH + '" viewBox="0 0 ' + CW + ' ' + CH + '" aria-hidden="true" style="position: absolute; left: 0; top: 0; pointer-events: none">' + contornos + '</svg></div>' +
      '<div class="ap-accion-pies">' + pie(de, 'left') + pie(a, 'right') + '</div></div>';
  }
  /** Leyenda de Etapa: un mismo eje en las tres reglas. */
  function LeyendaEtapa(p) {
    p = p || {};
    var eje = p.eje || 'agua', W = p.ancho || 116, H = p.alto || 38, esc_ = p.escala || 0.42;
    return '<div class="ap-leyenda-etapa">' + ETAPAS.map(function (et) {
      return '<span class="ap-leyenda-item">' + patron(eje, REGLA[et], W, H, { escala: esc_ }) + '<span class="rotulo ap-rotulo">' + et + '</span>' + (p.regla ? '<span class="meta ap-suave">' + REGLA[et] + '</span>' : '') + '</span>';
    }).join('') + '</div>';
  }
  /** Leyenda de ejes: losa de color con el glifo y el nombre del eje. */
  function LeyendaEjes(p) {
    p = p || {};
    return '<div class="ap-leyenda-ejes">' + (p.ejes || EJES).map(function (e) { return '<span class="ap-leyenda-eje">' + ficha(e, p.tam || 22) + esc(e) + '</span>'; }).join('') + '</div>';
  }
  var ICONOS = {
    ofrece: [16, 14, '<path d="M0 14L8 0L16 14z" style="fill: currentColor"></path>'],
    necesita: [16, 14, '<path d="M1.7 1L8 12L14.3 1z" style="fill: none; stroke: currentColor; stroke-width: 2.4px"></path>'],
    avanzar: [16, 18, '<path d="M0 0L16 9L0 18z" style="fill: currentColor"></path>'],
    tema: [22, 22, '<circle cx="11" cy="11" r="9.5" style="fill: none; stroke: currentColor; stroke-width: 3px"></circle><path d="M11 1.5a9.5 9.5 0 0 1 0 19z" style="fill: currentColor"></path>'],
    cerrar: [28, 28, '<path d="M5 5L23 23M23 5L5 23" style="fill: none; stroke: currentColor; stroke-width: 3.5px"></path>'],
    agregar: [28, 28, '<path d="M14 4V24M4 14H24" style="fill: none; stroke: currentColor; stroke-width: 3.5px"></path>'],
    etapa: [32, 32, '<circle cx="5.3" cy="4" r="2" style="fill: currentColor"></circle><circle cx="16" cy="4" r="2" style="fill: currentColor"></circle><circle cx="26.7" cy="4" r="2" style="fill: currentColor"></circle>' +
      '<circle cx="4" cy="16" r="4" style="fill: currentColor"></circle><circle cx="12" cy="16" r="4" style="fill: currentColor"></circle><circle cx="20" cy="16" r="4" style="fill: currentColor"></circle><circle cx="28" cy="16" r="4" style="fill: currentColor"></circle>' +
      '<svg x="0" y="24" width="32" height="8" viewBox="0 24 32 8"><circle cx="16" cy="28" r="2.4" style="fill: currentColor"></circle><circle cx="16" cy="28" r="6.5" style="fill: none; stroke: currentColor; stroke-width: 2px"></circle><circle cx="16" cy="28" r="11" style="fill: none; stroke: currentColor; stroke-width: 2px"></circle></svg>']
  };
  /** Un ícono de interfaz en currentColor. nombre: ofrece, necesita, avanzar, tema, cerrar, agregar, etapa. */
  function Icono(p) {
    p = p || {};
    var i = ICONOS[p.nombre || 'avanzar'], esc_ = (p.tam || i[1]) / i[1];
    var w = n(i[0] * esc_), h = n(i[1] * esc_);
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + i[0] + ' ' + i[1] + '" ' + (p.etiqueta ? 'role="img" aria-label="' + esc(p.etiqueta) + '"' : 'aria-hidden="true"') + ' style="display: block; flex-shrink: 0">' + i[2] + '</svg>';
  }
  function datos(p) {
    var d = p.nombre && APICES[p.nombre] ? APICES[p.nombre] : {};
    return {
      nombre: p.nombre || '', ejes: p.ejes || d.ejes || ['agua'], etapa: p.etapa || d.etapa || 'idea', zona: p.zona || d.zona || '',
      ofrece: p.ofrece != null ? p.ofrece : d.ofrece, necesita: p.necesita != null ? p.necesita : d.necesita
    };
  }
  function linea(icono, rot, txt) {
    return '<span class="ap-dato">' + Icono({ nombre: icono, tam: 11 }) + '<span><strong>' + rot + ':</strong> ' + esc(txt || 'Sin declarar.') + '</span></span>';
  }
  /** Ficha de Ápice: superficie de su patrón, nombre, ejes · Etapa · zona, qué ofrece y qué necesita. */
  function FichaApice(p) {
    p = p || {};
    var d = datos(p), W = p.ancho || 374, H = p.altoPatron || 76;
    return '<section class="ap-ficha" style="width: ' + W + 'px">' + superficie(d.ejes, d.etapa, W - 6, H, p.escala || 0.5) +
      '<div class="ap-ficha-cuerpo"><h2 class="titulo-ficha ap-titulo">' + esc(d.nombre) + '</h2>' +
      '<span class="rotulo ap-rotulo ap-suave">' + esc(d.ejes.join(' y ') + ' · ' + d.etapa + (d.zona ? ' · zona ' + d.zona : '')) + '</span>' +
      linea('ofrece', 'Ofrece', d.ofrece) + linea('necesita', 'Necesita', d.necesita) + '</div></section>';
  }
  /** Fila de Ápice para listas: superficie chica, nombre y zona. */
  function FilaApice(p) {
    p = p || {};
    var d = datos(p);
    return '<a class="ap-fila" href="' + esc(p.href || '#') + '">' + Superficie({ ejes: d.ejes, etapa: d.etapa, ancho: 56, alto: 34, escala: 0.34, contorno: true }) +
      '<span class="fila ap-fila-nombre">' + esc(d.nombre) + '</span><span class="ap-fila-zona">' + esc(d.zona) + '</span></a>';
  }
  /** Botón: 'primario' (tinta llena, con flecha) o 'secundario' (contorno). Con href sale como enlace. */
  function Boton(p) {
    p = p || {};
    var v = p.variante || 'primario', flecha = p.flecha != null ? p.flecha : v === 'primario';
    var cls = 'ap-boton ap-boton-' + v + (p.foco ? ' ap-foco' : '');
    var dentro = '<span>' + esc(p.texto || (v === 'primario' ? 'Prototipar un Ápice' : 'Conectar')) + '</span>' + (flecha ? Icono({ nombre: 'avanzar', tam: 18 }) : '');
    var est = p.ancho ? ' style="width: ' + p.ancho + 'px"' : '';
    return p.href ? '<a class="' + cls + '" href="' + esc(p.href) + '"' + est + '>' + dentro + '</a>' : '<button type="button" class="' + cls + '"' + est + (p.pulsado != null ? ' aria-pressed="' + !!p.pulsado + '"' : '') + '>' + dentro + '</button>';
  }
  /** Botón cuadrado de 44 px con un solo ícono y su etiqueta accesible. */
  function BotonIcono(p) {
    p = p || {};
    var nombre = p.icono || 'tema', etiq = p.etiqueta || { tema: 'Cambiar entre tema claro y oscuro', cerrar: 'Cerrar', agregar: 'Agregar' }[nombre] || nombre;
    return '<button type="button" class="ap-boton-icono' + (p.contorno ? ' ap-boton-icono-contorno' : '') + (p.foco ? ' ap-foco' : '') + '" aria-label="' + esc(etiq) + '">' + Icono({ nombre: nombre, tam: p.tam || 22 }) + '</button>';
  }
  var cuenta = 0;
  /** Campo de texto con su rótulo encima. */
  function Campo(p) {
    p = p || {};
    var id = p.id || ('ap-campo-' + (++cuenta));
    var ayuda = p.ayuda ? '<span class="meta ap-suave" id="' + id + '-ayuda">' + esc(p.ayuda) + '</span>' : '';
    return '<div class="ap-campo"><label class="rotulo-campo ap-rotulo" for="' + id + '">' + esc(p.etiqueta || 'Nombre') + '</label>' +
      '<input class="ap-campo-entrada' + (p.foco ? ' ap-foco' : '') + '" id="' + id + '" type="' + (p.tipo || 'text') + '" value="' + esc(p.valor || '') + '"' + (p.marcador ? ' placeholder="' + esc(p.marcador) + '"' : '') + (p.ayuda ? ' aria-describedby="' + id + '-ayuda"' : '') + '>' + ayuda + '</div>';
  }
  /** Selector de eje: un botón conmutable por eje (aria-pressed). */
  function SelectorEje(p) {
    p = p || {};
    var elegidos = (p.elegidos || ['agua']).map(eje_);
    return '<div class="ap-selector" role="group" aria-label="' + esc(p.etiqueta || 'Ejes') + '">' + (p.ejes || EJES).map(function (e) {
      e = eje_(e);
      return '<button type="button" class="ap-eje' + (p.foco === e ? ' ap-foco' : '') + '" aria-pressed="' + (elegidos.indexOf(e) >= 0) + '">' + ficha(e, 24, 'macizo', 0.25) + esc(e) + '</button>';
    }).join('') + '</div>';
  }
  var NAV = ['Ápices', 'Acciones Comunes', 'Documentación', 'Constitución', 'Foro'];
  /** Cabecera: logo, navegación, botón de tema y Entrar. El logo de cada tema lo pone bundle.css. */
  function Cabecera(p) {
    p = p || {};
    var logos = p.logos || LOGO, activo = p.activo || 'Ápices';
    var logo = (logos.claro ? '<img class="ap-logo-claro" src="' + esc(logos.claro) + '" alt="APICCA">' : '') + (logos.oscuro ? '<img class="ap-logo-oscuro" src="' + esc(logos.oscuro) + '" alt="APICCA">' : '');
    if (!logo) logo = '<span class="ap-logo-texto">APICCA</span>';
    return '<header class="ap-cabecera"><a class="ap-logo" href="' + esc(p.inicio || '#') + '" aria-label="APICCA, ir al inicio">' + logo + '</a>' +
      '<nav class="navegacion ap-nav" aria-label="Principal">' + (p.enlaces || NAV).map(function (t) { return '<a href="#"' + (t === activo ? ' aria-current="page"' : '') + '>' + esc(t) + '</a>'; }).join('') + '</nav>' +
      '<div class="ap-cabecera-fin">' + BotonIcono({ icono: 'tema' }) + '<a class="ap-boton ap-boton-secundario ap-boton-chico" href="#">' + esc(p.entrar || 'Entrar') + '</a></div></header>';
  }

  window.Apicca = {
    // componentes
    Glifo: Glifo, Superficie: Superficie, Celda: Celda, Mapa: Mapa, AccionComun: AccionComun, Rotulo: Rotulo,
    LeyendaEtapa: LeyendaEtapa, LeyendaEjes: LeyendaEjes, FichaApice: FichaApice, FilaApice: FilaApice,
    Boton: Boton, BotonIcono: BotonIcono, Campo: Campo, SelectorEje: SelectorEje, Cabecera: Cabecera, Icono: Icono,
    // geometría
    patron: patron, superficie: superficie, forma: forma, ficha: ficha, franjas: franjas, ruta: rutaInterior,
    _trazos: { tres: tres, enc: enc, eco: ecoD, poli: poli, g: g },
    // vocabulario y datos
    EJES: EJES, GLIFO: GLIFO, ETAPAS: ETAPAS, REGLA: REGLA, NOTA_REGLA: NOTA_REGLA, CLAVE: CLAVE, NAV: NAV, LOGO: LOGO,
    demo: { APICES: APICES, ACCIONES: ACCIONES, DISP_ANCHA: DISP_ANCHA, DISP_ALTA: DISP_ALTA }
  };
})();
