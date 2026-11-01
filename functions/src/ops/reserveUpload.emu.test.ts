// T-10 (016): reserva de subida con cupo diario (RF-7 (016) · 7.3, D-T9 (016)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { DAILY_QUOTAS } from '../rateLimit';
import { handleReserveUpload } from './reserveUpload';

let ctx: TestCtx;
let ana: string;
let beto: string;

const reserve = (uid: string | null) => handleReserveUpload(ctx, {}, uid);
const reservation = async (uploadId: string) => (await ctx.db.doc(`uploadReservations/${uploadId}`).get()).data();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-11-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto', status: 'suspended' })).uid;
});

describe('reserveUpload', () => {
  it('RF-7 (016) · 7.3: concede una reserva para la persona, válida una hora, con un identificador apto para la ruta', async () => {
    const { uploadId } = await reserve(ana);
    expect(uploadId).toMatch(/^[A-Za-z0-9_-]{20}$/);
    const saved = await reservation(uploadId);
    expect(saved?.['uid']).toBe(ana);
    expect(saved?.['createdAt'].toDate()).toEqual(new Date('2026-11-01T15:00:00Z'));
    expect(saved?.['expiresAt'].toDate()).toEqual(new Date('2026-11-01T16:00:00Z'));
    expect((await reserve(ana)).uploadId).not.toBe(uploadId);
  });

  it('RF-7 (016) · 7.3: sin sesión o con la cuenta suspendida no hay reserva', async () => {
    expect(await codeOf(reserve(null))).toBe('unauthenticated');
    expect(await codeOf(reserve(beto))).toBe('account-suspended');
    expect((await ctx.db.collection('uploadReservations').get()).size).toBe(0);
  });

  it('RF-7 (016) · 7.3: la reserva 31 del día se rechaza con rate-limited y no deja reserva', async () => {
    expect(DAILY_QUOTAS.upload).toBe(30);
    await ctx.db.doc(`rateLimits/daily-upload-${ana}`).set({ count: 29, windowStart: ctx.now(), expiresAt: new Date(ctx.now().getTime() + 86_400_000) });
    await reserve(ana);
    expect(await codeOf(reserve(ana))).toBe('rate-limited');
    expect((await ctx.db.collection('uploadReservations').get()).size).toBe(1);
  });
});
