// El «Arco»: el dibujo de una Acción Común sobre el mapa hexagonal (sistema «APICCA · Mapa»). Une sus Ápices, de uno en
// uno, con curvas cuadráticas suaves que esquivan los demás Ápices, termina en un disco sobre cada parada y lleva un
// rótulo junto a la curva. Puro: sin React, sin DOM, sin h3 y sin colores; todo en píxeles del lienzo (el eje y crece
// hacia abajo). Geometría portada del generador de imágenes de la dirección elegida (página 9 de las exploraciones).
import { pathLabelWidth, rectsOverlap, type LabelRect } from './mapPaths';

/** Un punto del lienzo, en píxeles. */
export interface ArcPoint {
  x: number;
  y: number;
}

/** Una parada del Arco: el centro de la celda de un Ápice (o de lo que lo represente en este nivel). */
export interface ArcStop extends ArcPoint {
  id?: string;
}

/** Lo que el Arco esquiva: los centros de todos los Ápices del mapa (también los de sus propias paradas). */
export interface ArcObstacles {
  apices: readonly ArcPoint[];
}

/** Un tramo entre dos paradas seguidas, ya recortado fuera de 0,78 R de los centros de sus extremos. */
export interface ArcSegment {
  /** Path SVG `M x y Q cx cy x y`, redondeado a 0,1 px: la subcurva exacta (de Casteljau) de la cuadrática elegida. */
  d: string;
  /** La comba, como fracción de la distancia entre las paradas (`ARC_BENDS`). */
  k: number;
  /** De qué lado del tramo a→b se curva: `1` hacia (-dy, dx) (a la derecha de la marcha en pantalla, y hacia abajo si va de izquierda a derecha); `-1`, al contrario. */
  side: 1 | -1;
  /** Cuántos Ápices (que no son sus paradas) toca este tramo: están a menos de R de su curva. */
  pisa: number;
  /** Puntos de la curva recortada, de la entrada a la salida (`ARC_SAMPLE_STEPS + 1`). */
  samples: ArcPoint[];
}

/** El disco que marca una parada. */
export interface ArcDisc extends ArcPoint {
  r: number;
}

export interface Arc {
  /** Los índices de las paradas recibidas, en el orden en que el Arco las recorre (sin las coincidentes). */
  order: number[];
  /** Los centros de las paradas en ese orden (`stops[order[i]]`). */
  stops: ArcPoint[];
  /** Un tramo por cada par de paradas seguidas; falta el de un par tan junto que no queda curva fuera de los extremos. */
  segments: ArcSegment[];
  /** Un disco por parada, en el orden de `order`: en el punto de recorte del tramo que llega (en el primero, del que sale); sin tramo, en el centro. */
  discs: ArcDisc[];
  /** Cuántos Ápices pisa el Arco entero (la suma de los tramos). */
  pisa: number;
  /** El radio de celda con el que se calculó (lo necesita `placeArcLabel`). */
  radius: number;
}

/** Las dos combas que se prueban, como fracción de la distancia entre las paradas. */
export const ARC_BENDS = [0.16, 0.26] as const;
/** Cuántos tramos de recta se usan para muestrear cada curva (así hay `ARC_SAMPLE_STEPS + 1` puntos). */
export const ARC_SAMPLE_STEPS = 48;
/** Dónde se corta el tramo cerca de una parada, en radios de celda. */
const CLIP = 0.78;
/** Hasta qué distancia de la curva un Ápice cuenta como pisado, en radios de celda. */
const TOUCH = 1;
/** Parada y parada a menos de esto son la misma (px). */
const SAME = 0.5;
/** Cuánto pesa en la elección cada Ápice pisado frente a la comba. */
const TOUCH_WEIGHT = 10;

/** El grosor de la línea del Arco para un radio de celda `radius`. */
export function arcStroke(radius: number): number {
  return Math.max(1.4, (1.8 * radius) / 46);
}

/** El grosor del halo (el contorno del color del papel que despega la línea del fondo). */
export function arcHalo(radius: number): number {
  return arcStroke(radius) + 5;
}

/** El radio de los discos de las paradas. */
export function arcDiscR(radius: number): number {
  return (4.5 * radius) / 46 + 1;
}

