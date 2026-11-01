// T-5.7 a T-5.9: subir una referencia (RF-15 (001), D-T9 (001), D-T19 (001)).
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { REFERENCE_MAX_BYTES } from '../../../shared/domain/images';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID, withBeforeTransaction } from '../testing/apiceKit';
import { animatedGif, clearBucket, jpegWithGps, listPaths, png, putFile, putUpload, readFile } from '../testing/mediaKit';
import { handleAddReference } from './addReference';
import { handleCreateApice } from './createApice';

let ctx: TestCtx;
let ana: string;
let beto: string;
let id: string;

const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const references = async () => (await ctx.db.collection(`apices/${id}/references`).get()).docs;
const refFiles = () => listPaths(ctx, `apices/${id}/references/`);
const upload = (uid: string, uploadId: string, bytes: Uint8Array) => putUpload(ctx, uid, uploadId, bytes);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
});

describe('addReference · camino feliz (T-5.7)', () => {
  it('RF-15 (001): sube una referencia válida: archivo, documento, texto alternativo y contador', async () => {
    await upload(ana, 'u1', await png(20, 10));
    const result = (await handleAddReference(ctx, { id, uploadId: 'u1', altText: '  Tanque de agua  ' }, ana)) as { refId: string };

    const path = `apices/${id}/references/${result.refId}`;
    expect(await refFiles()).toEqual([path]);
    const stored = await readFile(ctx, path);
    const [file] = await ctx.storage.bucket().file(path).getMetadata();
    expect(file.contentType).toBe('image/png');

    const [doc] = await references();
    expect(doc?.id).toBe(result.refId);
    expect(doc?.data()).toMatchObject({
      path,
      altText: 'Tanque de agua',
      contentType: 'image/png',
      bytes: stored.length,
      width: 20,
      height: 10,
      uploadedByUid: ana,
      uploadedByUsername: 'ana',
      isRemoved: false,
      removal: null,
    });
    expect((doc?.data()?.['uploadedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
    expect((await apice())['activeReferenceCount']).toBe(1);
    // El temporal ya cumplió: no queda en uploads/.
    expect(await listPaths(ctx, 'uploads/')).toEqual([]);
    const events = (await ctx.db.collection(`apices/${id}/events`).get()).docs.map((d) => d.data());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'reference-added', byUid: ana, byUsername: 'ana', detail: { refId: result.refId } });
  });

  it('RF-15 (001): cualquier persona inscrita sube a un ápice ajeno', async () => {
    await upload(beto, 'u1', await png());
    await handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, beto);
    expect((await apice())['activeReferenceCount']).toBe(1);
    expect((await references())[0]?.data()?.['uploadedByUsername']).toBe('beto');
  });

  it('RF-15 (001): el archivo guardado no conserva la geolocalización', async () => {
    await upload(ana, 'u1', await jpegWithGps());
    const { refId } = (await handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Foto' }, ana)) as { refId: string };
    const meta = await sharp(await readFile(ctx, `apices/${id}/references/${refId}`)).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
  });

  it('RF-15 (001): el formato sale del contenido, no del nombre ni del tipo declarado', async () => {
    await putUpload(ctx, ana, 'u1.jpg', await png(), { contentType: 'image/jpeg' });
    const { refId } = (await handleAddReference(ctx, { id, uploadId: 'u1.jpg', altText: 'Foto' }, ana)) as { refId: string };
    expect((await references())[0]?.data()?.['contentType']).toBe('image/png');
    const [file] = await ctx.storage.bucket().file(`apices/${id}/references/${refId}`).getMetadata();
    expect(file.contentType).toBe('image/png');
  });
});

describe('addReference · rechazos (T-5.7)', () => {
  const nothingPlaced = async () => {
    expect(await refFiles()).toEqual([]);
    expect(await references()).toHaveLength(0);
    expect((await apice())['activeReferenceCount']).toBe(0);
  };

  it('RF-15 (001): el texto alternativo vacío o de espacios se rechaza', async () => {
    await upload(ana, 'u1', await png());
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: '   ' }, ana))).toBe('alt-text-required');
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'a'.repeat(201) }, ana))).toBe('alt-text-too-long');
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 7 }, ana))).toBe('invalid-request');
    await nothingPlaced();
  });

  it('RF-14 (001): en un ápice archivado se rechaza', async () => {
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    await upload(ana, 'u1', await png());
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, ana))).toBe('apice-archived');
    await nothingPlaced();
  });

  it('RF-15 (001): un ápice inexistente, sin sesión o con cuenta suspendida se rechaza', async () => {
    await upload(ana, 'u1', await png());
    expect(await codeOf(handleAddReference(ctx, { id: 'no-existe', uploadId: 'u1', altText: 'Mapa' }, ana))).toBe('invalid-request');
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'suspended' });
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, ana))).toBe('account-suspended');
    await nothingPlaced();
  });

  it('RF-15 (001): un temporal que no existe o es de otra persona se rechaza', async () => {
    await upload(ana, 'u1', await png());
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, beto))).toBe('invalid-request');
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'otro', altText: 'Mapa' }, ana))).toBe('invalid-request');
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: '../x', altText: 'Mapa' }, ana))).toBe('invalid-request');
    await nothingPlaced();
  });

  it.each([
    ['un GIF animado', () => animatedGif(), 'image-animated'],
    ['una imagen de 4097 px', () => png(4097, 8), 'image-dimensions-exceeded'],
    ['un archivo de texto con extensión .png', async () => Buffer.from('no soy una imagen'), 'image-unreadable'],
    ['un archivo de 5 MiB + 1 byte', async () => Buffer.alloc(REFERENCE_MAX_BYTES + 1, 1), 'image-too-large'],
  ])('RF-15 (001): %s se rechaza con su razón', async (_name, make, code) => {
    await upload(ana, 'u1', await make());
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, ana))).toBe(code);
    await nothingPlaced();
  });
});

