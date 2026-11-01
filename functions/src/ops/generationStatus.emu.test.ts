// T-6.13: estado de la generación de hoy (RF-19 (001), RF-17 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { handleGenerationStatus } from './generationStatus';

let ctx: TestCtx;
let ana: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

const used = (count: number) =>
  ctx.db.doc(`generationDays/${ana}_2026-09-01`).set({ count, expiresAt: new Date('2026-09-05T00:00:00Z') });

describe('generationStatus', () => {
  it.each([
    [0, 3],
    [2, 1],
    [3, 0],
  ])('RF-19 (001): con %i usadas quedan %i', async (count, left) => {
    if (count > 0) await used(count);
    expect(await handleGenerationStatus(ctx, {}, ana)).toEqual({
      remaining: left,
      limit: 3,
      resetAt: '2026-09-02T05:00:00.000Z',
      blockedUntil: null,
    });
  });

  it('RF-19 (001): el reinicio es la medianoche de Colombia, también a las 23:59 y a las 00:00', async () => {
    ctx.setNow(new Date('2026-09-02T04:59:00Z'));
    expect(((await handleGenerationStatus(ctx, {}, ana)) as { resetAt: string }).resetAt).toBe('2026-09-02T05:00:00.000Z');
    ctx.setNow(new Date('2026-09-02T05:00:00Z'));
    expect(((await handleGenerationStatus(ctx, {}, ana)) as { resetAt: string }).resetAt).toBe('2026-09-03T05:00:00.000Z');
  });

  it('RF-19 (001): si el tope global se agotó no queda ninguna para nadie', async () => {
    await ctx.db.doc('generationDays/global_2026-09-01').set({ count: 60, expiresAt: new Date('2026-09-05T00:00:00Z') });
    expect(((await handleGenerationStatus(ctx, {}, ana)) as { remaining: number }).remaining).toBe(0);
  });

  it('RF-20 (001): muestra el bloqueo activo y deja de mostrarlo al vencer', async () => {
    await ctx.db.doc(`generation/${ana}`).set({ lock: null, consecutiveFailures: 0, blockedUntil: new Date('2026-09-01T15:10:00Z') });
    expect(((await handleGenerationStatus(ctx, {}, ana)) as { blockedUntil: string | null }).blockedUntil).toBe('2026-09-01T15:10:00.000Z');
    ctx.setNow(new Date('2026-09-01T15:10:00Z'));
    expect(((await handleGenerationStatus(ctx, {}, ana)) as { blockedUntil: string | null }).blockedUntil).toBeNull();
  });

  it('RF-17 (001): exige sesión', async () => {
    expect(await codeOf(handleGenerationStatus(ctx, {}, null))).toBe('unauthenticated');
  });
});
