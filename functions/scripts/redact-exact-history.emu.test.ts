// RF-2 (016) · 2.2: la limpieza del historial exacto que quedó de antes de `5b05b09`, contra los emuladores.
import { beforeEach, describe, expect, it } from 'vitest';
import { handleCreateApice } from '../src/ops/createApice';
import { handleEditApice } from '../src/ops/editApice';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../src/testing';
import { VALID } from '../src/testing/apiceKit';
import { redactExactHistory } from './redact-exact-history';

const EXACT = { lat: 4.3567891, lng: -74.1234567 };
const CELL = { cell: '8766e08e4ffffff', lat: 4.367389, lng: -74.124852 };
const APPROX = { lat: CELL.lat, lng: CELL.lng, precision: 'approximate', zone: CELL };

let ctx: TestCtx;
let ana: string;

const create = async (location?: Record<string, unknown>): Promise<string> =>
  ((await handleCreateApice(ctx, { ...VALID, ...(location === undefined ? {} : { location }) }, ana)) as { id: string }).id;
const apice = async (id: string) => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const version = async (id: string, n: number) => (await ctx.db.doc(`apices/${id}/versions/${n}`).get()).data() as Record<string, unknown>;
const exactOf = async (id: string, n: number) => (await ctx.db.doc(`apices/${id}/versions/${n}/private/exact`).get()).data();

/**
 * Deja el ápice como lo dejaba `saveVersion` antes de `5b05b09`: la versión 1 exacta y una versión 2 que bajó a aproximada (o
 * quitó la ubicación) sin tocar el historial.
 */
async function lowered(location: Record<string, unknown> | null): Promise<string> {
  const id = await create({ mode: 'set', ...EXACT, precision: 'exact' });
  await handleEditApice(ctx, { id, baseVersion: 1, content: { ...VALID, status: 'idea', name: 'Segundo nombre' } }, ana);
  // La edición de arriba (con `keep`) deja la versión 2 exacta; se reescriben el ápice y la versión 2 como quedaban entonces.
  await ctx.db.doc(`apices/${id}`).update({ location, hasLocation: location !== null });
  await ctx.db.doc(`apices/${id}/versions/2`).update({ location });
  return id;
}

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('redact-exact-history', () => {
  it('RF-2 (016) · 2.2: en un ápice hoy aproximado, redacta a su zona las versiones exactas y conserva el punto privado', async () => {
    const id = await lowered(APPROX);
    const before = await apice(id);
    expect(await redactExactHistory(ctx, { dryRun: false })).toEqual({ scanned: 1, affected: [id], redacted: 1, purged: 0 });
    expect((await version(id, 1))['location']).toEqual(APPROX);
    expect(JSON.stringify(await version(id, 1))).not.toContain(String(EXACT.lat));
    expect((await version(id, 1))['locationPurged']).toBeUndefined();
    expect(await exactOf(id, 1)).toEqual(EXACT);
    // No crea versión ni toca el ápice.
    expect(await apice(id)).toEqual(before);
    expect((await ctx.db.collection(`apices/${id}/versions`).get()).size).toBe(2);
  });

  it('RF-2 (016) · 2.2: sin `--apply` solo cuenta lo que cambiaría', async () => {
    const id = await lowered(APPROX);
    expect(await redactExactHistory(ctx, { dryRun: true })).toEqual({ scanned: 1, affected: [id], redacted: 1, purged: 0 });
    expect((await version(id, 1))['location']).toMatchObject({ ...EXACT, precision: 'exact' });
  });

  it('RF-2 (016) · 2.2: una versión exacta sin zona se purga y pierde su punto privado', async () => {
    const id = await lowered(APPROX);
    await ctx.db.doc(`apices/${id}/versions/1`).update({ location: { ...EXACT, precision: 'exact' } });
    expect(await redactExactHistory(ctx, { dryRun: false })).toEqual({ scanned: 1, affected: [id], redacted: 0, purged: 1 });
    expect((await version(id, 1))['location']).toBeNull();
    expect((await version(id, 1))['locationPurged']).toBe(true);
    expect(await exactOf(id, 1)).toBeUndefined();
  });

  it('RF-2 (016) · 2.2: en un ápice hoy sin ubicación, purga las versiones exactas y borra sus puntos', async () => {
    const id = await lowered(null);
    expect(await redactExactHistory(ctx, { dryRun: false })).toEqual({ scanned: 1, affected: [id], redacted: 0, purged: 1 });
    expect((await version(id, 1))['location']).toBeNull();
    expect((await version(id, 1))['locationPurged']).toBe(true);
    expect(await exactOf(id, 1)).toBeUndefined();
  });

  it('RF-2 (016) · 2.2: un ápice hoy exacto y uno sin ubicación nunca no se tocan', async () => {
    const exact = await create({ mode: 'set', ...EXACT, precision: 'exact' });
    const bare = await create();
    expect(await redactExactHistory(ctx, { dryRun: false })).toEqual({ scanned: 2, affected: [], redacted: 0, purged: 0 });
    expect((await version(exact, 1))['location']).toMatchObject({ ...EXACT, precision: 'exact' });
    expect(await exactOf(exact, 1)).toEqual(EXACT);
    expect((await version(bare, 1))['location']).toBeNull();
  });

  it('RF-2 (016) · 2.2: repetirlo no cambia nada', async () => {
    const id = await lowered(APPROX);
    await redactExactHistory(ctx, { dryRun: false });
    expect(await redactExactHistory(ctx, { dryRun: false })).toEqual({ scanned: 1, affected: [], redacted: 0, purged: 0 });
    expect((await version(id, 1))['location']).toEqual(APPROX);
  });
});
