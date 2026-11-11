// RF-18 (021) · 18.2, 18.7, D-T30 (021) · El recorrido de un camino en el mapa: por dónde pasa en el nivel a la vista y
// dónde va su rótulo. Puro, sin React ni DOM; trabaja sobre lo que ya calculó `layoutMap` (hexmap.ts).
import type { MapLayout } from './hexmap';

export interface PathPoint {
  x: number;
  y: number;
}

/**
 * Los puntos del camino, en el orden de `apiceIds`: el lugar del edificio; si el ápice va en un «+n», el centro de su
 * manzana; en los niveles alejados, el grupo que lo contiene. Los ápices que no están en el mapa (porque quien mira no
 * puede verlos o quedaron fuera del tope) se saltan, y los puntos repetidos seguidos se funden. Con menos de dos puntos
 * distintos no hay camino que dibujar y devuelve `[]` (RF-18 (021) · 18.7).
 */
export function pathPoints(layout: MapLayout, apiceIds: readonly string[]): PathPoint[] {
  const where = new Map<string, PathPoint>();
  for (const block of layout.blocks) {
    for (const id of block.ids) where.set(id, { x: block.x, y: block.y });
    for (const spot of block.spots) where.set(spot.id, { x: spot.x, y: spot.y });
  }
  for (const spot of layout.terrain?.spots ?? []) where.set(spot.id, { x: spot.x, y: spot.y });
  for (const group of layout.groups) for (const id of group.ids) where.set(id, { x: group.x, y: group.y });

  const points: PathPoint[] = [];
  for (const id of apiceIds) {
    const point = where.get(id);
    if (point === undefined) continue;
    const last = points[points.length - 1];
    if (last !== undefined && last.x === point.x && last.y === point.y) continue;
    points.push(point);
  }
  const distinct = new Set(points.map((point) => `${point.x},${point.y}`));
  return distinct.size < 2 ? [] : points;
}

/** El punto medio del tramo más largo: ahí va el rótulo del camino (D-T30 (021)). `null` si no hay tramo. */
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

/** El atributo `points` de una `polyline` SVG. */
export const svgPoints = (points: readonly PathPoint[]): string => points.map((point) => `${point.x},${point.y}`).join(' ');
