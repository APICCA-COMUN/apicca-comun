// RF-12 (024) · 12.1 a 12.3, D-T15 (024): la vista con la que abre el selector de ubicación cuando no hay punto. Pura, sin React
// ni Leaflet. Recibe solo centros de zona (nunca el punto exacto de un ápice, D-10 (024)) y dice dónde mirar: la vista de
// siempre si no hay ninguna, su centro si hay una sola (o todas coinciden), o la caja que las envuelve.
import type { Point } from './location';

/** Zoom con el que se abre sobre una sola zona: el de una celda H3 de resolución 7, unos 5 km de lado (RF-12 (024) · 12.1). */
export const PICKER_CENTER_ZOOM = 13;

export type PickerView =
  | { kind: 'default' }
  | { kind: 'center'; point: Point; zoom: number }
  | { kind: 'bounds'; south: number; west: number; north: number; east: number };

/** Desplazamiento de 0 o ±360 que acerca `lng` a `reference` por el camino corto, para que el meridiano 180 no separe a dos vecinas. */
const wrapShift = (lng: number, reference: number): number => {
  const difference = lng - reference;
  return difference > 180 ? -360 : difference < -180 ? 360 : 0;
};

const byPoint = (a: Point, b: Point): number => a.lat - b.lat || a.lng - b.lng;

export function pickerView(zones: readonly Pick<Point, 'lat' | 'lng'>[]): PickerView {
  if (zones.length === 0) return { kind: 'default' };
  // Se ordena para que la caja no dependa del orden de llegada ni de cuál zona sirva de referencia.
  const points = zones.map(({ lat, lng }): Point => ({ lat, lng })).sort(byPoint);
  const first = points[0]!;
  let south = first.lat;
  let north = first.lat;
  let west = first.lng;
  let east = first.lng;
  for (const point of points) {
    const lng = point.lng + wrapShift(point.lng, first.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  }
  if (south === north && west === east) return { kind: 'center', point: first, zoom: PICKER_CENTER_ZOOM };
  // El borde oeste vuelve al rango [-180, 180); el este puede pasar de 180, como pide Leaflet al cruzar el antimeridiano.
  const back = west < -180 ? 360 : west >= 180 ? -360 : 0;
  return { kind: 'bounds', south, west: west + back, north, east: east + back };
}
