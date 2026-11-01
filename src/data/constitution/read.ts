// Ayudas de lectura de la constitución común: de lo que devuelve Firestore a las formas del dominio (instantes en
// milisegundos, plan §5). Sin SDK: se prueban con datos planos.
import { isTimestampLike } from '../../../shared/domain/order';

export type Unsubscribe = () => void;

/** Quién mira: sin cuenta activa solo se lee lo público (RF-2 (004) · 2.3, 2.4). */
export type ReaderAudience = 'visitor' | 'member';

/** Un `Timestamp` (o su mapa plano) o un número se vuelven milisegundos; lo demás, `null`. */
export function toMs(value: unknown): number | null {
  if (typeof value === 'number') return value;
  return isTimestampLike(value) ? value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6) : null;
}

export const msOr = (value: unknown, fallback = 0): number => toMs(value) ?? fallback;
export const text = (value: unknown): string => (typeof value === 'string' ? value : '');
export const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
export const num = (value: unknown, fallback = 0): number => (typeof value === 'number' ? value : fallback);
export const numOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null);
export const bool = (value: unknown): boolean => value === true;

/** Lo mínimo que se usa de un documento leído. */
export interface DocLike {
  id: string;
  data(): Record<string, unknown> | undefined;
}
