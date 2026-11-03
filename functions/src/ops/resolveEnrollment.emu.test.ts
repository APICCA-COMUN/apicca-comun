// T-1.25 y T-1.26: aceptar o descartar solicitudes de ingreso (RF-4 (001)); una sola resolución (RF-3 (018)).
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import { hashToken } from '../invitationToken';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { handleResolveEnrollment } from './resolveEnrollment';

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

async function seedRequest(email: string, expiresAt?: Date): Promise<string> {
  const ref = await ctx.db.collection('enrollmentRequests').add({
    email,
    name: 'Ana',
    message: 'Quiero sumarme',
    status: 'pending',
    createdAt: ctx.now(),
    ...(expiresAt ? { expiresAt } : {}),
  });
  return ref.id;
}

const read = async (id: string) => (await ctx.db.doc(`enrollmentRequests/${id}`).get()).data() as Record<string, unknown>;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  facilitator = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
});

describe('resolveEnrollment · aceptar', () => {
  it('RF-4 (001): acepta, registra quién y cuándo, crea la invitación y devuelve el enlace', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    const result = (await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator)) as { link: string };
    const invitations = await ctx.db.collection('invitations').get();
    expect(invitations.size).toBe(1);
    expect(invitations.docs[0]?.get('tokenHash')).toBe(hashToken(result.link.replace('/registro/', ''))); // RF-8 (016) · 8.1
    const doc = await read(id);
    expect(doc['status']).toBe('accepted');
    expect(doc['resolvedBy']).toBe(facilitator);
    expect((doc['resolvedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
  });

  it('RF-4 (001): si el correo ya tiene cuenta, informa y deja la solicitud pendiente', async () => {
    await seedAccount(ctx, { email: 'ana@ejemplo.org', username: 'ana' });
    const id = await seedRequest('ana@ejemplo.org');
    expect(await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator)).toEqual({ accountExists: true });
    expect((await read(id))['status']).toBe('pending');
    expect((await ctx.db.collection('invitations').get()).size).toBe(0);
  });

  it('RF-4 (001): quien no es facilitador recibe error y la solicitud no cambia', async () => {
    const member = (await seedAccount(ctx, { username: 'beto' })).uid;
    const id = await seedRequest('ana@ejemplo.org');
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'accept' }, member))).toBe('forbidden');
    expect((await read(id))['status']).toBe('pending');
  });

  it('RF-4 (001), RF-3 (018) · 3.2: una solicitud inexistente se rechaza y una ya resuelta responde enrollment-resolved', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator);
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'x' }, facilitator))).toBe('enrollment-resolved');
    expect(await codeOf(handleResolveEnrollment(ctx, { id: 'nada', decision: 'accept' }, facilitator))).toBe('invalid-request');
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'otra' }, facilitator))).toBe('invalid-request');
  });
});

describe('resolveEnrollment · descartar', () => {
  it('RF-4 (001): sin motivo se rechaza y la solicitud sigue pendiente', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'discard', reason: '   ' }, facilitator))).toBe('reason-required');
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'discard' }, facilitator))).toBe('reason-required');
    expect((await read(id))['status']).toBe('pending');
  });

  it('RF-4 (001): descarta con motivo, registra quién y cuándo, y no borra la solicitud', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    await handleResolveEnrollment(ctx, { id, decision: 'discard', reason: ' No es del territorio ' }, facilitator);
    const doc = await read(id);
    expect(doc).toMatchObject({ status: 'discarded', resolvedBy: facilitator, reason: 'No es del territorio' });
    expect((await ctx.db.collection('invitations').get()).size).toBe(0);
  });
});

