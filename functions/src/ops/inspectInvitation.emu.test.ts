// T-1.18: quien abre un enlace de invitación ve su estado y el correo (RF-2 (001)); T-6 (016): token con hash (RF-8 (016) · 8.1).
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import { hashToken } from '../invitationToken';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { handleCancelInvitation } from './cancelInvitation';
import { handleInspectInvitation } from './inspectInvitation';
import { handleInvite } from './invite';

const keyOf = (email: string) => createHash('sha256').update(email).digest('hex');
const tokenOf = (link: unknown) => (link as { link: string }).link.replace('/registro/', '');

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
});

describe('inspectInvitation', () => {
  it('RF-2 (001): un enlace válido da el correo, sin sesión', async () => {
    const token = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    expect(await handleInspectInvitation(ctx, { token }, null)).toEqual({
      state: 'pending',
      email: 'ana@ejemplo.org',
      accountExists: false,
    });
  });

  it('RF-2 (001): un enlace inexistente se rechaza', async () => {
    expect(await codeOf(handleInspectInvitation(ctx, { token: 'x'.repeat(32) }, null))).toBe('invitation-not-found');
    expect(await codeOf(handleInspectInvitation(ctx, {}, null))).toBe('invalid-request');
    expect(await codeOf(handleInspectInvitation(ctx, { token: '' }, null))).toBe('invalid-request');
  });

  it('RF-2 (001): un enlace vencido se informa como vencido', async () => {
    const token = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    ctx.setNow(new Date('2026-10-01T15:00:00Z'));
    expect(await handleInspectInvitation(ctx, { token }, null)).toMatchObject({ state: 'expired' });
  });

  it('RF-2 (001): un enlace anulado ya no existe para quien lo abre', async () => {
    const token = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    await handleCancelInvitation(ctx, { email: 'ana@ejemplo.org' }, facilitator);
    expect(await codeOf(handleInspectInvitation(ctx, { token }, null))).toBe('invitation-not-found');
  });

  it('RF-2 (001): el token viejo de una invitación renovada se rechaza y el nuevo vale', async () => {
    const old = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    const fresh = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    expect(await codeOf(handleInspectInvitation(ctx, { token: old }, null))).toBe('invitation-not-found');
    expect(await handleInspectInvitation(ctx, { token: fresh }, null)).toMatchObject({ state: 'pending' });
  });

  it('RF-2 (001): un enlace ya usado se informa como aceptado', async () => {
    const token = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    const [doc] = (await ctx.db.collection('invitations').where('tokenHash', '==', hashToken(token)).get()).docs;
    await doc?.ref.update({ status: 'accepted' });
    expect(await handleInspectInvitation(ctx, { token }, null)).toMatchObject({ state: 'accepted' });
  });

  it('RF-2 (001): un enlace válido cuyo correo ya tiene cuenta lo advierte', async () => {
    const token = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    await seedAccount(ctx, { email: 'ana@ejemplo.org', username: 'ana' });
    expect(await handleInspectInvitation(ctx, { token }, null)).toMatchObject({ state: 'pending', accountExists: true });
  });

  it('RF-8 (016) · 8.1: una invitación nueva se encuentra por su tokenHash y el hash no vale como enlace', async () => {
    const token = tokenOf(await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator));
    const data = (await ctx.db.doc(`invitations/${keyOf('ana@ejemplo.org')}`).get()).data() as Record<string, unknown>;
    expect(data['token']).toBeUndefined();
    expect(await handleInspectInvitation(ctx, { token }, null)).toMatchObject({ state: 'pending', email: 'ana@ejemplo.org' });
    expect(await codeOf(handleInspectInvitation(ctx, { token: hashToken(token) }, null))).toBe('invitation-not-found');
  });

  it('RF-8 (016) · 8.1: una invitación heredada, con el token en claro, se sigue encontrando', async () => {
    await ctx.db.doc(`invitations/${keyOf('ana@ejemplo.org')}`).set({
      email: 'ana@ejemplo.org',
      token: 'token-heredado-en-claro-0123456789',
      status: 'pending',
      issuedAt: ctx.now(),
      expiresAt: new Date(ctx.now().getTime() + 30 * 24 * 3600 * 1000),
      createdBy: facilitator,
    });
    expect(await handleInspectInvitation(ctx, { token: 'token-heredado-en-claro-0123456789' }, null)).toEqual({
      state: 'pending',
      email: 'ana@ejemplo.org',
      accountExists: false,
    });
  });
});
