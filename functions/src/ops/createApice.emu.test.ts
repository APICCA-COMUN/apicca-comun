// T-2.10: crear un ápice (RF-6 (001), RF-7 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { handleCreateApice } from './createApice';

let ctx: TestCtx;
let ana: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('createApice', () => {
  it('RF-6 (001): un ápice válido queda privado, en «idea», con autor y versión 1', async () => {
    const { id } = (await handleCreateApice(ctx, { ...VALID, name: '  Huerta  ' }, ana)) as { id: string };
    const doc = (await ctx.db.doc(`apices/${id}`).get()).data();
    expect(doc).toMatchObject({
      name: 'Huerta',
      axes: ['alimento'],
      status: 'idea',
      visibility: 'private',
      isArchived: false,
      authorUid: ana,
      authorUsername: 'ana',
      version: 1,
    });
    const v1 = (await ctx.db.doc(`apices/${id}/versions/1`).get()).data();
    expect(v1).toMatchObject({ n: 1, kind: 'create', savedByUsername: 'ana' });
  });

  it('RF-6 (001): faltar nombre, descripción o ejes se rechaza con field-required y no guarda', async () => {
    for (const patch of [{ name: '  ' }, { description: '' }, { axes: [] }]) {
      expect(await codeOf(handleCreateApice(ctx, { ...VALID, ...patch }, ana))).toBe('field-required');
    }
    expect((await ctx.db.collection('apices').get()).size).toBe(0);
  });

  it('RF-7 (001): el exceso de texto se rechaza', async () => {
    expect(await codeOf(handleCreateApice(ctx, { ...VALID, name: 'x'.repeat(121) }, ana))).toBe('text-too-long');
    expect(await codeOf(handleCreateApice(ctx, { ...VALID, needs: 'x'.repeat(10_001) }, ana))).toBe('text-too-long');
  });

  it('RF-7 (001): dos ápices con el mismo nombre se permiten', async () => {
    await handleCreateApice(ctx, VALID, ana);
    await handleCreateApice(ctx, VALID, ana);
    expect((await ctx.db.collection('apices').get()).size).toBe(2);
  });

  it('RF-8 (001): el estado inicial puede ser otro válido y uno desconocido se rechaza', async () => {
    const { id } = (await handleCreateApice(ctx, { ...VALID, status: 'prototipo' }, ana)) as { id: string };
    expect((await ctx.db.doc(`apices/${id}`).get()).get('status')).toBe('prototipo');
    expect(await codeOf(handleCreateApice(ctx, { ...VALID, status: 'final' }, ana))).toBe('invalid-request');
  });

  it('RF-10 (001): sin sesión o con cuenta suspendida se rechaza', async () => {
    const susi = (await seedAccount(ctx, { username: 'susi', status: 'suspended' })).uid;
    expect(await codeOf(handleCreateApice(ctx, VALID, null))).toBe('unauthenticated');
    expect(await codeOf(handleCreateApice(ctx, VALID, susi))).toBe('account-suspended');
  });

  it('RF-6 (001): un payload mal formado se rechaza', async () => {
    expect(await codeOf(handleCreateApice(ctx, { ...VALID, axes: 'agua' }, ana))).toBe('invalid-request');
    expect(await codeOf(handleCreateApice(ctx, { ...VALID, name: 7 }, ana))).toBe('invalid-request');
  });
});

/** Siembra el contador diario de la persona en `count` (ventana abierta ahora) para no repetir decenas de llamadas. */
const seedDaily = (kind: string, uid: string, count: number) =>
  ctx.db.doc(`rateLimits/daily-${kind}-${uid}`).set({ count, windowStart: ctx.now(), expiresAt: new Date(ctx.now().getTime() + 24 * 3600 * 1000) });

describe('createApice · cuota diaria', () => {
  it('RF-7 (016) · 7.1: el ápice 11 en 24 horas se rechaza con rate-limited y no escribe; otra persona no se ve afectada', async () => {
    const beto = (await seedAccount(ctx, { username: 'beto' })).uid;
    for (let i = 0; i < 10; i += 1) await handleCreateApice(ctx, VALID, ana);
    expect(await codeOf(handleCreateApice(ctx, VALID, ana))).toBe('rate-limited');
    expect((await ctx.db.collection('apices').get()).size).toBe(10);
    await handleCreateApice(ctx, VALID, beto);
    expect((await ctx.db.collection('apices').get()).size).toBe(11);
  });

  it('RF-7 (016) · 7.1: un ápice inválido no gasta cupo', async () => {
    await seedDaily('apice', ana, 9);
    expect(await codeOf(handleCreateApice(ctx, { ...VALID, name: '  ' }, ana))).toBe('field-required');
    expect((await ctx.db.doc(`rateLimits/daily-apice-${ana}`).get()).get('count')).toBe(9);
    await handleCreateApice(ctx, VALID, ana);
    expect(await codeOf(handleCreateApice(ctx, VALID, ana))).toBe('rate-limited');
  });
});
