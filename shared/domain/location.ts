// Ubicación de un ápice (RF-9 (001), RF-5 (021)): validación de coordenadas, precisión y zona publicada.
// Puro, sin DOM. La zona es una celda H3 que calcula el servidor (D-T13 (021)); aquí solo viven su forma y su lectura,
// porque el dominio compartido llega al navegador y no carga la biblioteca de celdas (D-5 (021)).
import { invalid, valid, type Validation } from './result';

export type Precision = 'approximate' | 'exact';

/** Punto sobre la Tierra, en grados. */
export interface Point {
  lat: number;
  lng: number;
}

/** Zona de un ápice: su celda H3 y el centro de esa celda (RF-5 (021)). */
export interface Zone extends Point {
  cell: string;
}

/**
 * Ubicación **de pantalla**: el punto exacto o el centro de su zona, según la precisión. `zone` falta en los ápices que
 * aún no pasaron por el recálculo (RF-5 (021) · 5.4).
 */
export interface Location extends Point {
  precision: Precision;
  zone?: Zone;
}

/** Al indicar una ubicación es aproximada y quien edita la cambia (RF-9 (001)). */
export const DEFAULT_PRECISION: Precision = 'approximate';

/** Resolución H3 de la zona: celdas de unos 5 km² (D-6 (021)). */
export const ZONE_RESOLUTION = 7;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Coordenadas existentes y dentro de rango, o `coordinates-invalid` (RF-9 (001)). */
export function validateCoordinates(lat: unknown, lng: unknown): Validation<Point> {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return invalid('coordinates-invalid');
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return invalid('coordinates-invalid');
  // `+ 0` convierte -0 en 0.
  return valid({ lat: lat + 0, lng: lng + 0 });
}

const CELL_PATTERN = /^[0-9a-f]{15}$/;

/** La zona guardada, si tiene una celda H3 y un centro válidos; si no, `null` (RF-5 (021) · 5.2). */
export function readZone(raw: unknown): Zone | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { cell, lat, lng } = raw as Record<string, unknown>;
  if (typeof cell !== 'string' || !CELL_PATTERN.test(cell)) return null;
  const center = validateCoordinates(lat, lng);
  return center.ok ? { cell, ...center.value } : null;
}

/** La ubicación de pantalla guardada en un ápice, o `null` si falta o no es válida (RF-9 (001), RF-5 (021) · 5.2). */
export function readLocation(raw: unknown): Location | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { lat, lng, precision, zone } = raw as Record<string, unknown>;
  const point = validateCoordinates(lat, lng);
  if (!point.ok) return null;
  const location: Location = { ...point.value, precision: precision === 'exact' ? 'exact' : DEFAULT_PRECISION };
  const readable = readZone(zone);
  return readable ? { ...location, zone: readable } : location;
}

/** Lo que pide un cambio de ubicación, en lo que importa para el permiso (RF-1 (016)). */
export type LocationRequest =
  | { mode: 'keep' }
  | { mode: 'remove' }
  | { mode: 'set'; precision: Precision }
  | { mode: 'precision'; precision: Precision };

/**
 * Si el cambio fija una ubicación nueva o la vuelve exacta (RF-1 (016), D-T1 (016)). Quitarla, volverla aproximada o
 * conservarla no la sube.
 */
export function raisesLocation(current: Precision | null, change: LocationRequest): boolean {
  if (change.mode === 'set') return true;
  if (change.mode === 'precision') return change.precision === 'exact' && current !== 'exact';
  return false;
}
