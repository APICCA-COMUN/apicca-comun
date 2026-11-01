// Plazos de una propuesta: 360 h de deliberación y una ampliación de 360 h (RF-6 (004), RF-12 (004), D-T5 (004)).
// Los instantes son milisegundos; el cierre es una fecha absoluta, no el momento de procesarlo.

export const DELIBERATION_HOURS = 360;
export const EXTENSION_HOURS = 360;

const HOUR_MS = 3600 * 1000;

/** Cierre original: la apertura más 360 h (RF-6 (004)). */
export function dueAt(openedAt: number): number {
  return openedAt + DELIBERATION_HOURS * HOUR_MS;
}

/** Cierre ampliado: 360 h sumadas al cierre original, no al momento de procesarlo (RF-12 (004), D-T5 (004)). */
export function extendedDueAt(originalClosesAt: number): number {
  return originalClosesAt + EXTENSION_HOURS * HOUR_MS;
}

/** Inclusivo: en el instante del cierre y después ya venció (RF-12 (004)). */
export function isDue(closesAt: number, now: number): boolean {
  return now >= closesAt;
}
