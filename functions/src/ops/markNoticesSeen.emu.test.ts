// T-4 (012) · RF-3 (012): marcar los avisos como leídos.
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { handleMarkNoticesSeen } from './markNoticesSeen';

let ctx: TestCtx;
let ana: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-10T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('markNoticesSeen', () => {
  it('RF-3 (012): guarda la fecha de ese momento en la cuenta de quien llama', async () => {
    expect(await handleMarkNoticesSeen(ctx, {}, ana)).toEqual({});
    const seen = (await ctx.db.doc(`accounts/${ana}`).get()).get('noticesSeenAt') as { toDate(): Date };
    expect(seen.toDate().toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it('RF-3 (012): un visitante y una cuenta suspendida reciben error', async () => {
    expect(await codeOf(handleMarkNoticesSeen(ctx, {}, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'suspended' });
    expect(await codeOf(handleMarkNoticesSeen(ctx, {}, ana))).toBe('account-suspended');
  });
});
