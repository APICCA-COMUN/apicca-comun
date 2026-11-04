// Celda base y cálculo de escala para edificios de ápices (RF-7 (002) · 7.2, D-T10 (002)) y sus partes por etapa
// (RF-4 (019) · 4.1 a 4.3, D-T19 (019)).
import type { ApiceStatus } from '../apice';

/** Lado en píxeles de la celda mínima del edificio (RF-7 (002) · 7.2). */
export const BUILDING_CELL = 64;

/**
 * Calcula el factor de escala entero para un edificio a partir del ancho disponible y el máximo permitido.
 * Devuelve clamp(1, floor(width / 64), max). Si width no es finito o es negativo, devuelve 1.
 */
export function buildingScale(width: number, max: number): number {
  if (!Number.isFinite(width) || width < 0) return 1;
  const n = Math.floor(width / BUILDING_CELL);
  return Math.max(1, Math.min(n, max));
}

/** RF-4 (019) · 4.1 a 4.3, D-T19 (019): partes del edificio. */
export type BuildingPart = 'base' | 'body' | 'roof';

/** Partes que dibuja el edificio en cada etapa: la idea es solo la base y cada etapa suma una (RF-4 (019) · 4.1 a 4.3). */
export function buildingParts(stage: ApiceStatus): readonly BuildingPart[] {
  if (stage === 'idea') return ['base'];
  if (stage === 'prototipo') return ['base', 'body'];
  return ['base', 'body', 'roof'];
}
