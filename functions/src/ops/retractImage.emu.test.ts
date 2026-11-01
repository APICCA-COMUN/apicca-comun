// T-5.12: un facilitador retira una referencia con motivo (RF-16 (001), D-T19 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { clearBucket, listPaths, seedReference } from '../testing/mediaKit';
import { handleCreateApice } from './createApice';
import { handleRetractImage } from './retractImage';

let ctx: TestCtx;
let ana: string;
let fabi: string;
let id: string;

const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const reference = async (refId: string) => (await ctx.db.doc(`apices/${id}/references/${refId}`).get()).data() as Record<string, unknown>;
const events = async () => (await ctx.db.collection(`apices/${id}/events`).orderBy('at').get()).docs.map((d) => d.data());

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
  await ctx.db.doc(`apices/${id}`).update({ image: { id: 'img1', altText: 'Una huerta', png: 'x' } });
  await seedReference(ctx, id, 'r1', { uploader: { uid: ana, username: 'ana' } });
});

describe('retractImage · referencias', () => {
  it('RF-16 (001): una facilitadora retira una referencia de un ápice archivado, con quién, cuándo y motivo', async () => {
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    ctx.setNow(new Date('2026-09-04T10:00:00Z'));
    expect(await handleRetractImage(ctx, { id, refId: 'r1', reason: '  Muestra a una persona sin permiso  ' }, fabi)).toEqual({});

    const data = await reference('r1');
    expect(data['isRemoved']).toBe(true);
    expect(data['removal']).toMatchObject({ kind: 'retracted', byUsername: 'fabi', reason: 'Muestra a una persona sin permiso' });
    expect(((data['removal'] as { at: { toDate(): Date } }).at).toDate().toISOString()).toBe('2026-09-04T10:00:00.000Z');
    expect(await listPaths(ctx, `apices/${id}/references/`)).toEqual([`apices/${id}/references/r1`]);
    expect((await apice())['activeReferenceCount']).toBe(0);
    expect(await events()).toEqual([
      expect.objectContaining({
        type: 'reference-retracted',
        byUid: fabi,
        byUsername: 'fabi',
        detail: { refId: 'r1', reason: 'Muestra a una persona sin permiso' },
      }),
    ]);
  });

  it('RF-16 (001): también retira en un ápice no archivado y no cambia las imágenes aceptadas', async () => {
    const before = (await apice())['image'];
    await handleRetractImage(ctx, { id, refId: 'r1', reason: 'Motivo' }, fabi);
    expect((await reference('r1'))['isRemoved']).toBe(true);
    expect((await apice())['image']).toEqual(before);
  });

  it('RF-16 (001): sin motivo, o con motivo de espacios, se rechaza', async () => {
    expect(await codeOf(handleRetractImage(ctx, { id, refId: 'r1' }, fabi))).toBe('reason-required');
    expect(await codeOf(handleRetractImage(ctx, { id, refId: 'r1', reason: '   ' }, fabi))).toBe('reason-required');
    expect((await reference('r1'))['isRemoved']).toBe(false);
    expect(await events()).toHaveLength(0);
  });

  it('RF-16 (001): quien no facilita —ni siquiera la autora—, sin sesión o suspendida recibe error', async () => {
    expect(await codeOf(handleRetractImage(ctx, { id, refId: 'r1', reason: 'Motivo' }, ana))).toBe('forbidden');
    expect(await codeOf(handleRetractImage(ctx, { id, refId: 'r1', reason: 'Motivo' }, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${fabi}`).update({ status: 'suspended' });
    expect(await codeOf(handleRetractImage(ctx, { id, refId: 'r1', reason: 'Motivo' }, fabi))).toBe('account-suspended');
    expect((await reference('r1'))['isRemoved']).toBe(false);
    expect(await events()).toHaveLength(0);
  });

  it('RF-16 (001): una referencia o un ápice inexistentes se rechazan', async () => {
    expect(await codeOf(handleRetractImage(ctx, { id, refId: 'no-existe', reason: 'Motivo' }, fabi))).toBe('reference-not-found');
    expect(await codeOf(handleRetractImage(ctx, { id: 'no-existe', refId: 'r1', reason: 'Motivo' }, fabi))).toBe('invalid-request');
  });

  it('RF-16 (001): retirar una ya quitada la marca como retirada con motivo sin descontar dos veces', async () => {
    await seedReference(ctx, id, 'r2', { removal: { kind: 'removed', byUsername: 'beto', at: ctx.now(), reason: null } });
    expect((await apice())['activeReferenceCount']).toBe(1);
    await handleRetractImage(ctx, { id, refId: 'r2', reason: 'Motivo' }, fabi);
    expect((await reference('r2'))['removal']).toMatchObject({ kind: 'retracted', byUsername: 'fabi', reason: 'Motivo' });
    expect((await apice())['activeReferenceCount']).toBe(1);
  });

  it('RF-16 (001): retirar una ya retirada no repite el evento', async () => {
    await handleRetractImage(ctx, { id, refId: 'r1', reason: 'Motivo' }, fabi);
    await handleRetractImage(ctx, { id, refId: 'r1', reason: 'Otro' }, fabi);
    expect(await events()).toHaveLength(1);
    expect(((await reference('r1'))['removal'] as { reason: string }).reason).toBe('Motivo');
  });
});

describe('retractImage · imagen del ápice', () => {
  const imagePng = Buffer.from([9, 9, 9]);

  async function seedImages(): Promise<void> {
    await ctx.db.doc(`apices/${id}/images/img0`).set({
      png: imagePng, altText: 'Primera', acceptedByUsername: 'ana', acceptedAt: new Date('2026-08-01T00:00:00Z'),
      replacedAt: new Date('2026-08-15T00:00:00Z'), isRemoved: false, removal: null,
    });
    await ctx.db.doc(`apices/${id}/images/img1`).set({
      png: imagePng, altText: 'Una huerta', acceptedByUsername: 'ana', acceptedAt: new Date('2026-08-15T00:00:00Z'),
      replacedAt: null, isRemoved: false, removal: null,
    });
  }

  it('RF-16 (001): una facilitadora retira la imagen actual con motivo: el ápice queda sin imagen y las anteriores se conservan', async () => {
    await seedImages();
    ctx.setNow(new Date('2026-09-03T10:00:00Z'));
    expect(await handleRetractImage(ctx, { id, imageId: 'img1', reason: ' Muestra a una persona ' }, fabi)).toEqual({});

    expect((await apice())['image']).toBeNull();
    const retired = (await ctx.db.doc(`apices/${id}/images/img1`).get()).data();
    expect(retired).toMatchObject({ isRemoved: true, removal: { kind: 'retracted', byUsername: 'fabi', reason: 'Muestra a una persona' } });
    expect((await ctx.db.doc(`apices/${id}/images/img0`).get()).data()).toMatchObject({ isRemoved: false, altText: 'Primera' });
    expect((await ctx.db.collection(`apices/${id}/images`).get()).size).toBe(2);
    expect(await events()).toEqual([
      expect.objectContaining({ type: 'image-retracted', byUsername: 'fabi', detail: { imageId: 'img1', reason: 'Muestra a una persona' } }),
    ]);
  });

  it('RF-16 (001): retira también en un ápice archivado, y una imagen anterior no toca la actual', async () => {
    await seedImages();
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    await handleRetractImage(ctx, { id, imageId: 'img0', reason: 'Motivo' }, fabi);
    expect(((await apice())['image'] as { id: string }).id).toBe('img1');
    expect((await ctx.db.doc(`apices/${id}/images/img0`).get()).data()?.['isRemoved']).toBe(true);
  });

  it('RF-16 (001): exige motivo, facilitación y una imagen existente; repetirlo no duplica el evento', async () => {
    await seedImages();
    expect(await codeOf(handleRetractImage(ctx, { id, imageId: 'img1' }, fabi))).toBe('reason-required');
    expect(await codeOf(handleRetractImage(ctx, { id, imageId: 'img1', reason: 'Motivo' }, ana))).toBe('forbidden');
    expect(await codeOf(handleRetractImage(ctx, { id, imageId: 'no-existe', reason: 'Motivo' }, fabi))).toBe('image-missing');
    expect(await codeOf(handleRetractImage(ctx, { id, imageId: 'img1', refId: 'r1', reason: 'Motivo' }, fabi))).toBe('invalid-request');
    await handleRetractImage(ctx, { id, imageId: 'img1', reason: 'Motivo' }, fabi);
    await handleRetractImage(ctx, { id, imageId: 'img1', reason: 'Motivo' }, fabi);
    expect(await events()).toHaveLength(1);
  });
});
