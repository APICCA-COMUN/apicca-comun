// RF-18 (021) · 18.2, 18.7, D-T30 (021) · La ruta de una Acción Común en el mapa teselado (sistema «APICCA · Mapa»): una
// fila de celdas H3 de `ruta` entre las celdas de sus Ápices, y dónde va su rótulo. Puro, sin React ni DOM; trabaja sobre
// lo que ya calculó `layoutMap` (hexmap.ts) y pide las celdas del trazo a `h3cells.ts`.
import { LEVEL_RESOLUTION, isCellOf, routeCells } from './h3cells';
import { drawCell, type MapCell, type MapLayout } from './hexmap';

export interface PathPoint {
  x: number;
  y: number;
}

/** Dónde se apoya un rótulo y de qué lado crece: `start` lo deja a la derecha del punto y `end`, a la izquierda. */
export interface PathLabel extends PathPoint {
  align: 'start' | 'end';
  /** El ancho al que se acorta el rótulo (con puntos suspensivos) cuando no cabe entero en el sitio libre; sin él, el de su texto. */
  width?: number;
}

/** Las celdas por las que pasa una ruta y la celda H3 de cada punto de apoyo (`null` si no tiene, como el terreno sin ubicar). */
interface Stop extends PathPoint {
  cell: string | null;
}

/** Todo lo que el mapa sabe de dónde está cada Ápice en este nivel. */
function stopsById(layout: MapLayout): Map<string, Stop> {
  const where = new Map<string, Stop>();
  for (const block of layout.blocks) {
    // Un Ápice dentro del «+N» no tiene celda propia: va a la celda central de su zona.
    const center: Stop = {
      x: block.x,
      y: block.y,
      cell: block.moreCell?.cell ?? block.cells[0] ?? null,
    };
    for (const id of block.ids) where.set(id, center);
    for (const spot of block.spots) where.set(spot.id, { x: spot.x, y: spot.y, cell: spot.cell });
  }
  for (const spot of layout.terrain?.spots ?? []) where.set(spot.id, { x: spot.x, y: spot.y, cell: null });
  for (const group of layout.groups) {
    const cell = group.unlocated ? null : group.cell;
    for (const id of group.ids) where.set(id, { x: group.x, y: group.y, cell });
  }
  return where;
}

/** Los puntos de apoyo de la ruta, en el orden de `apiceIds`, sin los repetidos seguidos ni los Ápices fuera del mapa. */
function stopsOf(layout: MapLayout, apiceIds: readonly string[]): Stop[] {
  const where = stopsById(layout);
  const stops: Stop[] = [];
  for (const id of apiceIds) {
    const stop = where.get(id);
    if (stop === undefined) continue;
    const last = stops[stops.length - 1];
    if (last !== undefined && last.x === stop.x && last.y === stop.y) continue;
    stops.push(stop);
  }
  const distinct = new Set(stops.map((stop) => `${stop.x},${stop.y}`));
  return distinct.size < 2 ? [] : stops;
}

/**
 * Los puntos de la ruta, en el orden de `apiceIds`: el centro de la celda del Ápice; si el Ápice va en un «+N», el centro
 * de su zona; en los niveles alejados, el grupo que lo contiene. Los Ápices que no están en el mapa (porque quien mira no
 * puede verlos o quedaron fuera del tope) se saltan, y los puntos repetidos seguidos se funden. Con menos de dos puntos
 * distintos no hay ruta que dibujar y devuelve `[]` (RF-18 (021) · 18.7).
 */
export function pathPoints(layout: MapLayout, apiceIds: readonly string[]): PathPoint[] {
  return stopsOf(layout, apiceIds).map(({ x, y }) => ({ x, y }));
}

/** Las celdas con contenido del nivel (Ápices, «+N» y grupos): la ruta pasa por debajo, nunca las reemplaza. */
function occupiedCells(layout: MapLayout): Set<string> {
  const occupied = new Set<string>();
  for (const block of layout.blocks) {
    for (const spot of block.spots) occupied.add(spot.cell);
    if (block.moreCell) occupied.add(block.moreCell.cell);
  }
  for (const group of layout.groups) occupied.add(group.cell);
  return occupied;
}

