// T-4.3 a T-4.4: la ubicación de un ápice al crear, editar y restaurar (RF-9 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { handleCreateApice } from './createApice';
import { handleEditApice } from './editApice';
import { handleRestoreVersion } from './restoreVersion';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;
let id: string;

const EXACT = { lat: 4.3567891, lng: -74.1234567 };
const ZONE = { lat: 4.355, lng: -74.125 };

const create = (location?: unknown) => handleCreateApice(ctx, { ...VALID, ...(location === undefined ? {} : { location }) }, ana);
const edit = (uid: string, baseVersion: number, location?: unknown, patch: Record<string, unknown> = {}) =>
  handleEditApice(
    ctx,
    { id, baseVersion, content: { ...VALID, status: 'idea', ...patch, ...(location === undefined ? {} : { location }) } },
    uid,
  );
const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const version = async (n: number) => (await ctx.db.doc(`apices/${id}/versions/${n}`).get()).data() as Record<string, unknown>;
const exactOf = async (n: number) => (await ctx.db.doc(`apices/${id}/versions/${n}/private/exact`).get()).data();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
});

describe('createApice con ubicación', () => {
  it('RF-9 (001): sin ubicación el ápice y su versión la guardan en null y no hay punto exacto', async () => {
    id = ((await create()) as { id: string }).id;
    expect((await apice())['location']).toBeNull();
    expect((await version(1))['location']).toBeNull();
    expect(await exactOf(1)).toBeUndefined();
  });

  it('RF-9 (001): por defecto es aproximada; ni el ápice ni la versión contienen el punto exacto y private/exact sí', async () => {
    id = ((await create({ mode: 'set', ...EXACT })) as { id: string }).id;
    const expected = { ...ZONE, precision: 'approximate' };
    expect((await apice())['location']).toEqual(expected);
    expect((await version(1))['location']).toEqual(expected);
    for (const doc of [await apice(), await version(1)]) {
      const text = JSON.stringify(doc);
      expect(text).not.toContain('4.3567891');
      expect(text).not.toContain('74.1234567');
    }
    expect(await exactOf(1)).toEqual(EXACT);
  });

  it('RF-9 (001): con precisión exacta la ubicación de pantalla es el punto', async () => {
    id = ((await create({ mode: 'set', ...EXACT, precision: 'exact' })) as { id: string }).id;
    expect((await apice())['location']).toEqual({ ...EXACT, precision: 'exact' });
    expect(await exactOf(1)).toEqual(EXACT);
  });

  it('RF-9 (001): coordenadas fuera de rango o precisión desconocida se rechazan sin crear nada', async () => {
    expect(await codeOf(create({ mode: 'set', lat: 91, lng: 0 }))).toBe('coordinates-invalid');
    expect(await codeOf(create({ mode: 'set', lat: 'x', lng: 0 }))).toBe('coordinates-invalid');
    expect(await codeOf(create({ mode: 'set', ...EXACT, precision: 'casi' }))).toBe('invalid-request');
    expect(await codeOf(create({ mode: 'keep' }))).toBe('invalid-request');
    expect((await ctx.db.collection('apices').get()).size).toBe(0);
  });
});

describe('hasLocation en el ápice', () => {
  const flag = async () => (await apice())['hasLocation'];

  it('RF-21 (001): hasLocation acompaña a la ubicación al crear, ubicar, quitar y restaurar', async () => {
    id = ((await create()) as { id: string }).id;
    expect(await flag()).toBe(false);
    await edit(ana, 1, { mode: 'set', ...EXACT });
    expect(await flag()).toBe(true);
    await edit(ana, 2, { mode: 'remove' });
    expect(await flag()).toBe(false);
    await handleRestoreVersion(ctx, { id, n: 2, baseVersion: 3 }, ana);
    expect(await flag()).toBe(true);
    id = ((await create({ mode: 'set', ...EXACT })) as { id: string }).id;
    expect(await flag()).toBe(true);
  });
});

