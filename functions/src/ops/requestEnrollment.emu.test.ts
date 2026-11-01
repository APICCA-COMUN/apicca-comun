// T-1.24: solicitud pública de inscripción (RF-4 (001), D-T16 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { PRIVACY_TEXT_VERSION } from '../../../shared/domain/enrollment';
import { ApiError } from '../errors';
import { withOrigin } from '../rateLimit';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { handleInvite } from './invite';
import { handleRequestEnrollment } from './requestEnrollment';

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

const valid = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  name: 'Ana Pérez',
  message: 'Quiero sumarme',
  accepted: true,
  ...extra,
});

let ctx: TestCtx;
let from: (ip?: string) => TestCtx;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  from = (ip = '203.0.113.7') => withOrigin(ctx, ip, 'sal-de-prueba');
});

describe('requestEnrollment', () => {
  it('RF-4 (001): guarda la solicitud pendiente con fecha, versión y fecha de aceptación del texto', async () => {
    await handleRequestEnrollment(from(), valid(' Ana@Ejemplo.org '), null);
    const [doc] = (await ctx.db.collection('enrollmentRequests').get()).docs;
    expect(doc?.data()).toMatchObject({
      email: 'ana@ejemplo.org',
      name: 'Ana Pérez',
      message: 'Quiero sumarme',
      status: 'pending',
      privacyVersion: PRIVACY_TEXT_VERSION,
    });
    expect(doc?.get('createdAt').toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
    expect(doc?.get('acceptedAt').toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
  });

  it('RF-4 (001): la respuesta es idéntica para correo nuevo, con cuenta, con invitación y con solicitud previa', async () => {
    const facilitator = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
    await seedAccount(ctx, { email: 'cuenta@ejemplo.org', username: 'cuenta' });
    await handleInvite(ctx, { email: 'invitada@ejemplo.org' }, facilitator);
    await handleRequestEnrollment(from('203.0.113.1'), valid('previa@ejemplo.org'), null);
    const responses = [];
    for (const email of ['nueva@ejemplo.org', 'cuenta@ejemplo.org', 'invitada@ejemplo.org', 'previa@ejemplo.org']) {
      responses.push(await handleRequestEnrollment(from('203.0.113.2'), valid(email), null));
    }
    expect(new Set(responses.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it('RF-4 (001): el campo trampa lleno no guarda nada ni consume cupo, y responde igual', async () => {
    const honest = await handleRequestEnrollment(from('203.0.113.1'), valid('a@ejemplo.org'), null);
    const bot = await handleRequestEnrollment(from('203.0.113.2'), valid('b@ejemplo.org', { website: 'http://spam' }), null);
    expect(bot).toEqual(honest);
    expect((await ctx.db.collection('enrollmentRequests').get()).size).toBe(1);
    expect((await ctx.db.collection('rateLimits').get()).size).toBe(2); // solo el envío honesto
  });

  it('RF-4 (001): el sexto envío en una hora desde el mismo origen recibe el error de límite', async () => {
    for (let i = 0; i < 5; i += 1) await handleRequestEnrollment(from(), valid(`p${i}@ejemplo.org`), null);
    expect(await codeOf(handleRequestEnrollment(from(), valid('p6@ejemplo.org'), null))).toBe('rate-limited');
    expect((await ctx.db.collection('enrollmentRequests').get()).size).toBe(5);
  });

  it('RF-4 (001): exige la aceptación del tratamiento de datos y valida correo, nombre y largo del mensaje', async () => {
    expect(await codeOf(handleRequestEnrollment(from(), valid('a@ejemplo.org', { accepted: false }), null))).toBe('consent-required');
    expect(await codeOf(handleRequestEnrollment(from(), valid('sin-arroba'), null))).toBe('email-invalid');
    expect(await codeOf(handleRequestEnrollment(from(), valid('a@ejemplo.org', { name: '  ' }), null))).toBe('name-invalid');
    expect(await codeOf(handleRequestEnrollment(from(), valid('a@ejemplo.org', { message: 'x'.repeat(2001) }), null))).toBe('message-too-long');
    expect(await codeOf(handleRequestEnrollment(from(), { email: 3 }, null))).toBe('invalid-request');
    expect((await ctx.db.collection('enrollmentRequests').get()).size).toBe(0);
  });

  it('RF-4 (001): no necesita sesión y una solicitud inválida no gasta cupo', async () => {
    await codeOf(handleRequestEnrollment(from(), valid('sin-arroba'), null));
    expect((await ctx.db.collection('rateLimits').get()).size).toBe(0);
  });
});
