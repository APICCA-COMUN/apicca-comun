// T-1.8: el contexto de prueba levanta contra los emuladores, con reloj fijo y modelo doble.
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount } from './testing';

describe('Ctx de prueba', () => {
  beforeEach(clearEmulators);

  it('siembra una cuenta en Auth y en accounts/{uid} y la lee', async () => {
    const ctx = createTestCtx();
    const seeded = await seedAccount(ctx, { email: 'ana@x.org', username: 'ana', role: 'member' });
    const snap = await ctx.db.doc(`accounts/${seeded.uid}`).get();
    expect(snap.data()).toMatchObject({ email: 'ana@x.org', username: 'ana', role: 'member', status: 'active' });
    expect((await ctx.auth.getUser(seeded.uid)).email).toBe('ana@x.org');
  });

  it('el reloj es fijo y se puede adelantar', () => {
    const ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
    expect(ctx.now().toISOString()).toBe('2026-09-01T15:00:00.000Z');
    expect(ctx.now().toISOString()).toBe('2026-09-01T15:00:00.000Z');
  });

  it('el azar entrega los bytes pedidos y el modelo doble devuelve una imagen fija', async () => {
    const ctx = createTestCtx();
    expect(ctx.random(24)).toHaveLength(24);
    const a = await ctx.imageModel.generate({ prompt: 'x', references: [] });
    const b = await ctx.imageModel.generate({ prompt: 'otra', references: [] });
    expect(a.length).toBeGreaterThan(0);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