describe('addReference · máximo de cinco (T-5.8)', () => {
  it('RF-15 (001): la sexta se rechaza indicando el máximo y no deja archivo', async () => {
    await ctx.db.doc(`apices/${id}`).update({ activeReferenceCount: 5 });
    await upload(ana, 'u1', await png());
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, ana))).toBe('references-full');
    expect(await refFiles()).toEqual([]);
    expect((await apice())['activeReferenceCount']).toBe(5);
  });

  it('RF-15 (001): la quinta se acepta', async () => {
    await ctx.db.doc(`apices/${id}`).update({ activeReferenceCount: 4 });
    await upload(ana, 'u1', await png());
    await handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, ana);
    expect((await apice())['activeReferenceCount']).toBe(5);
  });

  it('RF-15 (001): si dos suben la quinta a la vez, solo la primera se acepta y el archivo de la otra no queda', async () => {
    await ctx.db.doc(`apices/${id}`).update({ activeReferenceCount: 4 });
    await upload(ana, 'ua', await png(9, 9));
    await upload(beto, 'ub', await png(11, 11));
    const results = await Promise.allSettled([
      handleAddReference(ctx, { id, uploadId: 'ua', altText: 'De ana' }, ana),
      handleAddReference(ctx, { id, uploadId: 'ub', altText: 'De beto' }, beto),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0]?.reason as { code?: string }).code).toBe('references-full');
    expect(await references()).toHaveLength(1);
    expect(await refFiles()).toHaveLength(1);
    expect((await apice())['activeReferenceCount']).toBe(5);
  });
});

describe('addReference · interrupción (T-5.9)', () => {
  it('RF-15 (001): si la transacción falla, no quedan documento ni archivo en references/', async () => {
    await upload(ana, 'u1', await png());
    const broken = withBeforeTransaction(ctx, async () => {
      throw new Error('corte a mitad del proceso');
    });
    await expect(handleAddReference(broken, { id, uploadId: 'u1', altText: 'Mapa' }, ana)).rejects.toThrow('corte');
    expect(await refFiles()).toEqual([]);
    expect(await references()).toHaveLength(0);
    expect((await apice())['activeReferenceCount']).toBe(0);
    expect(await ctx.db.collection(`apices/${id}/events`).get().then((s) => s.size)).toBe(0);
  });

  it('RF-15 (001): si falla la validación, el ápice queda sin la referencia incompleta', async () => {
    await upload(ana, 'u1', await animatedGif());
    await expect(handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, ana)).rejects.toMatchObject({ code: 'image-animated' });
    expect(await refFiles()).toEqual([]);
    expect(await references()).toHaveLength(0);
  });

  it('RF-15 (001): tras un fallo la persona puede reintentar con el mismo temporal', async () => {
    await upload(ana, 'u1', await png());
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'u1', altText: '' }, ana))).toBe('alt-text-required');
    await handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Mapa' }, ana);
    expect((await apice())['activeReferenceCount']).toBe(1);
  });
});

describe('addReference · reserva de subida (spec 016)', () => {
  it('RF-7 (016) · 7.3: al usar el temporal se gasta su reserva', async () => {
    await upload(ana, 'u1', await png(20, 10));
    await handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Tanque' }, ana);
    expect((await ctx.db.doc('uploadReservations/u1').get()).exists).toBe(false);
  });

  it('RF-7 (016) · 7.3: sin reserva, con la de otra persona o con una caducada no se crea la referencia', async () => {
    await putFile(ctx, `uploads/${ana}/sin`, await png(8, 8));
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'sin', altText: 'A' }, ana))).toBe('invalid-request');
    await putUpload(ctx, beto, 'ajena', await png(8, 8));
    await putFile(ctx, `uploads/${ana}/ajena`, await png(8, 8));
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'ajena', altText: 'A' }, ana))).toBe('invalid-request');
    await putUpload(ctx, ana, 'vieja', await png(8, 8), { expiresInMs: -1000 });
    expect(await codeOf(handleAddReference(ctx, { id, uploadId: 'vieja', altText: 'A' }, ana))).toBe('invalid-request');
    expect(await references()).toHaveLength(0);
    expect(await refFiles()).toEqual([]);
  });

  it('RF-7 (016) · 7.3: tres llamadas simultáneas con el mismo temporal crean una sola referencia', async () => {
    await upload(ana, 'u1', await png(20, 10));
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Tanque' }, ana)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await references()).toHaveLength(1);
    expect((await apice())['activeReferenceCount']).toBe(1);
    expect(await refFiles()).toHaveLength(1);
  });
});
