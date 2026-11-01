// T-1.15 y T-1.16: crear y renovar invitaciones (RF-1 (001)); T-6 (016): solo se guarda el hash del token (RF-8 (016) · 8.1).
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { hashToken } from '../invitationToken';
import { handleInvite } from './invite';

const keyOf = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

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

describe('invite · crear', () => {
  it('RF-1 (001): un correo nuevo crea una invitación pendiente a 30 días y devuelve el enlace', async () => {
    const result = (await handleInvite(ctx, { email: ' Nueva@Ejemplo.org ' }, facilitator)) as { link: string };
    const snap = await ctx.db.doc(`invitations/${keyOf('nueva@ejemplo.org')}`).get();
    const doc = snap.data() as { email: string; tokenHash: string; status: string; expiresAt: { toDate(): Date }; createdBy: string };
    expect(doc).toMatchObject({ email: 'nueva@ejemplo.org', status: 'pending', createdBy: facilitator });
    expect(doc.expiresAt.toDate().toISOString()).toBe('2026-10-01T15:00:00.000Z');
    const token = result.link.replace('/registro/', '');
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/); // 192 bits en base64url
    expect(result.link).toBe(`/registro/${token}`);
    expect(doc.tokenHash).toBe(hashToken(token));
  });

  it('RF-8 (016) · 8.1: la invitación nueva guarda tokenHash y no guarda el token en ningún campo', async () => {
    const { link } = (await handleInvite(ctx, { email: 'nueva@ejemplo.org' }, facilitator)) as { link: string };
    const token = link.replace('/registro/', '');
    const data = (await ctx.db.doc(`invitations/${keyOf('nueva@ejemplo.org')}`).get()).data() as Record<string, unknown>;
    expect(data['token']).toBeUndefined();
    expect(data['tokenHash']).toBe(hashToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect((await ctx.db.collection('invitations').where('token', '==', token).get()).empty).toBe(true);
  });

  it('RF-1 (001): el correo de una cuenta activa o suspendida no recibe invitación', async () => {
    await seedAccount(ctx, { email: 'activa@ejemplo.org', username: 'activa' });
    await seedAccount(ctx, { email: 'susi@ejemplo.org', username: 'susi', status: 'suspended' });
    expect(await codeOf(handleInvite(ctx, { email: 'ACTIVA@ejemplo.org' }, facilitator))).toBe('account-exists');
    expect(await codeOf(handleInvite(ctx, { email: 'susi@ejemplo.org' }, facilitator))).toBe('account-exists');
    expect((await ctx.db.collection('invitations').get()).size).toBe(0);
  });

  it('RF-1 (001): quien no es facilitador recibe error', async () => {
    const member = (await seedAccount(ctx, { username: 'ana' })).uid;
    expect(await codeOf(handleInvite(ctx, { email: 'x@ejemplo.org' }, member))).toBe('forbidden');
    expect(await codeOf(handleInvite(ctx, { email: 'x@ejemplo.org' }, null))).toBe('unauthenticated');
  });

  it('RF-1 (001): rechaza un correo mal formado o ausente', async () => {
    expect(await codeOf(handleInvite(ctx, { email: 'sin-arroba' }, facilitator))).toBe('email-invalid');
    expect(await codeOf(handleInvite(ctx, {}, facilitator))).toBe('invalid-request');
  });
});

describe('invite · renovar', () => {
  const hashOf = async (email: string) =>
    ((await ctx.db.doc(`invitations/${keyOf(email)}`).get()).data() as { tokenHash?: string }).tokenHash;

  it('RF-1 (001): una invitación pendiente, vencida o anulada se renueva con otro token y sin duplicar', async () => {
    const email = 'ana@ejemplo.org';
    await handleInvite(ctx, { email }, facilitator);
    for (const status of ['pending', 'pending', 'cancelled'] as const) {
      const before = await hashOf(email);
      if (status === 'cancelled') {
        await ctx.db.doc(`invitations/${keyOf(email)}`).update({ status: 'cancelled' });
      }
      ctx.setNow(new Date(ctx.now().getTime() + 40 * 24 * 3600 * 1000)); // pasa el vencimiento
      const result = (await handleInvite(ctx, { email }, facilitator)) as { link: string };
      const after = await hashOf(email);
      expect(after).not.toBe(before);
      expect(after).toBe(hashToken(result.link.replace('/registro/', '')));
      expect((await ctx.db.collection('invitations').get()).size).toBe(1);
      const doc = (await ctx.db.doc(`invitations/${keyOf(email)}`).get()).data() as { status: string; expiresAt: { toDate(): Date } };
      expect(doc.status).toBe('pending');
      expect(doc.expiresAt.toDate().getTime()).toBe(ctx.now().getTime() + 30 * 24 * 3600 * 1000);
    }
  });

  it('RF-1 (001): el token anterior ya no está guardado en ningún documento', async () => {
    const first = (await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator)) as { link: string };
    const old = first.link.replace('/registro/', '');
    await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator);
    expect((await ctx.db.collection('invitations').where('token', '==', old).get()).empty).toBe(true);
    expect((await ctx.db.collection('invitations').where('tokenHash', '==', hashToken(old)).get()).empty).toBe(true);
  });

  it('RF-8 (016) · 8.1: renovar una invitación heredada con token en claro borra ese token', async () => {
    const path = `invitations/${keyOf('ana@ejemplo.org')}`;
    await ctx.db.doc(path).set({
      email: 'ana@ejemplo.org',
      token: 'token-heredado-en-claro',
      status: 'pending',
      issuedAt: ctx.now(),
      expiresAt: new Date(ctx.now().getTime() + 30 * 24 * 3600 * 1000),
      createdBy: facilitator,
    });
    await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator);
    const data = (await ctx.db.doc(path).get()).data() as Record<string, unknown>;
    expect(data['token']).toBeUndefined();
    expect(typeof data['tokenHash']).toBe('string');
  });

  it('RF-1 (001): renovar con otras mayúsculas o espacios no crea otra invitación', async () => {
    await handleInvite(ctx, { email: 'ana@ejemplo.org' }, facilitator);
    await handleInvite(ctx, { email: '  ANA@Ejemplo.org ' }, facilitator);
    expect((await ctx.db.collection('invitations').get()).size).toBe(1);
  });
});