/**
 * Las celdas de la ruta entre los Ápices, en el orden de `apiceIds` y sin repetir: las que unen una celda con la
 * siguiente, sin las de los propios Ápices ni otras con contenido. Un tramo que pasa del tope de `h3cells`, o que toca
 * lo que no tiene celda (el terreno sin ubicar), no lleva celdas: los puntos de sus extremos siguen contando. Sin dos
 * puntos distintos devuelve `[]`.
 */
export function pathCells(layout: MapLayout, apiceIds: readonly string[]): MapCell[] {
  const stops = stopsOf(layout, apiceIds);
  const occupied = occupiedCells(layout);
  const resolution = LEVEL_RESOLUTION[layout.level];
  const seen = new Set<string>();
  const cells: MapCell[] = [];
  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1]!.cell;
    const to = stops[index]!.cell;
    if (from === null || to === null || from === to || !isCellOf(from, resolution) || !isCellOf(to, resolution)) continue;
    for (const cell of routeCells(from, to) ?? []) {
      if (occupied.has(cell) || seen.has(cell) || cell === from || cell === to) continue;
      seen.add(cell);
      cells.push(drawCell(cell, layout.origin, layout.scale));
    }
  }
  return cells;
}

/** El punto medio del tramo más largo: ahí va el rótulo si la ruta no lleva celdas (D-T30 (021)). `null` si no hay tramo. */
export function pathLabelPoint(points: readonly PathPoint[]): PathPoint | null {
  let best: PathPoint | null = null;
  let longest = -1;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > longest) {
      longest = length;
      best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return best;
}

/** Lo que mide un carácter del rótulo (14 px en mayúsculas, con su espaciado) y lo que suma el relleno: una estimación para no pisar celdas. */
const CHAR_WIDTH = 10.5;
const LABEL_PADDING = 24;
const LABEL_HALF_HEIGHT = 14;
/** El ancho máximo del rótulo en la hoja de estilos (16 rem): más largo se corta con puntos suspensivos. */
const LABEL_MAX_WIDTH = 256;
/** Aire mínimo entre un rótulo y otro, y entre un rótulo y lo que lo tapa (leyenda y controles), en píxeles. */
const LABEL_GAP = 4;

/** Lo que mide el rótulo de una Acción Común de `characters` caracteres, sin pasar de su tope. */
export function pathLabelWidth(characters: number): number {
  return Math.min(LABEL_MAX_WIDTH, characters * CHAR_WIDTH + LABEL_PADDING);
}

/** Un rectángulo del lienzo, en píxeles. */
export interface LabelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Lo que ocupa un rótulo de Acción Común apoyado en `label`, con `width` de ancho. */
export function labelRect(label: PathLabel, width: number): LabelRect {
  const left = label.align === 'start' ? label.x : label.x - width;
  return { left, right: left + width, top: label.y - LABEL_HALF_HEIGHT, bottom: label.y + LABEL_HALF_HEIGHT };
}

/** Si dos rectángulos se pisan (o quedan a menos de `gap` uno del otro). */
export function rectsOverlap(a: LabelRect, b: LabelRect, gap = 0): boolean {
  return a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
}

/** El desplazamiento que mete `rect` entero en `view`; si es más ancho o más alto que `view`, queda pegado a su borde izquierdo o de arriba. */
export function shiftIntoView(rect: LabelRect, view: LabelRect): PathPoint {
  const dx =
    rect.right - rect.left >= view.right - view.left
      ? view.left - rect.left
      : Math.min(Math.max(rect.left, view.left), view.right - (rect.right - rect.left)) - rect.left;
  const dy =
    rect.bottom - rect.top >= view.bottom - view.top
      ? view.top - rect.top
      : Math.min(Math.max(rect.top, view.top), view.bottom - (rect.bottom - rect.top)) - rect.top;
  return { x: dx, y: dy };
}

/** Si el punto `point` cae dentro de `view`. */
export function pointInRect(point: PathPoint, view: LabelRect): boolean {
  return point.x >= view.left && point.x <= view.right && point.y >= view.top && point.y <= view.bottom;
}

