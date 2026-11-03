// RF-4 (001) · Límite de envíos del formulario público (D-T16 (001)): 5 por hora desde un mismo
// origen y 200 al día en total. El origen se guarda como HMAC de la IP, nunca en claro, y cada
// documento lleva `expiresAt` para que la política TTL de Firestore lo retire sola.
// RF-5 (016), RF-7 (016): también cobra las cuotas diarias por persona y las lecturas anónimas por hora.
// RF-2 (018), D-2 (018), D-T6 (018): cuota diaria de ediciones (`edit`), compartida entre cinco acciones.
// RF-3 (017), D-T3 (017): las cuotas de escritura se cobran dentro de la transacción que escribe.
import { createHmac } from 'node:crypto';
import type { DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
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

/** El contador tras tomar un cupo de `rule`; lanza `rate-limited` si la ventana abierta ya está llena. */
function nextCounter(snap: DocumentSnapshot | undefined, rule: Rule, now: Date): { count: number; windowStart: Date; expiresAt: Date } {
  const start = snap?.exists ? (snap.get('windowStart') as { toDate(): Date }).toDate() : null;
  const open = start !== null && now.getTime() < start.getTime() + rule.windowMs;
  const count = open ? (snap?.get('count') as number) : 0;
  if (count >= rule.limit) throw new ApiError('rate-limited');
  const windowStart = open && start !== null ? start : now;
  return { count: count + 1, windowStart, expiresAt: new Date(windowStart.getTime() + rule.windowMs) };
}

/** Toma un cupo de cada regla en una sola transacción; si alguna está agotada, no consume ninguna. */
async function consume(ctx: Ctx, rules: readonly Rule[]): Promise<void> {
  const now = ctx.now();
  await ctx.db.runTransaction(async (tx) => {
    const refs = rules.map((rule) => ctx.db.doc(`rateLimits/${rule.key}`));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    const next = rules.map((rule, i) => nextCounter(snaps[i], rule, now));
    refs.forEach((ref, i) => tx.set(ref, next[i] ?? {}));
  });
}

/** Escritura pendiente del contador: se llama después de las demás lecturas de la transacción. */
export type SlotCharge = () => void;

/**
 * Lee el contador de `rule` dentro de `tx` y lanza `rate-limited` si está agotado; devuelve la escritura que descuenta
 * el cupo. Como Firestore exige leer antes de escribir, la op la llama en su fase de lectura y aplica el cobro junto con
 * sus escrituras: si la transacción falla, el contador no cambia (RF-3 (017), D-T3 (017)).
 */
async function takeSlotInTx(ctx: Ctx, tx: Transaction, rule: Rule): Promise<SlotCharge> {
  const ref = ctx.db.doc(`rateLimits/${rule.key}`);
  const next = nextCounter(await tx.get(ref), rule, ctx.now());
  return () => {
    tx.set(ref, next);
  };
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

/** RF-3 (009) · 3.3, RNF-5 (009), RF-3 (017): cupo de 10 hilos nuevos por persona en 24 horas (D-T4 (009)), dentro de `tx`. */
export function takeThreadSlot(ctx: Ctx, tx: Transaction, uid: string): Promise<SlotCharge> {
  return takeSlotInTx(ctx, tx, { key: `forum-thread-${uid}`, limit: FORUM_LIMITS.threadsPerDay, windowMs: DAY_MS });
}

/** RF-7 (016) · 7.1, D-5 (016), D-7 (016): topes por persona y por día de cada tipo de escritura. */
export const DAILY_QUOTAS = { reply: 50, comment: 50, apice: 10, upload: 30, edit: 100 } as const;

const dailyRule = (kind: keyof typeof DAILY_QUOTAS, uid: string): Rule => ({ key: `daily-${kind}-${uid}`, limit: DAILY_QUOTAS[kind], windowMs: DAY_MS });

/** RF-7 (016) · 7.1, D-T8 (016): toma un cupo diario del tipo dado a la persona (ventana de 24 horas), en su propia transacción. */
export async function consumeDailySlot(ctx: Ctx, kind: keyof typeof DAILY_QUOTAS, uid: string): Promise<void> {
  await consume(ctx, [dailyRule(kind, uid)]);
}

/** RF-3 (017), D-T3 (017): el mismo cupo diario, leído dentro de `tx` y cobrado con la escritura de la op. */
export function takeDailySlot(ctx: Ctx, tx: Transaction, kind: keyof typeof DAILY_QUOTAS, uid: string): Promise<SlotCharge> {
  return takeSlotInTx(ctx, tx, dailyRule(kind, uid));
}

/** RF-5 (016): tope de lecturas de referencias sin sesión, por origen y por hora. */
export const ANONYMOUS_READS_PER_HOUR = 100;

/** RF-5 (016), D-T8 (016): toma un cupo de lectura anónima del origen de quien llama (ventana de 1 hora). */
export async function consumeAnonymousReadSlot(ctx: Ctx): Promise<void> {
  await consume(ctx, [{ key: `reference-ip-${originOf(ctx)}`, limit: ANONYMOUS_READS_PER_HOUR, windowMs: HOUR_MS }]);
}
