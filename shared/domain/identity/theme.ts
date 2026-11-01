// Resolución del tema vigente según preferencia guardada y del sistema (RF-3 (002) · 3.3, D-22 (002)).
import type { ThemeName } from './tokens';

/**
 * Resuelve el tema vigente a partir del valor recordado y la preferencia del sistema.
 * Si saved es 'light' o 'dark', manda la elección; si no, sigue al sistema.
 */
export function resolveTheme(saved: unknown, system: ThemeName): ThemeName {
  return saved === 'light' || saved === 'dark' ? saved : system;
}