/**
 * Lo que el rótulo tiene que respetar además de las celdas. Todo en píxeles del lienzo.
 * - `view`: la parte del lienzo que se ve (con su margen). El punto de apoyo de un candidato tiene que caer dentro (si la
 *   ruta no se ve, el rótulo no se dibuja) y el rótulo se corre hasta caber entero; si es más ancho que la ventana, se acorta.
 * - `blocked`: lo que tapa el lienzo (la caja de norte y escala, los controles). El rótulo no los pisa: si no cabe entero
 *   en el sitio libre, se acorta (hasta `MIN_LABEL_WIDTH`) o no se dibuja.
 * - `taken`: lo que ya ocupan otros rótulos (de zona, de otras Acciones Comunes).
 * - `busy`: centros de otras celdas que no se pueden tapar además de las del dibujo, como las celdas de `ruta` de todas
 *   las Acciones Comunes (con su glifo de eje). Las celdas vacías del teselado no cuentan.
 */
export interface LabelFit {
  view?: LabelRect;
  blocked?: readonly LabelRect[];
  taken?: readonly LabelRect[];
  busy?: readonly PathPoint[];
}

/** Lo menos que puede medir un rótulo acortado: debajo de esto no se lee y es mejor no dibujarlo. */
const MIN_LABEL_WIDTH = 96;

/** Un lugar posible del rótulo y el punto de la ruta en que se apoya. */
export interface LabelCandidate extends PathLabel {
  anchor: PathPoint;
}

/** Cuánto se aleja el rótulo de la celda de apoyo, en radios de celda: primero pegado, luego más lejos. */
const REACHES = [0.9, 1.6, 2.4] as const;
/** Cuántos puntos de apoyo se prueban a lo largo de la ruta antes de rendirse. */
const ANCHOR_LIMIT = 7;

/** Los puntos de apoyo del rótulo, del más natural (el medio de la ruta) hacia los lados, sin repetir. */
function labelAnchors(points: readonly PathPoint[], cells: readonly MapCell[]): PathPoint[] {
  const anchors: PathPoint[] = [];
  if (cells.length > 0) {
    const middle = Math.floor(cells.length / 2);
    for (let step = 0; anchors.length < Math.min(ANCHOR_LIMIT, cells.length); step += 1) {
      for (const index of step === 0 ? [middle] : [middle - step, middle + step]) {
        const cell = cells[index];
        if (cell !== undefined && anchors.length < ANCHOR_LIMIT) anchors.push({ x: cell.x, y: cell.y });
      }
    }
    return anchors;
  }
  const first = pathLabelPoint(points);
  if (first === null) return anchors;
  anchors.push(first);
  // Sin celdas: el resto del tramo más largo y el medio de los otros tramos.
  let longest: [PathPoint, PathPoint] | null = null;
  let best = -1;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > best) {
      best = length;
      longest = [a, b];
    }
  }
  if (longest !== null) {
    for (const t of [0.3, 0.7, 0.15, 0.85])
      anchors.push({ x: longest[0].x + (longest[1].x - longest[0].x) * t, y: longest[0].y + (longest[1].y - longest[0].y) * t });
  }
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (anchors.length < ANCHOR_LIMIT && !anchors.some((anchor) => anchor.x === middle.x && anchor.y === middle.y)) anchors.push(middle);
  }
  return anchors;
}

/**
 * Los lugares donde podría ir el rótulo de una Acción Común, del mejor al peor: junto a la celda del medio de su ruta (o
 * al punto medio del tramo más largo si no lleva celdas), en las cuatro esquinas (arriba a la derecha, abajo a la derecha,
 * arriba a la izquierda y abajo a la izquierda); después, más lejos y a lo largo de la ruta. No mira qué hay alrededor:
 * `placeLabel` elige el primero que no tapa nada. Vacío si la ruta no se dibuja.
 */
export function pathLabelCandidates(layout: MapLayout, apiceIds: readonly string[]): LabelCandidate[] {
  const points = pathPoints(layout, apiceIds);
  if (points.length === 0) return [];
  const anchors = labelAnchors(points, pathCells(layout, apiceIds));
  const corners: readonly { dx: number; dy: number; align: 'start' | 'end' }[] = [
    { dx: 1, dy: -1, align: 'start' },
    { dx: 1, dy: 1, align: 'start' },
    { dx: -1, dy: -1, align: 'end' },
    { dx: -1, dy: 1, align: 'end' },
  ];
  const candidates: LabelCandidate[] = [];
  for (const reach of REACHES) {
    for (const anchor of anchors) {
      for (const corner of corners) {
        candidates.push({
          x: anchor.x + corner.dx * reach * layout.radius,
          y: anchor.y + corner.dy * reach * layout.radius,
          align: corner.align,
          anchor,
        });
      }
    }
  }
  return candidates;
}

