// Tamaño, orden canónico de ejes y nombre accesible del pin del mapa (RF-8 (002) · 8.3, RF-8 (002) · 8.4, D-T9 (002)).
import { AXES, type Axis } from '../apice';

/**
 * Devuelve los ejes recibidos sin duplicados y en el orden canónico de AXES.
 */
export function sortAxes(axes: readonly Axis[]): Axis[] {
  const present = new Set(axes);
  return AXES.filter((axis) => present.has(axis));
}

/**
 * Calcula las dimensiones del pin en píxeles (RF-8 (002) · 8.3, D-T9 (002)):
 * alto fijo de 20 px y ancho de 6 + 14·n px, con n igual a la cantidad de ejes
 * distintos (mínimo 1 si la lista llega vacía: 20 px).
 */
export function pinSize(axes: readonly Axis[]): { width: number; height: number } {
  const count = Math.max(1, sortAxes(axes).length);
  return {
    width: 6 + 14 * count,
    height: 20,
  };
}

/**
 * Compone el nombre accesible del pin (RF-8 (002) · 8.4):
 * incluye el nombre del ápice y sus ejes en orden canónico separados por coma.
 * Si no tiene ejes, devuelve únicamente el nombre.
 */
export function pinAccessibleName(name: string, axes: readonly Axis[]): string {
  const sorted = sortAxes(axes);
  if (sorted.length === 0) return name;
  return `${name}: ${sorted.join(', ')}`;
}
