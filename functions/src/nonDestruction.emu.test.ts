// T-7.4 (001) · Prueba transversal de no destrucción (RNF-7 (001), RNF-6 (001)): tras editar, restaurar versión, archivar
// y restaurar, todo lo anterior sigue existiendo. Se cuentan documentos y archivos del ápice después de cada paso.
// RF-27 (021) · 27.4, D-T6 (021): la imagen aceptada y las referencias que existían antes del retiro se conservan,
// aunque ya ninguna operación las cree ni ninguna pantalla las muestre.
import type { DocumentReference } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleArchiveApice } from './ops/archiveApice';
import { handleCreateApice } from './ops/createApice';
import { handleEditApice } from './ops/editApice';
import { handleRestoreApice } from './ops/restoreApice';
import { handleRestoreVersion } from './ops/restoreVersion';
import { handleSetVisibility } from './ops/setVisibility';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { VALID } from './testing/apiceKit';
import { PNG_BYTES, clearBucket, listPaths, putFile } from './testing/storageKit';

let ctx: TestCtx;
let ana: string;
let id: string;

interface Snapshot {
  docs: Map<string, string>;
  files: string[];
}

/** Recorre el ápice y todas sus subcolecciones: ruta → contenido serializado. */
async function walk(ref: DocumentReference, into: Map<string, string>): Promise<void> {
  const snap = await ref.get();
  if (snap.exists) into.set(ref.path, JSON.stringify(snap.data()));
  for (const collection of await ref.listCollections()) {
    for (const child of await collection.listDocuments()) await walk(child, into);
  }
}

async function snapshot(): Promise<Snapshot> {
  const docs = new Map<string, string>();
  await walk(ctx.db.doc(`apices/${id}`), docs);
  return { docs, files: await listPaths(ctx, `apices/${id}/`) };
}

/** Lo que nunca se reescribe: versiones (y su punto exacto), eventos y, desde la 021, imágenes y referencias. */
const IMMUTABLE = /^apices\/[^/]+\/(versions|events|images|references)\//;

async function step(name: string, action: () => Promise<unknown>, before: Snapshot): Promise<Snapshot> {
  await action();
  const after = await snapshot();
  for (const path of before.docs.keys()) expect(after.docs.has(path), `${name}: desapareció ${path}`).toBe(true);
  for (const file of before.files) expect(after.files, `${name}: desapareció ${file}`).toContain(file);
  for (const [path, data] of before.docs) if (IMMUTABLE.test(path)) expect(after.docs.get(path), `${name}: cambió ${path}`).toBe(data);
  return after;
}

const content = (patch: Record<string, unknown> = {}) => ({ ...VALID, status: 'idea', ...patch });
const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;

/** Lo que dejaron las operaciones retiradas: la imagen aceptada en el ápice, su registro y dos referencias. */
const STORED_IMAGE = { id: 'img1', altText: 'Una huerta en pixeles', png: 'AAECAw==' };

async function seedStoredImage(): Promise<void> {
  await ctx.db.doc(`apices/${id}`).update({ image: STORED_IMAGE, activeReferenceCount: 1 });
  await ctx.db.doc(`apices/${id}/images/img1`).set({ altText: STORED_IMAGE.altText, png: STORED_IMAGE.png, isRemoved: false, removal: null });
  for (const [refId, isRemoved] of [['r1', false], ['r2', true]] as const) {
    const path = `apices/${id}/references/${refId}`;
    await putFile(ctx, path, PNG_BYTES);
    await ctx.db.doc(path).set({ path, altText: `Referencia ${refId}`, isRemoved, removal: isRemoved ? { kind: 'removed' } : null });
  }
}

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  id = ((await handleCreateApice(ctx, { ...VALID, location: { mode: 'set', lat: 4.6, lng: -74.08, precision: 'approximate' } }, ana)) as { id: string }).id;
});

describe('no destrucción', () => {
  it('RNF-7 (001): editar, restaurar versión, archivar y restaurar no borran nada', async () => {
    let state = await snapshot();
    expect([...state.docs.keys()]).toContain(`apices/${id}/versions/1/private/exact`);

    // Editar y restaurar versión: las versiones anteriores quedan intactas y aparece una nueva.
    state = await step('editar', () => handleEditApice(ctx, { id, baseVersion: 1, content: content({ needs: 'Semillas' }) }, ana), state);
    state = await step('restaurar versión', () => handleRestoreVersion(ctx, { id, n: 1, baseVersion: 2 }, ana), state);
    expect((await apice())['version']).toBe(3);

    state = await step('archivar', () => handleArchiveApice(ctx, { id }, ana), state);
    state = await step('restaurar el ápice', () => handleRestoreApice(ctx, { id }, ana), state);
    expect([...state.docs.keys()].filter((path) => path.includes('/versions/') && !path.includes('/private/'))).toHaveLength(3);
  });

  it('RF-27 (021) · 27.4: la imagen aceptada y las referencias que ya existían sobreviven a editar, restaurar versión, publicar, archivar y restaurar', async () => {
    await seedStoredImage();
    let state = await snapshot();
    expect(state.files).toEqual([`apices/${id}/references/r1`, `apices/${id}/references/r2`]);

    const kept = async (name: string): Promise<void> => {
      const data = await apice();
      expect(data['image'], `${name}: el campo image`).toEqual(STORED_IMAGE);
      expect(data['activeReferenceCount'], `${name}: el contador de referencias`).toBe(1);
    };

    const steps: Array<[string, () => Promise<unknown>]> = [
      ['editar', () => handleEditApice(ctx, { id, baseVersion: 1, content: content({ needs: 'Semillas' }) }, ana)],
      ['restaurar versión', () => handleRestoreVersion(ctx, { id, n: 1, baseVersion: 2 }, ana)],
      ['publicar', () => handleSetVisibility(ctx, { id, visibility: 'public' }, ana)],
      ['archivar', () => handleArchiveApice(ctx, { id }, ana)],
      ['restaurar el ápice', () => handleRestoreApice(ctx, { id }, ana)],
    ];
    for (const [name, action] of steps) {
      state = await step(name, action, state);
      await kept(name);
    }

    expect(state.files).toEqual([`apices/${id}/references/r1`, `apices/${id}/references/r2`]);
    expect([...state.docs.keys()].filter((path) => /\/(images|references)\//.test(path))).toHaveLength(3);
  });
});