describe('editApice con ubicación', () => {
  beforeEach(async () => {
    id = ((await create()) as { id: string }).id;
  });

  it('RF-9 (001): indicar una ubicación crea versión nueva con su zona y su punto exacto', async () => {
    expect(await edit(ana, 1, { mode: 'set', ...EXACT })).toEqual({ ok: true, version: 2 });
    expect((await apice())['location']).toEqual({ ...ZONE, precision: 'approximate' });
    expect((await version(2))['location']).toEqual({ ...ZONE, precision: 'approximate' });
    expect(await exactOf(2)).toEqual(EXACT);
    expect(await exactOf(1)).toBeUndefined();
    expect(JSON.stringify(await version(2))).not.toContain('4.3567891');
  });

  it('RF-9 (001): cambiar el punto es versión nueva; la versión anterior conserva el suyo', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    const other = { lat: -12.0464, lng: -77.0428 };
    expect(await edit(ana, 2, { mode: 'set', ...other })).toEqual({ ok: true, version: 3 });
    expect(await exactOf(3)).toEqual(other);
    expect(await exactOf(2)).toEqual(EXACT);
  });

  it('RF-9 (001): quitar la ubicación deja el ápice sin ubicación, sin punto en la versión nueva, y repetirlo no crea versión', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    expect(await edit(ana, 2, { mode: 'remove' })).toEqual({ ok: true, version: 3 });
    expect((await apice())['location']).toBeNull();
    expect((await version(3))['location']).toBeNull();
    expect(await exactOf(3)).toBeUndefined();
    expect(await edit(ana, 3, { mode: 'remove' })).toEqual({ ok: true, version: 3 });
  });

  it('RF-9 (001): omitir la ubicación o pedir conservarla la deja intacta, con su punto exacto en la versión nueva', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    expect(await edit(ana, 2, undefined, { name: 'Otro nombre' })).toEqual({ ok: true, version: 3 });
    expect(await exactOf(3)).toEqual(EXACT);
    expect(await edit(ana, 3, { mode: 'keep' }, { name: 'Y otro' })).toEqual({ ok: true, version: 4 });
    expect(await exactOf(4)).toEqual(EXACT);
    expect((await apice())['location']).toEqual({ ...ZONE, precision: 'approximate' });
  });

  it('RF-9 (001): otra persona edita el contenido y deja el punto exacto intacto sin recibirlo', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    const result = await edit(beto, 2, { mode: 'keep' }, { description: 'Cambio de Beto' });
    expect(result).toEqual({ ok: true, version: 3 });
    expect(JSON.stringify(result)).not.toContain('4.3567891');
    expect(await exactOf(3)).toEqual(EXACT);
    expect((await apice())['location']).toEqual({ ...ZONE, precision: 'approximate' });
  });

  it('RF-9 (001): el conflicto no devuelve el punto exacto', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    const conflict = await edit(beto, 1, { mode: 'keep' }, { name: 'Tarde' });
    expect(conflict).toMatchObject({ ok: false, conflict: true });
    expect(JSON.stringify(conflict)).not.toContain('4.3567891');
  });

  it('RF-9 (001): cambiar la precisión es una versión nueva que usa el punto guardado', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    expect(await edit(ana, 2, { mode: 'precision', precision: 'exact' })).toEqual({ ok: true, version: 3 });
    expect((await apice())['location']).toEqual({ ...EXACT, precision: 'exact' });
    expect(await exactOf(3)).toEqual(EXACT);
    expect(await edit(ana, 3, { mode: 'precision', precision: 'approximate' })).toEqual({ ok: true, version: 4 });
    expect((await apice())['location']).toEqual({ ...ZONE, precision: 'approximate' });
    expect((await version(3))['location']).toEqual({ ...EXACT, precision: 'exact' });
  });

  it('RF-9 (001): pedir la precisión que ya tiene no crea versión', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    expect(await edit(ana, 2, { mode: 'precision', precision: 'approximate' })).toEqual({ ok: true, version: 2 });
  });

  it('RF-9 (001): cualquier persona inscrita cambia la precisión sin recibir el punto exacto', async () => {
    await edit(ana, 1, { mode: 'set', ...EXACT });
    const result = await edit(beto, 2, { mode: 'precision', precision: 'exact' });
    expect(result).toEqual({ ok: true, version: 3 });
    expect(JSON.stringify(result)).not.toContain(String(EXACT.lat));
    expect((await apice())['location']).toEqual({ ...EXACT, precision: 'exact' });
    expect(await exactOf(3)).toEqual(EXACT);
    expect(await edit(fabi, 3, { mode: 'precision', precision: 'approximate' })).toEqual({ ok: true, version: 4 });
  });

  it('RF-9 (001): cambiar la precisión de un ápice sin ubicación o con una forma inválida se rechaza', async () => {
    expect(await codeOf(edit(ana, 1, { mode: 'precision', precision: 'exact' }))).toBe('invalid-request');
    await edit(ana, 1, { mode: 'set', ...EXACT });
    expect(await codeOf(edit(ana, 2, { mode: 'precision', precision: 'x' }))).toBe('invalid-request');
    expect(await codeOf(edit(ana, 2, { mode: 'otro' }))).toBe('invalid-request');
    expect(await codeOf(edit(ana, 2, { mode: 'set', lat: 0, lng: 181 }))).toBe('coordinates-invalid');
    expect((await apice())['version']).toBe(2);
  });
});

describe('restoreVersion con ubicación', () => {
  it('RF-9 (001): restaurar una versión devuelve su ubicación y copia su punto exacto', async () => {
    id = ((await create({ mode: 'set', ...EXACT })) as { id: string }).id;
    await edit(ana, 1, { mode: 'remove' });
    expect((await apice())['location']).toBeNull();
    expect(await handleRestoreVersion(ctx, { id, n: 1, baseVersion: 2 }, beto)).toEqual({ ok: true, version: 3 });
    expect((await apice())['location']).toEqual({ ...ZONE, precision: 'approximate' });
    expect((await version(3))['location']).toEqual({ ...ZONE, precision: 'approximate' });
    expect(await exactOf(3)).toEqual(EXACT);
  });

  it('RF-9 (001): restaurar una versión sin ubicación quita la ubicación vigente', async () => {
    id = ((await create()) as { id: string }).id;
    await edit(ana, 1, { mode: 'set', ...EXACT });
    expect(await handleRestoreVersion(ctx, { id, n: 1, baseVersion: 2 }, ana)).toEqual({ ok: true, version: 3 });
    expect((await apice())['location']).toBeNull();
    expect(await exactOf(3)).toBeUndefined();
  });
});
