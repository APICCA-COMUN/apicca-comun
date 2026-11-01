// T-1.25 y T-1.26: aceptar o descartar solicitudes de ingreso (RF-4 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
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

async function seedRequest(email: string): Promise<string> {
  const ref = await ctx.db.collection('enrollmentRequests').add({
    email,
    name: 'Ana',
    message: 'Quiero sumarme',
    status: 'pending',
    createdAt: ctx.now(),
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
    expect(result.link).toBe(`/registro/${invitations.docs[0]?.get('token')}`);
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

  it('RF-4 (001): una solicitud inexistente o ya resuelta se rechaza', async () => {
    const id = await seedRequest('ana@ejemplo.org');
    await handleResolveEnrollment(ctx, { id, decision: 'accept' }, facilitator);
    expect(await codeOf(handleResolveEnrollment(ctx, { id, decision: 'discard', reason: 'x' }, facilitator))).toBe('invalid-request');
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
