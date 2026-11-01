// T-1.10: quién pasa por requireActor y requireFacilitator (RF-5 (001), RNF-5 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { requireActor, requireFacilitator } from './access';
import { ApiError } from './errors';
import { clearEmulators, createTestCtx, seedAccount } from './testing';

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

describe('access', () => {
  beforeEach(clearEmulators);

  it('RNF-5 (001): rechaza a quien no tiene sesión', async () => {
    const ctx = createTestCtx();
    expect(await codeOf(requireActor(ctx, null))).toBe('unauthenticated');
  });

  it('RNF-5 (001): rechaza a un usuario de Auth sin cuenta', async () => {
    const ctx = createTestCtx();
    expect(await codeOf(requireActor(ctx, 'no-existe'))).toBe('forbidden');
  });

  it('RF-5 (001): rechaza a una cuenta suspendida', async () => {
    const ctx = createTestCtx();
    const { uid } = await seedAccount(ctx, { username: 'ana', status: 'suspended' });
    expect(await codeOf(requireActor(ctx, uid))).toBe('account-suspended');
  });

  it('RF-5 (001): deja pasar a una cuenta activa y devuelve su rol', async () => {
    const ctx = createTestCtx();
    const { uid } = await seedAccount(ctx, { username: 'ana', role: 'member' });
    expect(await requireActor(ctx, uid)).toMatchObject({ uid, role: 'member', username: 'ana' });
  });

  it('RF-5 (001): requireFacilitator rechaza a una persona inscrita y deja pasar a un facilitador', async () => {
    const ctx = createTestCtx();
    const member = await seedAccount(ctx, { username: 'ana', role: 'member' });
    const facilitator = await seedAccount(ctx, { username: 'fabi', role: 'facilitator' });
    expect(await codeOf(requireFacilitator(ctx, member.uid))).toBe('forbidden');
    expect(await codeOf(requireFacilitator(ctx, null))).toBe('unauthenticated');
    expect((await requireFacilitator(ctx, facilitator.uid)).role).toBe('facilitator');
  });

  it('RF-5 (001): una suspensión surte efecto en la siguiente llamada, sin esperar al token', async () => {
    const ctx = createTestCtx();
    const { uid } = await seedAccount(ctx, { username: 'ana' });
    await requireActor(ctx, uid);
    await ctx.db.doc(`accounts/${uid}`).update({ status: 'suspended' });
    expect(await codeOf(requireActor(ctx, uid))).toBe('account-suspended');
  });
});
