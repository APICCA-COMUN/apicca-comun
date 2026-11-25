// RF-18 (021) · 18.2, 18.7 · Los puntos de apoyo de una Acción Común en el mapa teselado (sistema «APICCA · Mapa»): dónde
// está cada Ápice en el nivel y los rectángulos con que se coloca su rótulo. El dibujo (el Arco) vive en `mapArcs.ts`.
// Puro, sin React ni DOM; trabaja sobre lo que ya calculó `layoutMap` (hexmap.ts).
import type { MapLayout } from './hexmap';

export interface PathPoint {
  x: number;
  y: number;
}

/** Todo lo que el mapa sabe de dónde está cada Ápice en este nivel. */
function stopsById(layout: MapLayout): Map<string, PathPoint> {
  const where = new Map<string, PathPoint>();
  for (const block of layout.blocks) {
    // Un Ápice dentro del «+N» no tiene celda propia: va al centro de su zona.
    const center: PathPoint = { x: block.x, y: block.y };
    for (const id of block.ids) where.set(id, center);
    for (const spot of block.spots) where.set(spot.id, { x: spot.x, y: spot.y });
  }
  for (const spot of layout.terrain?.spots ?? []) where.set(spot.id, { x: spot.x, y: spot.y });
  for (const group of layout.groups) {
    for (const id of group.ids) where.set(id, { x: group.x, y: group.y });
  }
  return where;
}

/** Los puntos de apoyo de la ruta, en el orden de `apiceIds`, sin los repetidos seguidos ni los Ápices fuera del mapa. */
function stopsOf(layout: MapLayout, apiceIds: readonly string[]): PathPoint[] {
  const where = stopsById(layout);
  const stops: PathPoint[] = [];
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

/** Lo que mide un carácter del rótulo (14 px en mayúsculas, con su espaciado) y lo que suma el relleno: una estimación para no pisar celdas. */
const CHAR_WIDTH = 10.5;
const LABEL_PADDING = 24;
/** El ancho máximo del rótulo en la hoja de estilos (16 rem): más largo se corta con puntos suspensivos. */
const LABEL_MAX_WIDTH = 256;

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