describe('resolveEnrollment · caducidad', () => {
  const VIGENTE = new Date('2026-09-20T00:00:00Z');
  const CADUCADA = new Date('2026-08-31T00:00:00Z');

  it('RF-8 (016) · 8.3: una solicitud caducada no se acepta ni se descarta y no cambia', async () => {
    const id = await seedRequest('ana@ejemplo.org', CADUCADA);
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator))).toBe('enrollment-expired');
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'x' }, facilitator))).toBe('enrollment-expired');
    expect((await read(id))['status']).toBe('pending');
    expect((await ctx.db.collection('invitations').get()).size).toBe(0);
  });

  it('RF-8 (016) · 8.3: al aceptar una vigente se borra expiresAt para que el TTL no la elimine', async () => {
    const id = await seedRequest('ana@ejemplo.org', VIGENTE);
    await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator);
    const doc = await read(id);
    expect(doc['status']).toBe('accepted');
    expect('expiresAt' in doc).toBe(false);
  });

  it('RF-8 (016) · 8.3: al descartar una vigente se borra expiresAt', async () => {
    const id = await seedRequest('ana@ejemplo.org', VIGENTE);
    await handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'No es del territorio' }, facilitator);
    const doc = await read(id);
    expect(doc['status']).toBe('discarded');
    expect('expiresAt' in doc).toBe(false);
  });

  it('RF-8 (016) · 8.3: si el correo ya tiene cuenta, la solicitud vigente conserva expiresAt', async () => {
    await seedAccount(ctx, { email: 'ana@ejemplo.org', username: 'ana' });
    const id = await seedRequest('ana@ejemplo.org', VIGENTE);
    expect(await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator)).toEqual({ accountExists: true });
    expect('expiresAt' in (await read(id))).toBe(true);
  });

  it('RF-8 (016) · 8.3: una solicitud anterior a la 016, sin expiresAt, se sigue resolviendo', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    await handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'x' }, facilitator);
    expect((await read(id))['status']).toBe('discarded');
  });
});

describe('resolveEnrollment · una sola resolución (RF-3 (018))', () => {
  const invitations = async () => (await ctx.db.collection('invitations').get()).docs;

  it('RF-3 (018) · 3.1: dos aceptaciones simultáneas dan una invitación, un enlace válido y un enrollment-resolved', async () => {
    const other = (await seedAccount(ctx, { username: 'gabi', role: 'facilitator' })).uid;
    const id = await seedRequest('ana@ejemplo.org');
    const results = await Promise.allSettled([
      handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator),
      handleResolveEnrollment(ctx, { id, decision: 'accept' }, other),
    ]);
    const links = results.flatMap((r) => (r.status === 'fulfilled' && 'link' in r.value ? [r.value.link] : []));
    const codes = results.flatMap((r) => (r.status === 'rejected' && r.reason instanceof ApiError ? [r.reason.code] : []));
    expect(links).toHaveLength(1);
    expect(codes).toEqual(['enrollment-resolved']);
    const docs = await invitations();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.get('tokenHash')).toBe(hashToken(links[0]!.replace('/registro/', '')));
    expect((await read(id))['status']).toBe('accepted');
  });

  it('RF-3 (018) · 3.1: una aceptación y un descarte simultáneos aplican solo uno', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    const results = await Promise.allSettled([
      handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator),
      handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'Duplicada' }, facilitator),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const status = (await read(id))['status'];
    expect((await invitations()).length).toBe(status === 'accepted' ? 1 : 0);
  });

  it('RF-3 (018) · 3.3: resolver otra vez una solicitud aceptada no renueva la invitación', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    const { link } = (await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator)) as { link: string };
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator))).toBe('enrollment-resolved');
    const docs = await invitations();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.get('tokenHash')).toBe(hashToken(link.replace('/registro/', '')));
  });

  it('RF-3 (018) · 3.3: una solicitud descartada no se acepta ni crea invitación', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    await handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'No es del territorio' }, facilitator);
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator))).toBe('enrollment-resolved');
    expect(await invitations()).toHaveLength(0);
    expect((await read(id))['status']).toBe('discarded');
  });

  it('RF-3 (018) · 3.4: si el correo ya tiene cuenta, la solicitud queda pendiente, sin resolver y sin invitación', async () => {
    await seedAccount(ctx, { email: 'ana@ejemplo.org', username: 'ana' });
    const id = await seedRequest('ana@ejemplo.org');
    expect(await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator)).toEqual({ accountExists: true });
    const doc = await read(id);
    expect(doc['status']).toBe('pending');
    expect('resolvedBy' in doc).toBe(false);
    expect(await invitations()).toHaveLength(0);
    // Sigue pendiente de verdad: después se puede descartar.
    await handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'Ya tiene cuenta' }, facilitator);
    expect((await read(id))['status']).toBe('discarded');
  });
});
