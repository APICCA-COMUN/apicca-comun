// Geometría del sistema «APICCA · Mapa» (23-11-2026): los cinco glifos de eje, las tres reglas de patrón y el glifo
// suelto. Es un port tipado de `patron`, `forma`, `franjas` y `REGLA` del `bundle.js` del sistema
// (copia en `tests/fixtures/sistema-mapa/bundle.js`; la prueba de paridad compara los trazados número a número).
// Devuelve datos (trazados y viewBox), no HTML: el componente React decide cómo pintarlos.
//
// Decidido por la persona: los glifos (agua círculo, alimento trapecio, cobijo cuadrado, energía triángulo,
// comunicación barra diagonal) y las reglas (tresbolillo, encaje y eco). La regla de cada Etapa es propuesta del
// asistente y sigue «Por decidir» en el sistema.
import type { ApiceStatus } from '../apice';
import type { AxisKey } from './axes';

export type PatternRule = 'tresbolillo' | 'encaje' | 'eco';
export type GlyphMode = 'macizo' | 'contorno' | 'mitad';

/** La regla de patrón de cada Etapa: siempre esta, nunca elegida a mano. */
export const RULE_BY_STATUS: Readonly<Record<ApiceStatus, PatternRule>> = {
  idea: 'tresbolillo',
  prototipo: 'encaje',
  'en marcha': 'eco',
};

/** Qué dibuja cada glifo, en palabras, para nombres accesibles y leyendas. */
export const GLYPH_NAME: Readonly<Record<AxisKey, string>> = {
  agua: 'círculo',
  alimento: 'trapecio',
  cobijo: 'cuadrado',
  energia: 'triángulo',
  comunicacion: 'barra diagonal',
};

type Point = readonly [number, number];

const f1 = (v: number) => v.toFixed(1);
const n = (v: number) => v.toFixed(1).replace(/\.0$/, '');
const trunc = Math.trunc;

const CIRCLE: Point[] = Array.from({ length: 48 }, (_, k) => [0.9 * Math.cos((k * Math.PI) / 24), 0.9 * Math.sin((k * Math.PI) / 24)]);

/** Los cinco glifos en unidades (−1…1). */
export const GLYPH_UNIT: Readonly<Record<AxisKey, readonly Point[]>> = {
  agua: CIRCLE,
  alimento: [[-1, -0.62], [1, -0.62], [0.58, 0.62], [-0.58, 0.62]],
  cobijo: [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]],
  energia: [[0, -0.92], [0.98, 0.78], [-0.98, 0.78]],
  comunicacion: [[-1, 0.6], [0.6, -1], [1, -0.6], [-0.6, 1]],
};

/** Polígono cerrado en un trazado SVG, con un decimal. */
export function polygon(pts: readonly Point[]): string {
  return 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
}

function g(key: AxisKey, cx: number, cy: number, s: number, ang = 0, base?: readonly Point[]): string {
  const r = (ang * Math.PI) / 180;
  const c = Math.cos(r);
  const d = Math.sin(r);
  return polygon((base ?? GLYPH_UNIT[key]).map((p) => [cx + s * (p[0] * c - p[1] * d), cy + s * (p[0] * d + p[1] * c)] as const));
}

const TURN: Partial<Record<AxisKey, number>> = { alimento: 180, cobijo: 45, energia: 180, comunicacion: 90 };

function tresbolillo(key: AxisKey, W: number, H: number, c = 40): string {
  let d = '';
  const J = trunc(H / (c * 0.825)) + 2;
  const I = trunc(W / c) + 2;
  for (let j = 0; j < J; j++)
    for (let i = -1; i < I; i++) {
      const odd = j % 2;
      const x = (i + odd * 0.5) * c + c / 2;
      const y = j * c * 0.825 + 1;
      d += key === 'agua' ? g(key, x, y, ((odd ? 6 : 13) * c) / 40) : g(key, x, y, (12 * c) / 40, odd ? TURN[key] : 0);
    }
  return d;
}

function bars(W: number, h: number, y: number, mirror: number): string {
  const t = h * 0.62;
  const joint = h * 0.16;
  let d = '';
  let x = -2 * h;
  while (x < W + h) {
    const a = mirror ? y : y + h;
    const b = mirror ? y + h : y;
    d += 'M' + n(x) + ' ' + n(a) + 'L' + n(x + h) + ' ' + n(b) + 'H' + n(x + h + t) + 'L' + n(x + t) + ' ' + n(a) + 'Z';
    x += t + joint;
  }
  return d;
}

function encaje(key: AxisKey, W: number, H: number, u = 50): string {
  let d = '';
  const ni = trunc(W / u) + 3;
  const nj = trunc(H / u) + 3;
  if (key === 'agua') {
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) d += g(key, u / 2 + u * i, u / 2 + u * j, u / 1.8);
    return d;
  }
  if (key === 'alimento') {
    const T = 0.844 * u;
    const B = 0.49 * u;
    const Hh = 0.668 * u;
    for (let j = 0; j < trunc(H / Hh) + 2; j++)
      for (let i = -1; i < trunc(W / (T + B)) + 2; i++) {
        const x = (T + B) * i + ((T + B) / 2) * (j % 2) + T / 2;
        const y = Hh * j;
        d += 'M' + n(x - T / 2) + ' ' + n(y) + 'H' + n(x + T / 2) + 'L' + n(x + B / 2) + ' ' + n(y + Hh) + 'H' + n(x - B / 2) + 'Z';
      }
    return d;
  }
  if (key === 'cobijo') {
    for (let j = 0; j < nj; j++)
      for (let i = 0; i < ni; i++) if ((i + j) % 2 === 0) d += 'M' + n(u * i) + ' ' + n(u * j) + 'h' + n(u) + 'v' + n(u) + 'h' + n(-u) + 'Z';
    return d;
  }
  if (key === 'energia') {
    for (let j = 0; j < nj; j++)
      for (let i = 0; i < ni + 1; i++) d += 'M' + n(u * i + ((j % 2) * u) / 2 - u) + ' ' + n(u * j + u) + 'h' + n(u) + 'l' + n(-u / 2) + ' ' + n(-u) + 'Z';
    return d;
  }
  // comunicación: espiga, cada hilera de barras se inclina al revés que la anterior
  const h = 0.6 * u;
  for (let j = 0; j < trunc(H / h) + 2; j++) d += bars(W, h, h * j, j % 2);
  return d;
}

