// T-1.23: ventanas y topes con TTL por clave (RF-4 (001), D-T16 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { clearEmulators, createTestCtx, type TestCtx } from './testing';
import {
  ANONYMOUS_READS_PER_HOUR,
  DAILY_KEY,
  DAILY_QUOTAS,
  consumeAnonymousReadSlot,
  consumeDailySlot,
  consumeEnrollmentSlot,
  originOf,
  withOrigin,
} from './rateLimit';

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

describe('rateLimit · cuotas diarias por persona', () => {
  it('RF-7 (016) · 7.1: los topes son 50 respuestas, 50 comentarios, 10 ápices, 30 subidas (D-5 (016), D-7 (016)) y 100 ediciones (D-2 (018))', () => {
    expect(DAILY_QUOTAS).toEqual({ reply: 50, comment: 50, apice: 10, upload: 30, edit: 100 });
  });

  for (const kind of ['reply', 'comment', 'apice', 'upload', 'edit'] as const) {
    it(`RF-7 (016) · 7.1: la llamada ${DAILY_QUOTAS[kind] + 1} de «${kind}» en el día se rechaza y al día siguiente vuelve a permitirse`, async () => {
      // Se siembra el contador justo bajo el tope para no hacer decenas de transacciones.
      await ctx.db.doc(`rateLimits/daily-${kind}-ana`).set({
        count: DAILY_QUOTAS[kind] - 1,
        windowStart: ctx.now(),
        expiresAt: new Date(ctx.now().getTime() + 24 * 3600 * 1000),
      });
      await consumeDailySlot(ctx, kind, 'ana');
      expect(await codeOf(consumeDailySlot(ctx, kind, 'ana'))).toBe('rate-limited');
      expect((await ctx.db.doc(`rateLimits/daily-${kind}-ana`).get()).get('count')).toBe(DAILY_QUOTAS[kind]);
      ctx.setNow(new Date('2026-09-02T15:00:00Z'));
      expect(await codeOf(consumeDailySlot(ctx, kind, 'ana'))).toBeUndefined();
    });
  }

  it('RF-7 (016) · 7.1: la llamada 11 de «apice» se rechaza contando una a una', async () => {
    for (let i = 0; i < DAILY_QUOTAS.apice; i += 1) await consumeDailySlot(ctx, 'apice', 'ana');
    expect(await codeOf(consumeDailySlot(ctx, 'apice', 'ana'))).toBe('rate-limited');
  });

  it('RF-7 (016) · 7.1: el cupo es independiente entre personas', async () => {
    for (let i = 0; i < DAILY_QUOTAS.apice; i += 1) await consumeDailySlot(ctx, 'apice', 'ana');
    expect(await codeOf(consumeDailySlot(ctx, 'apice', 'ana'))).toBe('rate-limited');
    expect(await codeOf(consumeDailySlot(ctx, 'apice', 'beto'))).toBeUndefined();
  });

  it('RF-7 (016) · 7.1: el cupo es independiente entre tipos de acción', async () => {
    for (let i = 0; i < DAILY_QUOTAS.apice; i += 1) await consumeDailySlot(ctx, 'apice', 'ana');
    expect(await codeOf(consumeDailySlot(ctx, 'apice', 'ana'))).toBe('rate-limited');
    expect(await codeOf(consumeDailySlot(ctx, 'reply', 'ana'))).toBeUndefined();
    expect(await codeOf(consumeDailySlot(ctx, 'comment', 'ana'))).toBeUndefined();
    expect(await codeOf(consumeDailySlot(ctx, 'upload', 'ana'))).toBeUndefined();
  });

  it('RF-7 (016) · 7.1: la llamada rechazada no suma al contador y el documento lleva su vencimiento (TTL)', async () => {
    for (let i = 0; i < DAILY_QUOTAS.apice; i += 1) await consumeDailySlot(ctx, 'apice', 'ana');
    await codeOf(consumeDailySlot(ctx, 'apice', 'ana'));
    const snap = await ctx.db.doc('rateLimits/daily-apice-ana').get();
    expect(snap.get('count')).toBe(DAILY_QUOTAS.apice);
    expect(snap.get('expiresAt').toDate().getTime()).toBe(ctx.now().getTime() + 24 * 3600 * 1000);
  });
});

describe('rateLimit · lecturas anónimas', () => {
  it('RF-5 (016): el tope es de 100 lecturas por hora', () => {
    expect(ANONYMOUS_READS_PER_HOUR).toBe(100);
  });

  it('RF-5 (016): la lectura 101 en la hora se rechaza y pasada la hora vuelve a permitirse', async () => {
    const key = `rateLimits/reference-ip-${originOf(from('203.0.113.7'))}`;
    await ctx.db.doc(key).set({
      count: ANONYMOUS_READS_PER_HOUR - 1,
      windowStart: ctx.now(),
      expiresAt: new Date(ctx.now().getTime() + 3600 * 1000),
    });
    await consumeAnonymousReadSlot(from('203.0.113.7'));
    expect(await codeOf(consumeAnonymousReadSlot(from('203.0.113.7')))).toBe('rate-limited');
    ctx.setNow(new Date('2026-09-01T16:00:00Z'));
    expect(await codeOf(consumeAnonymousReadSlot(from('203.0.113.7')))).toBeUndefined();
  });

  it('RF-5 (016): cien lecturas seguidas pasan y la 101 falla; otra IP tiene su propio cupo', async () => {
    for (let i = 0; i < ANONYMOUS_READS_PER_HOUR; i += 1) await consumeAnonymousReadSlot(from('203.0.113.7'));
    expect(await codeOf(consumeAnonymousReadSlot(from('203.0.113.7')))).toBe('rate-limited');
    expect(await codeOf(consumeAnonymousReadSlot(from('203.0.113.8')))).toBeUndefined();
  });

  it('RF-5 (016): la clave no contiene la IP en claro y lleva vencimiento (TTL)', async () => {
    await consumeAnonymousReadSlot(from('203.0.113.7'));
    const docs = (await ctx.db.collection('rateLimits').get()).docs;
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toMatch(/^reference-ip-[0-9a-f]{64}$/);
    expect(docs[0]?.id).not.toContain('203.0.113.7');
    expect(docs[0]?.get('expiresAt').toDate().getTime()).toBe(ctx.now().getTime() + 3600 * 1000);
  });

  it('RF-5 (016): sin sal configurada se rechaza en lugar de guardar un hash predecible', async () => {
    await expect(consumeAnonymousReadSlot({ ...ctx, clientIp: '203.0.113.7' })).rejects.toThrow(/sal/);
  });

  it('RF-5 (016): el origen de la lectura anónima y el del alta coinciden (mismo HMAC de la IP)', async () => {
    await consumeEnrollmentSlot(from('203.0.113.7'));
    const origin = originOf(from('203.0.113.7'));
    expect((await ctx.db.doc(`rateLimits/enrollment-ip-${origin}`).get()).exists).toBe(true);
  });
});
