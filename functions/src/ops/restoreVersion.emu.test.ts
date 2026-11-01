// T-2.15: restaurar una versión anterior como versión nueva (RF-12 (001), RF-14 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { handleCreateApice } from './createApice';
import { handleEditApice } from './editApice';
import { handleRestoreVersion } from './restoreVersion';

let ctx: TestCtx;
let ana: string;
let beto: string;
let id: string;

const edit = (uid: string, baseVersion: number, name: string) =>
  handleEditApice(ctx, { id, baseVersion, content: { ...VALID, status: 'idea', name } }, uid);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  id = ((await handleCreateApice(ctx, { ...VALID, name: 'Primera' }, ana)) as { id: string }).id;
  await edit(beto, 1, 'Segunda');
  await edit(ana, 2, 'Tercera');
});

describe('restoreVersion', () => {
  it('RF-12 (001): restaura la versión 1 sobre la 3 y obtiene la 4 sin borrar ninguna', async () => {
    expect(await handleRestoreVersion(ctx, { id, n: 1, baseVersion: 3 }, beto)).toEqual({ ok: true, version: 4 });
    expect((await ctx.db.doc(`apices/${id}`).get()).data()).toMatchObject({ name: 'Primera', version: 4, lastEditedByUsername: 'beto' });
    expect((await ctx.db.doc(`apices/${id}/versions/4`).get()).data()).toMatchObject({ kind: 'restore', restoredFromN: 1, n: 4 });
    expect((await ctx.db.collection(`apices/${id}/versions`).get()).size).toBe(4);
    expect((await ctx.db.doc(`apices/${id}/versions/3`).get()).get('content.name')).toBe('Tercera');
  });

  it('RF-11 (001): con una base vieja devuelve el conflicto y no escribe', async () => {
    const result = await handleRestoreVersion(ctx, { id, n: 1, baseVersion: 2 }, beto);
    expect(result).toMatchObject({ ok: false, conflict: true, current: { version: 3, content: { name: 'Tercera' } } });
    expect((await ctx.db.doc(`apices/${id}`).get()).get('version')).toBe(3);
  });

  it('RF-14 (001): en un ápice archivado se rechaza', async () => {
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    expect(await codeOf(handleRestoreVersion(ctx, { id, n: 1, baseVersion: 3 }, beto))).toBe('apice-archived');
  });

  it('RF-12 (001): una versión inexistente, sin sesión o con cuenta suspendida se rechaza', async () => {
    const susi = (await seedAccount(ctx, { username: 'susi', status: 'suspended' })).uid;
    expect(await codeOf(handleRestoreVersion(ctx, { id, n: 9, baseVersion: 3 }, beto))).toBe('invalid-request');
    expect(await codeOf(handleRestoreVersion(ctx, { id, n: 1, baseVersion: 3 }, null))).toBe('unauthenticated');
    expect(await codeOf(handleRestoreVersion(ctx, { id, n: 1, baseVersion: 3 }, susi))).toBe('account-suspended');
  });
});