const TRI: Point[] = [[0, -1.1337], [0.98, 0.5663], [-0.98, 0.5663]]; // el triángulo con el incentro en el origen
const ECO_STEP: Partial<Record<AxisKey, number>> = { agua: 0.9, alimento: 0.62, cobijo: 0.8 };

function eco(key: AxisKey, echoes: number | undefined, reach: number): [string, string] {
  let piece: (k: number) => string;
  let step: number;
  if (key === 'energia') {
    piece = (k) => g(key, 0, 0, (k === 0 ? 13.5 : 9 + 20 * k) / 0.5663, 0, TRI);
    step = 20;
  } else if (key === 'comunicacion') {
    piece = (k) => {
      const a = 24 + 18 * k;
      const b = 6 + 18 * k;
      return g(key, 0, 0, 1, -45, [[-a, -b], [a, -b], [a, b], [-a, b]]);
    };
    step = 18;
  } else {
    piece = (k) => g(key, 0, 0, 14 + 27 * k);
    step = 27 * ECO_STEP[key]!;
  }
  const total = echoes ?? trunc(reach / step) + 2;
  let rings = '';
  for (let k = 1; k <= total; k++) rings += piece(k);
  return [piece(0), rings];
}

export interface PatternOptions {
  /** Píxeles por unidad del patrón (0,55 por defecto). */
  scale?: number;
  /** Centro del eco, en fracciones del ancho y el alto (0,5 y 0,5 por defecto). */
  anchor?: readonly [number, number];
  /** Paso de la rejilla de tresbolillo (40) o de encaje (50), en unidades. */
  module?: number;
  /** Cuántos anillos lleva el eco; por defecto, los que llenan la superficie. */
  echoes?: number;
}

/** Lo que se pinta en una superficie: el fondo es el color del eje y todo lo demás va en `glifo-sobre-eje`. */
export interface PatternData {
  viewBox: string;
  /** Formas macizas. */
  solid: string;
  /** Anillos del eco, como trazo sin relleno. */
  stroke?: { d: string; width: number };
}

/** La superficie de W × H px de un eje con una regla. */
export function pattern(key: AxisKey, rule: PatternRule, W: number, H: number, o: PatternOptions = {}): PatternData {
  const scale = o.scale ?? 0.55;
  const anchor = o.anchor ?? [0.5, 0.5];
  const vw = W / scale;
  const vh = H / scale;
  if (rule === 'tresbolillo') return { viewBox: '0 0 ' + n(vw) + ' ' + n(vh), solid: tresbolillo(key, vw, vh, o.module ?? 40) };
  if (rule === 'encaje') return { viewBox: '0 0 ' + n(vw) + ' ' + n(vh), solid: encaje(key, vw, vh, o.module ?? 50) };
  const [core, rings] = eco(key, o.echoes, Math.hypot(vw, vh));
  return {
    viewBox: n(-vw * anchor[0]) + ' ' + n(-vh * anchor[1]) + ' ' + n(vw) + ' ' + n(vh),
    solid: core,
    stroke: { d: rings, width: 9 },
  };
}

function cutY(pts: readonly Point[], m: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    if (p[1] >= m) out.push(p);
    if (p[1] >= m !== q[1] >= m) {
      const t = (m - p[1]) / (q[1] - p[1]);
      out.push([p[0] + t * (q[0] - p[0]), m]);
    }
  }
  return out;
}

/** El glifo suelto centrado en (cx, cy), de semilado s. */
export interface GlyphData {
  /** Trazado del glifo entero. */
  d: string;
  /** En `contorno` y `mitad`, grosor del trazo; en `macizo`, no hay. */
  strokeWidth?: number;
  /** En `mitad`, la mitad de abajo maciza. */
  half?: string;
}

export function glyph(key: AxisKey, cx: number, cy: number, s: number, mode: GlyphMode = 'macizo'): GlyphData {
  const ys = GLYPH_UNIT[key].map((p) => p[1]);
  const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
  const pts = GLYPH_UNIT[key].map((p) => [cx + s * p[0], cy + s * (p[1] - middle)] as const);
  if (mode === 'macizo') return { d: polygon(pts) };
  const strokeWidth = Number(f1(Math.max(1.3, s * 0.17)));
  return mode === 'mitad' ? { d: polygon(pts), strokeWidth, half: polygon(cutY(pts, cy)) } : { d: polygon(pts), strokeWidth };
}

/** Los seis vértices de un hexágono plano arriba de radio r, como el teselado del sistema. */
export function hexVertices(x: number, y: number, r: number): Point[] {
  return Array.from({ length: 6 }, (_, k) => [x + r * Math.cos((Math.PI / 3) * k), y + r * Math.sin((Math.PI / 3) * k)] as const);
}