const dist = (a: ArcPoint, b: ArcPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * El orden en que el Arco recorre las paradas: sin las coincidentes (queda la primera), empieza por la más lejana del
 * centroide y sigue siempre con la más cercana de las que faltan. Los empates los gana el índice menor. Devuelve los
 * índices de `stops`.
 */
export function orderArcStops(stops: readonly ArcPoint[]): number[] {
  const kept: number[] = [];
  stops.forEach((stop, index) => {
    if (!kept.some((other) => dist(stops[other]!, stop) < SAME)) kept.push(index);
  });
  if (kept.length === 0) return [];
  const cx = kept.reduce((sum, index) => sum + stops[index]!.x, 0) / kept.length;
  const cy = kept.reduce((sum, index) => sum + stops[index]!.y, 0) / kept.length;
  const fromCentroid = (index: number) => (stops[index]!.x - cx) ** 2 + (stops[index]!.y - cy) ** 2;
  let first = kept[0]!;
  for (const index of kept) if (fromCentroid(index) > fromCentroid(first)) first = index;
  const order = [first];
  let rest = kept.filter((index) => index !== first);
  while (rest.length > 0) {
    const last = stops[order[order.length - 1]!]!;
    const gap = (index: number) => (stops[index]!.x - last.x) ** 2 + (stops[index]!.y - last.y) ** 2;
    let next = rest[0]!;
    for (const index of rest) if (gap(index) < gap(next)) next = index;
    order.push(next);
    rest = rest.filter((index) => index !== next);
  }
  return order;
}

/** Una cuadrática: el extremo, el punto de control y el otro extremo. */
interface Quad {
  a: ArcPoint;
  c: ArcPoint;
  b: ArcPoint;
}

const quadAt = ({ a, c, b }: Quad, t: number): ArcPoint => {
  const v = 1 - t;
  return { x: v * v * a.x + 2 * v * t * c.x + t * t * b.x, y: v * v * a.y + 2 * v * t * c.y + t * t * b.y };
};

/** La cuadrática de a a b con el punto de control en el medio, desplazado `k` veces la distancia hacia un lado. */
function bend(a: ArcPoint, b: ArcPoint, k: number, side: 1 | -1): Quad {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length;
  const ny = dx / length;
  return { a, b, c: { x: (a.x + b.x) / 2 + nx * length * k * side, y: (a.y + b.y) / 2 + ny * length * k * side } };
}

const CLIP_SCAN = 200;
const CLIP_BISECT = 24;

/** El primer `t` (desde `from` hacia `to`) en que la curva sale de la distancia `radius` del centro `center`, afinado por bisección. */
function leaveCircle(quad: Quad, center: ArcPoint, radius: number, from: number, to: number): number | null {
  let previous = from;
  for (let step = 1; step <= CLIP_SCAN; step += 1) {
    const t = from + ((to - from) * step) / CLIP_SCAN;
    if (dist(quadAt(quad, t), center) > radius) {
      let inside = previous;
      let outside = t;
      for (let round = 0; round < CLIP_BISECT; round += 1) {
        const middle = (inside + outside) / 2;
        if (dist(quadAt(quad, middle), center) > radius) outside = middle;
        else inside = middle;
      }
      return outside;
    }
    previous = t;
  }
  return null;
}

/** La parte de la cuadrática entre `t0` y `t1`, también cuadrática (de Casteljau). */
function subQuad(quad: Quad, t0: number, t1: number): Quad {
  const start = quadAt(quad, t0);
  const end = quadAt(quad, t1);
  const s = 1 - t0;
  const span = t1 - t0;
  return {
    a: start,
    b: end,
    c: {
      x: start.x + span * (s * (quad.c.x - quad.a.x) + t0 * (quad.b.x - quad.c.x)),
      y: start.y + span * (s * (quad.c.y - quad.a.y) + t0 * (quad.b.y - quad.c.y)),
    },
  };
}

/** Redondea a 0,1 px sin dejar un «-0». */
const round1 = (value: number): number => Math.round(value * 10) / 10 + 0;

const pathOf = ({ a, c, b }: Quad): string =>
  `M${round1(a.x)} ${round1(a.y)}Q${round1(c.x)} ${round1(c.y)} ${round1(b.x)} ${round1(b.y)}`;

const sampleQuad = (quad: Quad): ArcPoint[] =>
  Array.from({ length: ARC_SAMPLE_STEPS + 1 }, (_, step) => quadAt(quad, step / ARC_SAMPLE_STEPS));

/** La curva de a a b sin sus extremos (fuera de `clip` px de a y de b), o `null` si no queda nada. */
function clipped(a: ArcPoint, b: ArcPoint, k: number, side: 1 | -1, clip: number): Quad | null {
  const quad = bend(a, b, k, side);
  if (clip <= 0) return quad;
  const t0 = leaveCircle(quad, a, clip, 0, 1);
  const t1 = leaveCircle(quad, b, clip, 1, 0);
  return t0 === null || t1 === null || t0 >= t1 ? null : subQuad(quad, t0, t1);
}

/**
 * Un tramo de a a b con la comba `k` hacia `side`, sin los extremos que quedan a menos de `clip` px de a y de b (`0` los
 * deja enteros). Sirve para dibujar el Arco fuera del mapa, entre dos puntos sueltos. `null` si a y b coinciden o no
 * queda curva fuera de los recortes. No cuenta Ápices pisados (`pisa` es 0).
 */
export function arcSegment(a: ArcPoint, b: ArcPoint, k: number, side: 1 | -1, clip = 0): ArcSegment | null {
  if (dist(a, b) < SAME) return null;
  const quad = clipped(a, b, k, side, clip);
  return quad === null ? null : { d: pathOf(quad), k, side, pisa: 0, samples: sampleQuad(quad) };
}

/** Cuántos de `apices` (menos a y b) quedan a menos de `reach` de alguna de las muestras. */
function touched(samples: readonly ArcPoint[], apices: readonly ArcPoint[], a: ArcPoint, b: ArcPoint, reach: number): number {
  let count = 0;
  for (const apice of apices) {
    if (dist(apice, a) <= 1 || dist(apice, b) <= 1) continue;
    if (samples.some((sample) => dist(sample, apice) < reach)) count += 1;
  }
  return count;
}

/**
 * El Arco de una Acción Común: ordena las paradas (`orderArcStops`) y une cada par seguido con la cuadrática (`k`, lado) que
 * menos Ápices pisa (minimiza `pisa · 10 + k`, y a igual puntuación gana el primero de `ARC_BENDS` × [1, -1]), recortada
 * fuera de 0,78 R de las dos paradas. `radius` es el radio de la celda (R) en píxeles. `null` si no hay dos paradas
 * distintas (o R no es positivo).
 */
export function buildArc(stops: readonly ArcStop[], radius: number, obstacles: ArcObstacles): Arc | null {
  if (!(radius > 0)) return null;
  const order = orderArcStops(stops);
  if (order.length < 2) return null;
  const centers: ArcPoint[] = order.map((index) => ({ x: stops[index]!.x, y: stops[index]!.y }));
  const clip = radius * CLIP;
  const discR = arcDiscR(radius);
  const segments: ArcSegment[] = [];
  const discs: ArcDisc[] = centers.map((center) => ({ x: round1(center.x), y: round1(center.y), r: discR }));
  let pisa = 0;
  for (let index = 1; index < centers.length; index += 1) {
    const a = centers[index - 1]!;
    const b = centers[index]!;
    let best: { score: number; quad: Quad; samples: ArcPoint[]; k: number; side: 1 | -1; pisa: number } | null = null;
    for (const side of [1, -1] as const) {
      for (const k of ARC_BENDS) {
        const quad = clipped(a, b, k, side, clip);
        if (quad === null) continue;
        const samples = sampleQuad(quad);
        const hits = touched(samples, obstacles.apices, a, b, radius * TOUCH);
        const score = hits * TOUCH_WEIGHT + k;
        if (best === null || score < best.score) best = { score, quad, samples, k, side, pisa: hits };
      }
    }
    if (best === null) continue;
    pisa += best.pisa;
    segments.push({ d: pathOf(best.quad), k: best.k, side: best.side, pisa: best.pisa, samples: best.samples });
    discs[index] = { x: round1(best.quad.b.x), y: round1(best.quad.b.y), r: discR };
    if (index === 1) discs[0] = { x: round1(best.quad.a.x), y: round1(best.quad.a.y), r: discR };
  }
  if (segments.length === 0) return null;
  return { order, stops: centers, segments, discs, pisa, radius };
}

/** Lo que el rótulo del Arco respeta además de la ventana: Ápices (círculo de radio R), y rectángulos (rótulos de zona, otros rótulos, leyenda y controles). */
export interface ArcOccupied {
  apices: readonly ArcPoint[];
  rects: readonly LabelRect[];
}

/** El lugar de un rótulo: esquina superior izquierda y tamaño, en píxeles. */
export interface ArcLabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** El alto del rótulo y lo que mide su glifo del eje con su separación, en píxeles. */
export const ARC_LABEL_HEIGHT = 24;
const GLYPH_WIDTH = 14;
const GLYPH_GAP = 6;
/** Lo que se separa el rótulo de la curva, y el aire mínimo entre rótulos y rectángulos ocupados. */
const LABEL_OFFSET = 6;
const LABEL_GAP = 4;
/** Se prueba una muestra de cada tantas. */
const LABEL_STRIDE = 4;
/** Los seis lugares junto a una muestra: arriba y abajo centrado, y las cuatro esquinas. */
const LABEL_SIDES: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Lo que mide el rótulo de un Arco con `text`: glifo, separación y texto (con el relleno de `pathLabelWidth`). */
export function arcLabelWidth(text: string): number {
  return GLYPH_WIDTH + GLYPH_GAP + pathLabelWidth([...text].length);
}

/** Si el círculo de centro `center` y radio `radius` toca el rectángulo. */
function circleTouches(rect: LabelRect, center: ArcPoint, radius: number): boolean {
  const x = Math.min(Math.max(center.x, rect.left), rect.right);
  const y = Math.min(Math.max(center.y, rect.top), rect.bottom);
  return Math.hypot(center.x - x, center.y - y) < radius;
}

/**
 * Dónde va el rótulo de `text` (glifo del eje + texto) junto al Arco: se prueban las muestras del arco del medio hacia los
 * lados y, en cada una, seis lugares (arriba, abajo y las cuatro esquinas, a 6 px; si no hay sitio, a R + 6 px y a 2R + 6 px). Se descarta el que toca un Ápice de
 * `occupied.apices` (o una parada del propio Arco) a menos de R, queda a menos de 4 px de un rectángulo de
 * `occupied.rects`, cruza el propio Arco o no cabe entero en `view`. Devuelve el primero que sirve, o `null`.
 */
export function placeArcLabel(arc: Arc, text: string, occupied: ArcOccupied, view: LabelRect): ArcLabelBox | null {
  const samples = arc.segments.flatMap((segment) => segment.samples);
  if (samples.length === 0) return null;
  const w = arcLabelWidth(text);
  const h = ARC_LABEL_HEIGHT;
  const apices = [...occupied.apices, ...arc.stops];
  const middle = (samples.length - 1) / 2;
  const indexes = samples.map((_, index) => index).filter((index) => index % LABEL_STRIDE === 0);
  indexes.sort((x, y) => Math.abs(x - middle) - Math.abs(y - middle) || x - y);
  // Primero pegado a la curva; si las celdas de alrededor no dejan sitio (Ápices juntos en una zona), un poco más lejos.
  for (const gap of [LABEL_OFFSET, arc.radius + LABEL_OFFSET, 2 * arc.radius + LABEL_OFFSET]) {
    for (const index of indexes) {
      const p = samples[index]!;
      for (const [ax, ay] of LABEL_SIDES) {
        const left = ax === 0 ? p.x - w / 2 : ax < 0 ? p.x - w - gap : p.x + gap;
        const top = ay < 0 ? p.y - h - gap : p.y + gap;
        const rect: LabelRect = { left, top, right: left + w, bottom: top + h };
        if (rect.left < view.left || rect.right > view.right || rect.top < view.top || rect.bottom > view.bottom) continue;
        if (apices.some((apice) => circleTouches(rect, apice, arc.radius))) continue;
        if (occupied.rects.some((area) => rectsOverlap(rect, area, LABEL_GAP))) continue;
        if (samples.some((sample) => sample.x > rect.left && sample.x < rect.right && sample.y > rect.top && sample.y < rect.bottom)) continue;
        return { x: left, y: top, w, h };
      }
    }
  }
  return null;
}
