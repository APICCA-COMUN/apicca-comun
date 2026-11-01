// T-1.13: el script del primer facilitador, contra los emuladores (spec §6, D-8 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount } from '../src/testing';
import { bootstrapFacilitator } from './bootstrap-facilitator';

const input = { email: ' Fabi@Ejemplo.org ', password: 'una-contraseña-larga', name: 'Fabiana', username: 'Fabi' };

describe('bootstrap-facilitator', () => {
  beforeEach(clearEmulators);

  it('D-8 (001): crea el usuario de Auth, accounts/{uid} como facilitador y usernames/{nombre}', async () => {
    const ctx = createTestCtx();
    const { uid } = await bootstrapFacilitator(ctx, input);
    expect((await ctx.auth.getUser(uid)).email).toBe('fabi@ejemplo.org');
    expect((await ctx.db.doc(`accounts/${uid}`).get()).data()).toEqual({
      email: 'fabi@ejemplo.org',
      name: 'Fabiana',
      username: 'fabi',
      role: 'facilitator',
      status: 'active',
    });
    expect((await ctx.db.doc('usernames/fabi').get()).data()).toEqual({ uid });
  });

  it('D-8 (001): volver a correrlo con el mismo correo no duplica nada', async () => {
    const ctx = createTestCtx();
    const first = await bootstrapFacilitator(ctx, input);
    const second = await bootstrapFacilitator(ctx, input);
    expect(second.uid).toBe(first.uid);
    expect((await ctx.auth.listUsers()).users).toHaveLength(1);
    expect((await ctx.db.collection('accounts').get()).size).toBe(1);
    expect((await ctx.db.collection('usernames').get()).size).toBe(1);
  });

  it('D-8 (001): promueve y reactiva una cuenta existente sin cambiar su nombre de usuario', async () => {
    const ctx = createTestCtx();
    const member = await seedAccount(ctx, { email: 'fabi@ejemplo.org', username: 'ana', status: 'suspended' });
    const { uid } = await bootstrapFacilitator(ctx, input);
    expect(uid).toBe(member.uid);
    expect((await ctx.db.doc(`accounts/${uid}`).get()).data()).toMatchObject({
      role: 'facilitator',
      status: 'active',
      username: 'ana',
    });
    expect((await ctx.db.collection('usernames').get()).size).toBe(1);
  });

  it('D-8 (001): rechaza datos inválidos y un nombre de usuario ya tomado por otra cuenta', async () => {
    const ctx = createTestCtx();
    await expect(bootstrapFacilitator(ctx, { ...input, password: 'corta' })).rejects.toThrow(/contraseña/);
    await expect(bootstrapFacilitator(ctx, { ...input, username: 'admin' })).rejects.toThrow(/reservado/);
    await seedAccount(ctx, { email: 'otra@ejemplo.org', username: 'fabi' });
    await expect(bootstrapFacilitator(ctx, input)).rejects.toThrow(/en uso/);
    expect((await ctx.auth.listUsers()).users).toHaveLength(1);
  });
});