/** Si el rectángulo toca el hexágono de una celda con contenido (se toma como un círculo del radio de la celda). */
function touchesCell(rect: LabelRect, place: PathPoint, radius: number): boolean {
  const nearestX = Math.min(Math.max(place.x, rect.left), rect.right);
  const nearestY = Math.min(Math.max(place.y, rect.top), rect.bottom);
  return Math.hypot(place.x - nearestX, place.y - nearestY) < radius;
}

/** Los centros de todo lo que lleva patrón o tinta en el nivel: Ápices (también los del terreno sin ubicar), «+N» y grupos. */
function busyPlaces(layout: MapLayout): PathPoint[] {
  const busy: PathPoint[] = [];
  for (const block of layout.blocks) {
    for (const spot of block.spots) busy.push(spot);
    if (block.moreCell) busy.push(block.moreCell);
  }
  for (const spot of layout.terrain?.spots ?? []) busy.push(spot);
  for (const group of layout.groups) busy.push(group);
  return busy;
}

/**
 * Elige entre `candidates` el primero cuyo rótulo (de `characters` caracteres) no tapa ninguna celda con patrón, tinta
 * o `ruta` (`fit.busy`), ni otro rótulo (`fit.taken`), ni lo que tapa el lienzo (`fit.blocked`), y que cabe entero en
 * `fit.view`: se corre hasta caber y, si un control le quita sitio, se acorta (`width`). Los candidatos cuyo punto de
 * apoyo está fuera de `fit.view` no se prueban. Devuelve `null` si ninguno sirve: es mejor no dibujar el rótulo que
 * dibujarlo sobre una superficie o cortado.
 */
export function placeLabel(layout: MapLayout, candidates: readonly LabelCandidate[], characters: number, fit: LabelFit = {}): PathLabel | null {
  const natural = pathLabelWidth(characters);
  const busy = [...busyPlaces(layout), ...(fit.busy ?? [])];
  // Un poco menos que la arista: la celda es un hexágono y un círculo de su radio la cubre entera.
  const reach = layout.radius * 0.95;
  const { view, blocked = [], taken = [] } = fit;
  for (const candidate of candidates) {
    // Si la ruta no se ve en la ventana, el rótulo no se dibuja: no hay que dejar uno cortado en el borde.
    if (view !== undefined && !pointInRect(candidate.anchor, view)) continue;
    let width = view === undefined ? natural : Math.min(natural, view.right - view.left);
    let label: PathLabel = { x: candidate.x, y: candidate.y, align: candidate.align };
    let rect = labelRect(label, width);
    if (view !== undefined) {
      const shift = shiftIntoView(rect, view);
      label = { ...label, x: label.x + shift.x, y: label.y + shift.y };
      rect = labelRect(label, width);
      // Lo que tapan la leyenda y los controles a su altura limita hasta dónde llega el rótulo desde su punto de apoyo.
      for (const area of blocked) {
        if (!rectsOverlap(rect, area, LABEL_GAP)) continue;
        const room = label.align === 'start' ? area.left - LABEL_GAP - rect.left : rect.right - (area.right + LABEL_GAP);
        if (area.top >= rect.bottom + LABEL_GAP || area.bottom <= rect.top - LABEL_GAP || room < MIN_LABEL_WIDTH || room >= width) break;
        width = Math.floor(room);
        rect = labelRect(label, width);
      }
      if (blocked.some((area) => rectsOverlap(rect, area, LABEL_GAP))) continue;
    }
    if (busy.some((place) => touchesCell(rect, place, reach))) continue;
    if (taken.some((area) => rectsOverlap(rect, area, LABEL_GAP))) continue;
    return width < natural ? { ...label, width } : label;
  }
  return null;
}

/**
 * Dónde va el rótulo de una Acción Común: fuera de las celdas con patrón o tinta, en el primero de los lugares de
 * `pathLabelCandidates` que no tapa nada (véase `placeLabel`). `characters` es el largo del texto. `null` si la ruta no
 * se dibuja o si no hay sitio sin tapar una celda.
 */
export function pathLabel(layout: MapLayout, apiceIds: readonly string[], characters: number, fit: LabelFit = {}): PathLabel | null {
  return placeLabel(layout, pathLabelCandidates(layout, apiceIds), characters, fit);
}
