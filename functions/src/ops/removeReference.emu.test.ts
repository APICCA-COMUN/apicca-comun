// T-5.11: quitar una referencia sin borrarla (RF-16 (001), RF-14 (001), RNF-6 (001), D-T19 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { clearBucket, listPaths, seedReference } from '../testing/mediaKit';
import { handleCreateApice } from './createApice';
import { handleRemoveReference } from './removeReference';

let ctx: TestCtx;
let ana: string;
let beto: string;
let id: string;

const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const reference = async (refId: string) => (await ctx.db.doc(`apices/${id}/references/${refId}`).get()).data() as Record<string, unknown>;
const events = async () => (await ctx.db.collection(`apices/${id}/events`).orderBy('at').get()).docs.map((d) => d.data());

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
  await ctx.db.doc(`apices/${id}`).update({ image: { id: 'img1', altText: 'Una huerta', png: 'x' } });
  await seedReference(ctx, id, 'r1', { uploader: { uid: ana, username: 'ana' } });
  await seedReference(ctx, id, 'r2', { uploader: { uid: ana, username: 'ana' } });
});

describe('removeReference', () => {
  it('RF-16 (001): una persona inscrita quita una referencia ajena: se oculta, se conserva y queda quién y cuándo', async () => {
    ctx.setNow(new Date('2026-09-02T09:30:00Z'));
    expect(await handleRemoveReference(ctx, { id, refId: 'r1' }, beto)).toEqual({});

    const data = await reference('r1');
    expect(data).toMatchObject({ isRemoved: true, altText: 'Referencia r1' });
    expect(data['removal']).toMatchObject({ kind: 'removed', byUsername: 'beto', reason: null });
    expect(((data['removal'] as { at: { toDate(): Date } }).at).toDate().toISOString()).toBe('2026-09-02T09:30:00.000Z');
    // El archivo sigue: quitar no es borrar (RNF-7 (001)).
    expect(await listPaths(ctx, `apices/${id}/references/`)).toEqual([`apices/${id}/references/r1`, `apices/${id}/references/r2`]);
    expect((await apice())['activeReferenceCount']).toBe(1);
    expect((await reference('r2'))['isRemoved']).toBe(false);
    expect(await events()).toEqual([expect.objectContaining({ type: 'reference-removed', byUid: beto, byUsername: 'beto', detail: { refId: 'r1' } })]);
  });

  it('RF-16 (001): la autora de la referencia también puede quitarla', async () => {
    await handleRemoveReference(ctx, { id, refId: 'r2' }, ana);
    expect((await reference('r2'))['isRemoved']).toBe(true);
  });

  it('RF-16 (001): quitar no cambia las imágenes ya aceptadas del ápice', async () => {
    const before = (await apice())['image'];
    await handleRemoveReference(ctx, { id, refId: 'r1' }, beto);
    expect((await apice())['image']).toEqual(before);
  });

  it('RF-16 (001): quitar una ya quitada no repite el evento ni descuenta dos veces', async () => {
    await handleRemoveReference(ctx, { id, refId: 'r1' }, beto);
    await handleRemoveReference(ctx, { id, refId: 'r1' }, ana);
    expect(await events()).toHaveLength(1);
    expect((await apice())['activeReferenceCount']).toBe(1);
    expect(((await reference('r1'))['removal'] as { byUsername: string }).byUsername).toBe('beto');
  });

  it('RF-14 (001): en un ápice archivado se rechaza y no cambia nada', async () => {
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    expect(await codeOf(handleRemoveReference(ctx, { id, refId: 'r1' }, ana))).toBe('apice-archived');
    expect((await reference('r1'))['isRemoved']).toBe(false);
    expect((await apice())['activeReferenceCount']).toBe(2);
    expect(await events()).toHaveLength(0);
  });

  it('RF-16 (001): sin sesión, con cuenta suspendida, referencia o ápice inexistentes se rechaza', async () => {
    expect(await codeOf(handleRemoveReference(ctx, { id, refId: 'r1' }, null))).toBe('unauthenticated');
    expect(await codeOf(handleRemoveReference(ctx, { id, refId: 'no-existe' }, ana))).toBe('reference-not-found');
    expect(await codeOf(handleRemoveReference(ctx, { id: 'no-existe', refId: 'r1' }, ana))).toBe('invalid-request');
    expect(await codeOf(handleRemoveReference(ctx, { id, refId: '../r1' }, ana))).toBe('invalid-request');
    await ctx.db.doc(`accounts/${beto}`).update({ status: 'suspended' });
    expect(await codeOf(handleRemoveReference(ctx, { id, refId: 'r1' }, beto))).toBe('account-suspended');
    expect((await reference('r1'))['isRemoved']).toBe(false);
  });
});
