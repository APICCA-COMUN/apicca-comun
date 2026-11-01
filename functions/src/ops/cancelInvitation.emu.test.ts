// T-1.17: anular invitaciones (RF-1 (001)).
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { handleCancelInvitation } from './cancelInvitation';
import { handleInvite } from './invite';

const path = (email: string) => `invitations/${createHash('sha256').update(email).digest('hex')}`;

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
let facilitator: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  facilitator = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator);
});

describe('cancelInvitation', () => {
  it('RF-1 (001): anula una pendiente, borra el token y registra quién y cuándo', async () => {
    ctx.setNow(new Date('2026-09-05T10:00:00Z'));
    await handleCancelInvitation(ctx, { email: 'ana@ejemplo.org' }, facilitator);
    const data = (await ctx.db.doc(path('ana@ejemplo.org')).get()).data() as Record<string, unknown> & { cancelledAt: { toDate(): Date } };
    expect(data['status']).toBe('cancelled');
    expect(data['token']).toBeUndefined();
    expect(data['cancelledBy']).toBe(facilitator);
    expect(data.cancelledAt.toDate().toISOString()).toBe('2026-09-05T10:00:00.000Z');
  });

  it('RF-1 (001): anula una vencida', async () => {
    ctx.setNow(new Date('2026-12-01T00:00:00Z'));
    await handleCancelInvitation(ctx, { email: 'ana@ejemplo.org' }, facilitator);
    expect((await ctx.db.doc(path('ana@ejemplo.org')).get()).data()?.['status']).toBe('cancelled');
  });

  it('RF-1 (001): rechaza anular una aceptada y una que no existe', async () => {
    await ctx.db.doc(path('ana@ejemplo.org')).update({ status: 'accepted' });
    expect(await codeOf(handleCancelInvitation(ctx, { email: 'ana@ejemplo.org' }, facilitator))).toBe('invitation-not-cancellable');
    expect(await codeOf(handleCancelInvitation(ctx, { email: 'otra@ejemplo.org' }, facilitator))).toBe('invitation-not-found');
  });

  it('RF-1 (001): una persona no facilitadora recibe error', async () => {
    const member = (await seedAccount(ctx, { username: 'beto' })).uid;
    expect(await codeOf(handleCancelInvitation(ctx, { email: 'ana@ejemplo.org' }, member))).toBe('forbidden');
  });
});
