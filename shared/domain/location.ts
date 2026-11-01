// Ubicación de un ápice (RF-9 (001)): validación de coordenadas, zona aproximada y agrupación.
// Puro, sin DOM: la zona es una cuadrícula fija de 0,01° (≈ 1,1 km) que da siempre el mismo
// resultado para el mismo punto (D-T4 (001)).
import { invalid, valid, type Validation } from './result';

export type Precision = 'approximate' | 'exact';

/** Punto sobre la Tierra, en grados. */
export interface Point {
  lat: number;
  lng: number;
}

/** Ubicación **de pantalla**: el punto exacto o el centro de su zona, según la precisión. */
export interface Location extends Point {
  precision: Precision;
}

/** Al indicar una ubicación es aproximada y quien edita la cambia (RF-9 (001)). */
export const DEFAULT_PRECISION: Precision = 'approximate';

/** Lado de la celda de la zona aproximada, en grados (RF-9 (001)). */
export const APPROXIMATE_GRID = 0.01;

const CELLS_PER_DEGREE = 100;
// Absorbe el error de flotante en los límites de celda (4,35 × 100 = 434,99999999999994).
const CELL_EPSILON = 1e-7;
const MAX_LAT_CELL = 90 * CELLS_PER_DEGREE - 1;
const MAX_LNG_CELL = 180 * CELLS_PER_DEGREE - 1;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Coordenadas existentes y dentro de rango, o `coordinates-invalid` (RF-9 (001)). */
export function validateCoordinates(lat: unknown, lng: unknown): Validation<Point> {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return invalid('coordinates-invalid');
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return invalid('coordinates-invalid');
  // `+ 0` convierte -0 en 0.
  return valid({ lat: lat + 0, lng: lng + 0 });
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function cellOf(degrees: number, max: number): number {
  return clamp(Math.floor(degrees * CELLS_PER_DEGREE + CELL_EPSILON), -max - 1, max);
}

/** Centro de una celda, redondeado a tres decimales para no arrastrar ruido de flotante. */
const centerOf = (cell: number): number => Math.round((cell + 0.5) * 10) / 1000;

/** Zona aproximada: el centro de la celda de 0,01° que contiene el punto (RF-9 (001)). */
export function approximateZone(point: Point): Point {
  return {
    lat: centerOf(cellOf(point.lat, MAX_LAT_CELL)),
    lng: centerOf(cellOf(point.lng, MAX_LNG_CELL)),
  };
}

/** Ubicación que se guarda y se muestra a todas las personas (RF-9 (001), D-T4 (001)). */
export function displayLocation(point: Point, precision: Precision = DEFAULT_PRECISION): Location {
  if (precision === 'exact') return { lat: point.lat, lng: point.lng, precision };
  return { ...approximateZone(point), precision };
}

/** Clave de la celda de un punto: dos puntos de la misma zona comparten clave (RF-9 (001)). */
export function zoneKey(point: Point): string {
  return `${cellOf(point.lat, MAX_LAT_CELL)}:${cellOf(point.lng, MAX_LNG_CELL)}`;
}

/** Ápices que comparten ubicación en el mapa. */
export interface LocationGroup<T> extends Point {
  key: string;
  precision: Precision;
  items: T[];
}

const groupKey = (location: Location): string =>
  location.precision === 'exact' ? `exact:${location.lat},${location.lng}` : `zone:${zoneKey(location)}`;

/**
 * Agrupa por «misma ubicación» (RF-9 (001)): la zona para los aproximados y el punto para los
 * exactos. Los ápices sin ubicación no van al mapa (RF-9 (001)); se devuelven aparte.
 * Conserva el orden de primera aparición.
 */
export function groupByLocation<T extends { location: Location | null }>(
  items: readonly T[],
): { groups: LocationGroup<T>[]; withoutLocation: T[] } {
  const byKey = new Map<string, LocationGroup<T>>();
  const withoutLocation: T[] = [];
  for (const item of items) {
    const { location } = item;
    if (!location) {
      withoutLocation.push(item);
      continue;
    }
    const key = groupKey(location);
    const group = byKey.get(key);
    if (group) group.items.push(item);
    else byKey.set(key, { key, lat: location.lat, lng: location.lng, precision: location.precision, items: [item] });
  }
  return { groups: [...byKey.values()], withoutLocation };
}
