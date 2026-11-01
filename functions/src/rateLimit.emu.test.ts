// T-1.23: ventanas y topes con TTL por clave (RF-4 (001), D-T16 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { clearEmulators, createTestCtx, type TestCtx } from './testing';
import { DAILY_KEY, consumeEnrollmentSlot, withOrigin } from './rateLimit';

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

let ctx: TestCtx;
const from = (ip: string) => withOrigin(ctx, ip, 'sal-de-prueba');

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
});

describe('rateLimit', () => {
  it('RF-4 (001): cinco intentos por hora desde un mismo origen pasan y el sexto falla', async () => {
    for (let i = 0; i < 5; i += 1) await consumeEnrollmentSlot(from('203.0.113.7'));
    expect(await codeOf(consumeEnrollmentSlot(from('203.0.113.7')))).toBe('rate-limited');
  });

  it('RF-4 (001): otro origen tiene su propio tope', async () => {
    for (let i = 0; i < 5; i += 1) await consumeEnrollmentSlot(from('203.0.113.7'));
    expect(await codeOf(consumeEnrollmentSlot(from('203.0.113.8')))).toBeUndefined();
  });

  it('RF-4 (001): pasada la hora la ventana se reinicia', async () => {
    for (let i = 0; i < 5; i += 1) await consumeEnrollmentSlot(from('203.0.113.7'));
    ctx.setNow(new Date('2026-09-01T16:00:00Z'));
    expect(await codeOf(consumeEnrollmentSlot(from('203.0.113.7')))).toBeUndefined();
  });

  it('RF-4 (001): el intento rechazado no consume cupo del total diario', async () => {
    for (let i = 0; i < 5; i += 1) await consumeEnrollmentSlot(from('203.0.113.7'));
    await codeOf(consumeEnrollmentSlot(from('203.0.113.7')));
    expect((await ctx.db.doc(`rateLimits/${DAILY_KEY}`).get()).get('count')).toBe(5);
  });

  it('RF-4 (001): el total es de 200 al día entre todos los orígenes y se reinicia a las 24 horas', async () => {
    await ctx.db.doc(`rateLimits/${DAILY_KEY}`).set({
      count: 199,
      windowStart: ctx.now(),
      expiresAt: new Date(ctx.now().getTime() + 24 * 3600 * 1000),
    });
    await consumeEnrollmentSlot(from('198.51.100.1'));
    expect(await codeOf(consumeEnrollmentSlot(from('198.51.100.2')))).toBe('rate-limited');
    ctx.setNow(new Date('2026-09-02T15:00:00Z'));
    expect(await codeOf(consumeEnrollmentSlot(from('198.51.100.2')))).toBeUndefined();
  });

  it('RF-4 (001): la clave no contiene la IP en claro y cada documento lleva su vencimiento (TTL)', async () => {
    await consumeEnrollmentSlot(from('203.0.113.7'));
    const docs = (await ctx.db.collection('rateLimits').get()).docs;
    expect(docs).toHaveLength(2);
    for (const doc of docs) {
      expect(doc.id).not.toContain('203.0.113.7');
      expect(JSON.stringify(doc.data())).not.toContain('203.0.113.7');
      expect(doc.get('expiresAt').toDate().getTime()).toBeGreaterThan(ctx.now().getTime());
    }
  });

  it('RF-4 (001): sin sal configurada se rechaza en lugar de guardar un hash predecible', async () => {
    await expect(consumeEnrollmentSlot({ ...ctx, clientIp: '203.0.113.7' })).rejects.toThrow(/sal/);
  });
});
