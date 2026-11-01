// T-1.19 a T-1.22: registro por invitación (RF-2 (001), D-T15 (001)).
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { handleCancelInvitation } from './cancelInvitation';
import { handleInvite } from './invite';
import { handleRegister } from './register';

const invitationPath = (email: string) => `invitations/${createHash('sha256').update(email).digest('hex')}`;
const DAY = 24 * 3600 * 1000;

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

async function invite(email = 'ana@ejemplo.org'): Promise<string> {
  const { link } = (await handleInvite(ctx, { email }, facilitator)) as { link: string };
  return link.replace('/registro/', '');
}

const form = (token: string, extra: Record<string, unknown> = {}) => ({
  token,
  password: 'una-clave-larga',
  name: '  Ana Pérez ',
  username: 'Ana_P',
  ...extra,
});

const authUserCount = async () => (await ctx.auth.listUsers()).users.length;
const status = async (email = 'ana@ejemplo.org') => (await ctx.db.doc(invitationPath(email)).get()).get('status');

/** Ctx cuya transacción corre `before` justo antes de empezar, o falla si `fail`. */
function withTransactionHook(base: TestCtx, hook: { before?: () => Promise<void>; fail?: boolean }): Ctx {
  const db = new Proxy(base.db, {
    get(target, prop) {
      if (prop === 'runTransaction') {
        return async (...args: unknown[]) => {
          if (hook.fail) throw new Error('boom');
          await hook.before?.();
          return (target.runTransaction as (...a: unknown[]) => Promise<unknown>)(...args);
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { ...base, db };
}

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  facilitator = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
});

describe('register · camino feliz', () => {
  it('RF-2 (001): registra a la persona con el correo de la invitación y deja la invitación aceptada', async () => {
    const token = await invite();
    const result = (await handleRegister(ctx, form(token), null)) as { uid: string };
    const account = (await ctx.db.doc(`accounts/${result.uid}`).get()).data();
    expect(account).toEqual({ email: 'ana@ejemplo.org', name: 'Ana Pérez', username: 'ana_p', role: 'member', status: 'active' });
    expect((await ctx.db.doc('usernames/ana_p').get()).data()).toEqual({ uid: result.uid });
    expect((await ctx.auth.getUser(result.uid)).email).toBe('ana@ejemplo.org');
    expect(await status()).toBe('accepted');
  });

  it('RF-2 (001): el correo no se puede cambiar por el payload', async () => {
    const token = await invite();
    const result = (await handleRegister(ctx, form(token, { email: 'otro@ejemplo.org' }), null)) as { uid: string };
    expect((await ctx.auth.getUser(result.uid)).email).toBe('ana@ejemplo.org');
    expect((await ctx.db.doc(`accounts/${result.uid}`).get()).get('email')).toBe('ana@ejemplo.org');
  });

  it('RF-2 (001): el rol de una persona registrada es miembro aunque el payload pida otro', async () => {
    const token = await invite();
    const result = (await handleRegister(ctx, form(token, { role: 'facilitator' }), null)) as { uid: string };
    expect((await ctx.db.doc(`accounts/${result.uid}`).get()).get('role')).toBe('member');
  });
});

describe('register · datos', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['contraseña corta', { password: '1234567' }, 'password-too-short'],
    ['nombre vacío', { name: '   ' }, 'name-invalid'],
    ['usuario inválido', { username: 'ñu' }, 'username-invalid'],
    ['usuario reservado', { username: 'Admin' }, 'username-reserved'],
    ['campo de otro tipo', { username: 42 }, 'invalid-request'],
  ];
  for (const [label, extra, code] of cases) {
    it(`RF-2 (001): ${label} se rechaza sin consumir la invitación ni crear usuario`, async () => {
      const token = await invite();
      const before = await authUserCount();
      expect(await codeOf(handleRegister(ctx, form(token, extra), null))).toBe(code);
      expect(await status()).toBe('pending');
      expect(await authUserCount()).toBe(before);
    });
  }

  it('RF-2 (001): un usuario ya existente, activo o suspendido, se rechaza igual aunque cambien las mayúsculas', async () => {
    await seedAccount(ctx, { username: 'ana_p', status: 'suspended' });
    const token = await invite();
    const before = await authUserCount();
    expect(await codeOf(handleRegister(ctx, form(token, { username: 'ANA_P' }), null))).toBe('username-taken');
    expect(await status()).toBe('pending');
    expect(await authUserCount()).toBe(before);
  });
});

describe('register · invitación', () => {
  it('RF-2 (001): sin enlace, con enlace inexistente o mal tipado se rechaza', async () => {
    expect(await codeOf(handleRegister(ctx, form(''), null))).toBe('invalid-request');
    expect(await codeOf(handleRegister(ctx, { ...form('x'), token: undefined }, null))).toBe('invalid-request');
    expect(await codeOf(handleRegister(ctx, form('x'.repeat(32)), null))).toBe('invitation-not-found');
  });

  it('RF-2 (001): un enlace ya usado se rechaza', async () => {
    const token = await invite();
    await handleRegister(ctx, form(token), null);
    expect(await codeOf(handleRegister(ctx, form(token, { username: 'otra' }), null))).toBe('invitation-used');
  });

  it('RF-2 (001): un enlace vencido se rechaza', async () => {
    const token = await invite();
    ctx.setNow(new Date(ctx.now().getTime() + 31 * DAY));
    expect(await codeOf(handleRegister(ctx, form(token), null))).toBe('invitation-expired');
    expect(await authUserCount()).toBe(1);
  });

  it('RF-2 (001): un enlace anulado o reemplazado por una renovación se rechaza', async () => {
    const old = await invite();
    const fresh = await invite();
    expect(await codeOf(handleRegister(ctx, form(old), null))).toBe('invitation-not-found');
    await handleCancelInvitation(ctx, { email: 'ana@ejemplo.org' }, facilitator);
    expect(await codeOf(handleRegister(ctx, form(fresh), null))).toBe('invitation-not-found');
  });

  it('RF-2 (001): se anula o renueva la invitación mientras se completa el registro', async () => {
    const token = await invite();
    const cancelling = withTransactionHook(ctx, {
      before: async () => void (await handleCancelInvitation(ctx, { email: 'ana@ejemplo.org' }, facilitator)),
    });
    expect(await codeOf(handleRegister(cancelling, form(token), null))).toBe('invitation-cancelled');
    expect(await status()).toBe('cancelled');

    const token2 = await invite();
    const renewing = withTransactionHook(ctx, { before: async () => void (await invite()) });
    expect(await codeOf(handleRegister(renewing, form(token2), null))).toBe('invitation-not-found');
    expect(await status()).toBe('pending');
    expect((await ctx.db.collection('accounts').get()).size).toBe(1); // solo la facilitadora
    expect(await authUserCount()).toBe(1);
  });

  it('RF-2 (001): un correo que ya tiene cuenta se rechaza', async () => {
    const token = await invite();
    await seedAccount(ctx, { email: 'ana@ejemplo.org', username: 'otra' });
    expect(await codeOf(handleRegister(ctx, form(token), null))).toBe('account-exists');
    expect(await status()).toBe('pending');
  });
});

describe('register · concurrencia y compensación', () => {
  it('RF-2 (001): dos registros con el mismo usuario a la vez, solo uno gana', async () => {
    const a = await invite('ana@ejemplo.org');
    const b = await invite('beto@ejemplo.org');
    const results = await Promise.allSettled([
      handleRegister(ctx, form(a), null),
      handleRegister(ctx, form(b, { name: 'Beto' }), null),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((loser.reason as ApiError).code).toBe('username-taken');
    expect((await ctx.db.collection('accounts').where('username', '==', 'ana_p').get()).size).toBe(1);
    expect(await authUserCount()).toBe(2); // facilitadora + la ganadora
    const loserEmail = (await status('ana@ejemplo.org')) === 'accepted' ? 'beto@ejemplo.org' : 'ana@ejemplo.org';
    expect(await status(loserEmail)).toBe('pending');
  }, 20_000);

  it('RF-2 (001): si la transacción falla se borra el usuario de Auth', async () => {
    const token = await invite();
    const broken = withTransactionHook(ctx, { fail: true });
    await expect(handleRegister(broken, form(token), null)).rejects.toThrow('boom');
    await expect(ctx.auth.getUserByEmail('ana@ejemplo.org')).rejects.toThrow();
    expect(await status()).toBe('pending');
  });

  it('RF-2 (001): un usuario de Auth huérfano se reemplaza y el registro termina bien', async () => {
    const token = await invite();
    const orphan = await ctx.auth.createUser({ email: 'ana@ejemplo.org', password: 'clave-vieja-1234' });
    const result = (await handleRegister(ctx, form(token), null)) as { uid: string };
    expect(result.uid).not.toBe(orphan.uid);
    expect((await ctx.auth.getUserByEmail('ana@ejemplo.org')).uid).toBe(result.uid);
    expect(await status()).toBe('accepted');
  });
});
