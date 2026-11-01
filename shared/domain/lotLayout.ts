// RF-6 (005) · 6.1 a 6.3, 6.7, 6.9, D-6 (005), D-T3 (005): retícula del lote ilustrado. Cada ápice ocupa una celda según
// su lugar en la lista, de izquierda a derecha y de arriba abajo; los caminos corren entre las filas y entre las
// columnas, como calles entre manzanas, y cada cruce lleva un nodo. Las medidas van en unidades de celda. Es
// determinista: la misma lista y el mismo ancho dan siempre el mismo dibujo. Sin React ni DOM.

/** Ancho de una celda del lote, en píxeles. */
export const LOT_CELL = 160;
/** Columnas como máximo. */
export const LOT_MAX_COLUMNS = 6;

export interface LotCell {
  row: number;
  column: number;
}

/** Tramo recto de camino, de (x1, y1) a (x2, y2), en unidades de celda. */
export interface LotRoad {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LotLayout {
  columns: number;
  rows: number;
  cells: LotCell[];
  roads: LotRoad[];
  nodes: { x: number; y: number }[];
}

/** Columnas que caben en `width` píxeles: de 1 a 6. */
export function lotColumns(width: number): number {
  if (!Number.isFinite(width)) return 1;
  return Math.min(LOT_MAX_COLUMNS, Math.max(1, Math.floor(width / LOT_CELL)));
}

/** Dibujo de `count` edificios en `maxColumns` columnas como mucho. */
export function lotLayout(count: number, maxColumns: number): LotLayout {
  if (count <= 0) return { columns: 0, rows: 0, cells: [], roads: [], nodes: [] };
  const columns = Math.min(count, Math.max(1, Math.floor(maxColumns)));
  const rows = Math.ceil(count / columns);
  const cells = Array.from({ length: count }, (_, index) => ({ row: Math.floor(index / columns), column: index % columns }));
  const roads: LotRoad[] = [];
  for (let y = 1; y < rows; y += 1) roads.push({ x1: 0, y1: y, x2: columns, y2: y });
  for (let x = 1; x < columns; x += 1) roads.push({ x1: x, y1: 0, x2: x, y2: rows });
  const nodes: { x: number; y: number }[] = [];
  for (let y = 1; y < rows; y += 1) for (let x = 1; x < columns; x += 1) nodes.push({ x, y });
  return { columns, rows, cells, roads, nodes };
}

/** Índice del edificio vecino en la dirección de la flecha, o `null` si no hay. */
export function lotNeighbor(index: number, key: string, count: number, columns: number): number | null {
  const per = Math.max(1, Math.min(count, columns));
  const sameRow = (other: number) => Math.floor(other / per) === Math.floor(index / per);
  let next: number;
  switch (key) {
    case 'ArrowRight':
      next = index + 1;
      return next < count && sameRow(next) ? next : null;
    case 'ArrowLeft':
      next = index - 1;
      return next >= 0 && sameRow(next) ? next : null;
    case 'ArrowDown':
      next = index + per;
      return next < count ? next : null;
    case 'ArrowUp':
      next = index - per;
      return next >= 0 ? next : null;
    default:
      return null;
  }
}

/** Ancho mínimo del lote, en píxeles, para dibujar el recorrido en zigzag. */
export const TRAIL_MIN_WIDTH = 560;
/** Alto de una franja del recorrido, en píxeles. */
const TRAIL_BAND = 560;
/** Edificios por franja. */
const TRAIL_PER_BAND = 6;

export interface TrailPoint {
  x: number;
  y: number;
}

/** Recorrido en zigzag: todo en porcentaje del lote (0 a 100 en cada eje). */
export interface LotTrail {
  bands: number;
  /** Alto mínimo del lote, en píxeles. */
  minHeight: number;
  points: TrailPoint[];
  roads: LotRoad[];
  nodes: TrailPoint[];
}

// RF-6 (005) · 6.10, D-11 (005), D-T11 (005): las posiciones, los caminos y los nodos de una franja, como en el canvas.
// `from` es cuántos edificios hacen falta para que aparezca el camino o el nodo.
const SLOTS: TrailPoint[] = [
  { x: 40, y: 46 },
  { x: 18, y: 22 },
  { x: 76, y: 20 },
  { x: 82, y: 54 },
  { x: 58, y: 76 },
  { x: 18, y: 70 },
];
const SEGMENTS: { from: number; road: LotRoad }[] = [
  { from: 2, road: { x1: 18, y1: 22, x2: 40, y2: 22 } },
  { from: 2, road: { x1: 40, y1: 22, x2: 40, y2: 46 } },
  { from: 3, road: { x1: 40, y1: 46, x2: 60, y2: 46 } },
  { from: 3, road: { x1: 60, y1: 46, x2: 60, y2: 20 } },
  { from: 3, road: { x1: 60, y1: 20, x2: 76, y2: 20 } },
  { from: 4, road: { x1: 60, y1: 46, x2: 82, y2: 46 } },
  { from: 4, road: { x1: 82, y1: 46, x2: 82, y2: 54 } },
  { from: 5, road: { x1: 40, y1: 46, x2: 40, y2: 70 } },
  { from: 5, road: { x1: 40, y1: 70, x2: 58, y2: 70 } },
  { from: 5, road: { x1: 58, y1: 70, x2: 58, y2: 76 } },
  { from: 6, road: { x1: 40, y1: 70, x2: 18, y2: 70 } },
];
const NODES: { from: number; point: TrailPoint }[] = [
  { from: 2, point: { x: 40, y: 22 } },
  { from: 3, point: { x: 60, y: 46 } },
  { from: 5, point: { x: 40, y: 70 } },
];

/** Recorrido en zigzag de `count` edificios: depende solo de la cantidad. */
export function lotTrail(count: number): LotTrail {
  if (count <= 0) return { bands: 0, minHeight: 0, points: [], roads: [], nodes: [] };
  const bands = Math.ceil(count / TRAIL_PER_BAND);
  // Una franja ocupa 1/bands del alto; (x, y) de la franja pasa a porcentaje del lote.
  const at = (band: number, p: TrailPoint): TrailPoint => ({ x: p.x, y: (band * 100 + p.y) / bands });
  const points: TrailPoint[] = [];
  const roads: LotRoad[] = [];
  const nodes: TrailPoint[] = [];
  for (let band = 0; band < bands; band += 1) {
    const used = Math.min(TRAIL_PER_BAND, count - band * TRAIL_PER_BAND);
    for (let i = 0; i < used; i += 1) points.push(at(band, SLOTS[i]!));
    for (const { from, road } of SEGMENTS) {
      if (used < from) continue;
      const a = at(band, { x: road.x1, y: road.y1 });
      const b = at(band, { x: road.x2, y: road.y2 });
      roads.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    for (const { from, point } of NODES) if (used >= from) nodes.push(at(band, point));
    // Una calle une el fondo de cada franja con la siguiente.
    if (band < bands - 1) {
      const a = at(band, { x: 40, y: 70 });
      const b = at(band + 1, { x: 40, y: 22 });
      roads.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
  return { bands, minHeight: TRAIL_BAND * bands, points, roads, nodes };
}

/** Índice del edificio al que lleva la flecha en el recorrido, o `null` si no hay. */
export function lotTrailNeighbor(index: number, key: string, points: readonly TrailPoint[]): number | null {
  if (key === 'ArrowRight') return index + 1 < points.length ? index + 1 : null;
  if (key === 'ArrowLeft') return index - 1 >= 0 ? index - 1 : null;
  if (key !== 'ArrowUp' && key !== 'ArrowDown') return null;
  const from = points[index];
  if (from === undefined) return null;
  const sign = key === 'ArrowDown' ? 1 : -1;
  let best: number | null = null;
  let bestDistance = Infinity;
  points.forEach((point, other) => {
    if ((point.y - from.y) * sign <= 0) return;
    const distance = (point.x - from.x) ** 2 + (point.y - from.y) ** 2;
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  });
  return best;
}
