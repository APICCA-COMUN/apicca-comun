// Celda base y cálculo de escala para edificios de ápices (RF-7 (002) · 7.2, D-T10 (002)).

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
