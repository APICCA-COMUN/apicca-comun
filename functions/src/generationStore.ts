// RF-19 (001), RF-20 (001) · Estado de la generación en Firestore (D-T8 (001)): el contador por día, el candado de
// «una en curso» y las fallas seguidas. Helpers compartidos por `generateImage` y `generationStatus`.
import type { DocumentReference } from 'firebase-admin/firestore';
import { GENERATION_TIMEOUT_MS, colombiaClock, type FailureState } from '../../shared/domain/generation';
import type { Ctx } from './context';

/** Margen sobre el tiempo máximo de espera al modelo: pasado esto, el candado se considera huérfano (D-T8 (001)). */
export const LOCK_MARGIN_MS = 30_000;
export const LOCK_TTL_MS = GENERATION_TIMEOUT_MS + LOCK_MARGIN_MS;
/** Los contadores diarios caducan (TTL de Firestore) unos días después de su día. */
const COUNTER_LIFETIME_MS = 3 * 24 * 3600 * 1000;

export interface Lock {
  apiceId: string;
  startedAt: Date;
  day: string;
}

export interface GenerationState extends FailureState {
  lock: Lock | null;
}

type TimestampLike = { toDate(): Date } | Date | null | undefined;

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) return (value as { toDate(): Date }).toDate();
  return null;
}

/** El día cuenta en hora de Colombia, medido con el reloj del servidor (RF-19 (001)). */
export const dayKey = (now: Date): string => colombiaClock(now).slice(0, 10);

export const stateRef = (ctx: Ctx, uid: string): DocumentReference => ctx.db.doc(`generation/${uid}`);
export const userDayRef = (ctx: Ctx, uid: string, day: string): DocumentReference => ctx.db.doc(`generationDays/${uid}_${day}`);
export const globalDayRef = (ctx: Ctx, day: string): DocumentReference => ctx.db.doc(`generationDays/global_${day}`);

export const countFrom = (data: Record<string, unknown> | undefined): number => (data?.['count'] as number | undefined) ?? 0;

export const counterDoc = (count: number, now: Date): { count: number; expiresAt: Date } => ({
  count: Math.max(0, count),
  expiresAt: new Date(now.getTime() + COUNTER_LIFETIME_MS),
});

export function stateFrom(data: Record<string, unknown> | undefined): GenerationState {
  const rawLock = data?.['lock'] as { apiceId?: string; startedAt?: TimestampLike; day?: string } | null | undefined;
  const startedAt = toDate(rawLock?.startedAt);
  const lock: Lock | null =
    rawLock && startedAt && typeof rawLock.apiceId === 'string' && typeof rawLock.day === 'string'
      ? { apiceId: rawLock.apiceId, startedAt, day: rawLock.day }
      : null;
  return {
    lock,
    consecutive: (data?.['consecutiveFailures'] as number | undefined) ?? 0,
    blockedUntil: toDate(data?.['blockedUntil']),
  };
}

export const stateDoc = (state: GenerationState): Record<string, unknown> => ({
  lock: state.lock,
  consecutiveFailures: state.consecutive,
  blockedUntil: state.blockedUntil,
});
