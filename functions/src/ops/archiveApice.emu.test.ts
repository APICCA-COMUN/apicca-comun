// T-3.6 y T-3.7: archivar y restaurar un ápice (RF-14 (001), RNF-6 (001), RNF-7 (001), D-T19 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { handleArchiveApice } from './archiveApice';
import { handleCreateApice } from './createApice';
import { handleEditApice } from './editApice';
import { handleRestoreApice } from './restoreApice';
import { handleRestoreVersion } from './restoreVersion';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;
let id: string;

const doc = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const events = async () =>
  (await ctx.db.collection(`apices/${id}/events`).orderBy('at').get()).docs.map((d) => d.data());

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
  await ctx.db.doc(`apices/${id}`).update({ image: { id: 'img1', altText: 'Una huerta', png: 'x' } });
});

describe('archiveApice', () => {
  it('RF-14 (001): la autora lo archiva sin destruir contenido, versiones ni imagen, y queda quién y cuándo', async () => {
    ctx.setNow(new Date('2026-09-03T08:00:00Z'));
    expect(await handleArchiveApice(ctx, { id }, ana)).toEqual({});
    const data = await doc();
    expect(data).toMatchObject({ isArchived: true, name: VALID.name, description: VALID.description, version: 1 });
    expect(data['image']).toMatchObject({ id: 'img1' });
    expect(data['archive']).toMatchObject({ byUsername: 'ana' });
    expect(((data['archive'] as { at: { toDate(): Date } }).at).toDate().toISOString()).toBe('2026-09-03T08:00:00.000Z');
    expect((await ctx.db.collection(`apices/${id}/versions`).get()).size).toBe(1);
    expect((await events())[0]).toMatchObject({ type: 'archive', byUid: ana, byUsername: 'ana' });
  });

  it('RF-14 (001): una facilitadora archiva un ápice ajeno', async () => {
    await handleArchiveApice(ctx, { id }, fabi);
    expect((await doc())['isArchived']).toBe(true);
  });

  it('RF-14 (001): otra persona inscrita o una cuenta suspendida reciben error y no cambia nada', async () => {
    expect(await codeOf(handleArchiveApice(ctx, { id }, beto))).toBe('forbidden');
    expect(await codeOf(handleArchiveApice(ctx, { id }, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${fabi}`).update({ status: 'suspended' });
    expect(await codeOf(handleArchiveApice(ctx, { id }, fabi))).toBe('account-suspended');
    expect((await doc())['isArchived']).toBe(false);
    expect(await events()).toHaveLength(0);
  });

  it('RF-14 (001): archivar uno ya archivado no repite el evento', async () => {
    await handleArchiveApice(ctx, { id }, ana);
    await handleArchiveApice(ctx, { id }, ana);
    expect(await events()).toHaveLength(1);
  });

  it('RF-14 (001): un ápice inexistente se rechaza', async () => {
    expect(await codeOf(handleArchiveApice(ctx, { id: 'no-existe' }, ana))).toBe('invalid-request');
  });
});

describe('restoreApice', () => {
  beforeEach(async () => {
    await handleArchiveApice(ctx, { id }, ana);
  });

  it('RF-14 (001): vuelve a mostrarlo según su visibilidad y deja el evento', async () => {
    ctx.setNow(new Date('2026-09-04T08:00:00Z'));
    expect(await handleRestoreApice(ctx, { id }, fabi)).toEqual({});
    const data = await doc();
    expect(data).toMatchObject({ isArchived: false, archive: null, visibility: 'private' });
    expect((await events()).map((e) => e['type'])).toEqual(['archive', 'restore']);
  });

  it('RF-14 (001): otra persona inscrita no lo restaura', async () => {
    expect(await codeOf(handleRestoreApice(ctx, { id }, beto))).toBe('forbidden');
    expect((await doc())['isArchived']).toBe(true);
  });

  it('RF-14 (001): restaurar uno que no está archivado no escribe evento', async () => {
    await handleRestoreApice(ctx, { id }, ana);
    await handleRestoreApice(ctx, { id }, ana);
    expect((await events()).filter((e) => e['type'] === 'restore')).toHaveLength(1);
  });

  it('RF-14 (001): mientras está archivado se rechazan editar y restaurar una versión, y tras restaurar se permiten', async () => {
    const content = { ...VALID, status: 'idea', name: 'Otro nombre' };
    expect(await codeOf(handleEditApice(ctx, { id, baseVersion: 1, content }, beto))).toBe('apice-archived');
    expect(await codeOf(handleRestoreVersion(ctx, { id, n: 1, baseVersion: 1 }, beto))).toBe('apice-archived');
    await handleRestoreApice(ctx, { id }, ana);
    expect(await handleEditApice(ctx, { id, baseVersion: 1, content }, beto)).toEqual({ ok: true, version: 2 });
  });
});
