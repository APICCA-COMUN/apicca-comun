// T-16 (021): el recálculo de las zonas de los ápices que ya tenían ubicación, contra los emuladores (RF-5 (021) · 5.4,
// RF-5 (021) · 5.5, D-T15 (021)).
import { beforeEach, describe, expect, it } from 'vitest';
import { handleCreateApice } from '../src/ops/createApice';
import { handleEditApice } from '../src/ops/editApice';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../src/testing';
import { VALID } from '../src/testing/apiceKit';
import { recalculateZones } from './recalculate-zones';

const EXACT = { lat: 4.3567891, lng: -74.1234567 };
const CELL = { cell: '8766e08e4ffffff', lat: 4.367389, lng: -74.124852 };
/** Lo que publicaba la cuadrícula de 0,01° (RF-9 (001)) para EXACT. */
const BEFORE = { lat: 4.355, lng: -74.125, precision: 'approximate' };

let ctx: TestCtx;
let ana: string;

const create = async (location?: Record<string, unknown>): Promise<string> =>
  ((await handleCreateApice(ctx, { ...VALID, ...(location === undefined ? {} : { location }) }, ana)) as { id: string }).id;
const apice = async (id: string) => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const version = async (id: string, n: number) => (await ctx.db.doc(`apices/${id}/versions/${n}`).get()).data() as Record<string, unknown>;

/** Deja el ápice como estaba antes de la zona H3: la ubicación de la cuadrícula, en el ápice y en sus versiones. */
async function asBefore(id: string, location: Record<string, unknown> = BEFORE): Promise<void> {
  await ctx.db.doc(`apices/${id}`).update({ location });
  for (const doc of (await ctx.db.collection(`apices/${id}/versions`).get()).docs) await doc.ref.update({ location });
}

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('recalculate-zones', () => {
  it('RF-5 (021) · 5.4: calcula la zona de un ápice aproximado desde su punto guardado, sin pedirle nada a su autora', async () => {
    const id = await create({ mode: 'set', ...EXACT });
    await asBefore(id);
    const report = await recalculateZones(ctx, { dryRun: false });
    expect(report).toEqual({ located: 1, changed: 1, unchanged: 0, missing: [] });
    expect((await apice(id))['location']).toEqual({ lat: CELL.lat, lng: CELL.lng, precision: 'approximate', zone: CELL });
    expect(JSON.stringify(await apice(id))).not.toContain(String(EXACT.lat));
  });

  it('RF-5 (021) · 5.4: un ápice exacto conserva su punto y suma su zona', async () => {
    const id = await create({ mode: 'set', ...EXACT, precision: 'exact' });
    await asBefore(id, { ...EXACT, precision: 'exact' });
    await recalculateZones(ctx, { dryRun: false });
    expect((await apice(id))['location']).toEqual({ ...EXACT, precision: 'exact', zone: CELL });
  });

  it('RF-5 (021) · 5.5: no crea versión ni cambia las anteriores, que conservan la ubicación que mostraban', async () => {
    const id = await create({ mode: 'set', ...EXACT });
    await handleEditApice(ctx, { id, baseVersion: 1, content: { ...VALID, status: 'idea', name: 'Segundo nombre' } }, ana);
    await asBefore(id);
    const before = await apice(id);
    ctx.setNow(new Date('2026-10-01T10:00:00Z'));
    await recalculateZones(ctx, { dryRun: false });
    const after = await apice(id);
    expect(after['version']).toBe(2);
    expect(after['updatedAt']).toEqual(before['updatedAt']);
    expect(after['lastEditedByUsername']).toBe(before['lastEditedByUsername']);
    expect({ ...after, location: null }).toEqual({ ...before, location: null });
    expect((await ctx.db.collection(`apices/${id}/versions`).get()).size).toBe(2);
    expect((await version(id, 1))['location']).toEqual(BEFORE);
    expect((await version(id, 2))['location']).toEqual(BEFORE);
  });

  it('RF-5 (021) · 5.4: sin `--apply` solo cuenta lo que cambiaría', async () => {
    const id = await create({ mode: 'set', ...EXACT });
    await asBefore(id);
    expect(await recalculateZones(ctx, { dryRun: true })).toEqual({ located: 1, changed: 1, unchanged: 0, missing: [] });
    expect((await apice(id))['location']).toEqual(BEFORE);
  });

  it('RF-5 (021) · 5.4: repetirlo no cambia nada, y un ápice sin ubicación no se toca', async () => {
    const located = await create({ mode: 'set', ...EXACT });
    const bare = await create();
    await asBefore(located);
    await recalculateZones(ctx, { dryRun: false });
    expect(await recalculateZones(ctx, { dryRun: false })).toEqual({ located: 1, changed: 0, unchanged: 1, missing: [] });
    expect((await apice(bare))['location']).toBeNull();
  });

  it('RF-5 (021) · 5.4: un ápice con ubicación y sin punto guardado se informa y se deja como está', async () => {
    const id = await create({ mode: 'set', ...EXACT });
    await asBefore(id);
    await ctx.db.doc(`apices/${id}/versions/1/private/exact`).delete();
    expect(await recalculateZones(ctx, { dryRun: false })).toEqual({ located: 1, changed: 0, unchanged: 0, missing: [id] });
    expect((await apice(id))['location']).toEqual(BEFORE);
  });
});
