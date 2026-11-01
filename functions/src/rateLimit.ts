// RF-4 (001) · Límite de envíos del formulario público (D-T16 (001)): 5 por hora desde un mismo
// origen y 200 al día en total. El origen se guarda como HMAC de la IP, nunca en claro, y cada
// documento lleva `expiresAt` para que la política TTL de Firestore lo retire sola.
// RF-5 (016), RF-7 (016): también cobra las cuotas diarias por persona y las lecturas anónimas por hora.
import { createHmac } from 'node:crypto';
import { FORUM_LIMITS } from '../../shared/domain/forum';
import type { Ctx } from './context';
import { ApiError } from './errors';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const ENROLLMENT_PER_IP_PER_HOUR = 5;
export const ENROLLMENT_PER_DAY = 200;
export const DAILY_KEY = 'enrollment-total';

interface Rule {
  key: string;
  limit: number;
  windowMs: number;
}

/** Contexto con el origen de quien llama y la sal del hash; lo arma la callable (o la prueba). */
export function withOrigin<C extends Ctx>(ctx: C, clientIp: string, ipSalt: string): C {
  return { ...ctx, clientIp, ipSalt };
}

/** Toma un cupo de cada regla en una sola transacción; si alguna está agotada, no consume ninguna. */
async function consume(ctx: Ctx, rules: readonly Rule[]): Promise<void> {
  const now = ctx.now();
  await ctx.db.runTransaction(async (tx) => {
    const refs = rules.map((rule) => ctx.db.doc(`rateLimits/${rule.key}`));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    const next = rules.map((rule, i) => {
      const snap = snaps[i];
      const start = snap?.exists ? (snap.get('windowStart') as { toDate(): Date }).toDate() : null;
      const open = start !== null && now.getTime() < start.getTime() + rule.windowMs;
      const count = open ? (snap?.get('count') as number) : 0;
      if (count >= rule.limit) throw new ApiError('rate-limited');
      const windowStart = open && start !== null ? start : now;
      return { count: count + 1, windowStart, expiresAt: new Date(windowStart.getTime() + rule.windowMs) };
    });
    refs.forEach((ref, i) => tx.set(ref, next[i] ?? {}));
  });
}

/** HMAC de la IP de quien llama; nunca se guarda la IP en claro. Lanza si falta la sal. */
export function originOf(ctx: Ctx): string {
  if (ctx.ipSalt === undefined || ctx.ipSalt === '') throw new Error('Falta la sal del hash de IP (secreto de Functions).');
  return createHmac('sha256', ctx.ipSalt).update(ctx.clientIp ?? 'desconocido').digest('hex');
}

export async function consumeEnrollmentSlot(ctx: Ctx): Promise<void> {
  const origin = originOf(ctx);
  await consume(ctx, [
    { key: `enrollment-ip-${origin}`, limit: ENROLLMENT_PER_IP_PER_HOUR, windowMs: HOUR_MS },
    { key: DAILY_KEY, limit: ENROLLMENT_PER_DAY, windowMs: DAY_MS },
  ]);
}

/** RF-3 (009) · 3.3, RNF-5 (009): cupo de 10 hilos nuevos por persona en 24 horas (D-T4 (009)). */
export async function consumeThreadSlot(ctx: Ctx, uid: string): Promise<void> {
  await consume(ctx, [{ key: `forum-thread-${uid}`, limit: FORUM_LIMITS.threadsPerDay, windowMs: DAY_MS }]);
}

/** RF-7 (016) · 7.1, D-5 (016), D-7 (016): topes por persona y por día de cada tipo de escritura. */
export const DAILY_QUOTAS = { reply: 50, comment: 50, apice: 10, upload: 30 } as const;

/** RF-7 (016) · 7.1, D-T8 (016): toma un cupo diario del tipo dado a la persona (ventana de 24 horas). */
export async function consumeDailySlot(ctx: Ctx, kind: keyof typeof DAILY_QUOTAS, uid: string): Promise<void> {
  await consume(ctx, [{ key: `daily-${kind}-${uid}`, limit: DAILY_QUOTAS[kind], windowMs: DAY_MS }]);
}

/** RF-5 (016): tope de lecturas de referencias sin sesión, por origen y por hora. */
export const ANONYMOUS_READS_PER_HOUR = 100;

/** RF-5 (016), D-T8 (016): toma un cupo de lectura anónima del origen de quien llama (ventana de 1 hora). */
export async function consumeAnonymousReadSlot(ctx: Ctx): Promise<void> {
  await consume(ctx, [{ key: `reference-ip-${originOf(ctx)}`, limit: ANONYMOUS_READS_PER_HOUR, windowMs: HOUR_MS }]);
}
