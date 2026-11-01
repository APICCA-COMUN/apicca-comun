// T-7.4 · Prueba transversal de no destrucción (RNF-7 (001), RNF-6 (001)): tras quitar, retirar, archivar, restaurar, aceptar y
// restaurar versión, todo lo anterior sigue existiendo. Se cuentan documentos y archivos del ápice después de cada
// paso; solo pueden desaparecer las propuestas (fuera del ápice) y los temporales de `uploads/`.
import type { DocumentReference } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeImageModel } from './model/imageModel';
import { handleAcceptProposal } from './ops/acceptProposal';
import { handleAddReference } from './ops/addReference';
import { handleArchiveApice } from './ops/archiveApice';
import { handleCreateApice } from './ops/createApice';
import { handleEditApice } from './ops/editApice';
import { handleGenerateImage } from './ops/generateImage';
import { handleRemoveReference } from './ops/removeReference';
import { handleRestoreApice } from './ops/restoreApice';
import { handleRestoreVersion } from './ops/restoreVersion';
import { handleRetractImage } from './ops/retractImage';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { VALID } from './testing/apiceKit';
import { sampleImage, withModel } from './testing/generationKit';
import { clearBucket, listPaths, png, putUpload } from './testing/mediaKit';

let ctx: TestCtx;
let ana: string;
let fabi: string;
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

/** Lo que nunca se reescribe: versiones (y su punto exacto) y eventos. */
const IMMUTABLE = /^apices\/[^/]+\/(versions|events)\//;

async function step(name: string, action: () => Promise<unknown>, before: Snapshot): Promise<Snapshot> {
  await action();
  const after = await snapshot();
  for (const path of before.docs.keys()) expect(after.docs.has(path), `${name}: desapareció ${path}`).toBe(true);
  for (const file of before.files) expect(after.files, `${name}: desapareció ${file}`).toContain(file);
  for (const [path, data] of before.docs) if (IMMUTABLE.test(path)) expect(after.docs.get(path), `${name}: cambió ${path}`).toBe(data);
  return after;
}

const content = (patch: Record<string, unknown> = {}) => ({ ...VALID, status: 'idea', ...patch });
const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as { version: number; image: { id: string } | null };
const generateAndAccept = async (altText: string) => {
  await handleGenerateImage(withModel(ctx, createFakeImageModel({ image: await sampleImage() })), { id }, ana);
  await handleAcceptProposal(ctx, { id, altText }, ana);
};

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  id = ((await handleCreateApice(ctx, { ...VALID, location: { mode: 'set', lat: 4.6, lng: -74.08, precision: 'approximate' } }, ana)) as { id: string }).id;
});

describe('no destrucción', () => {
  it('RNF-7 (001): quitar, retirar, archivar, restaurar, aceptar y restaurar versión no borran nada', async () => {
    let state = await snapshot();
    expect([...state.docs.keys()]).toContain(`apices/${id}/versions/1/private/exact`);

    // Dos referencias subidas; una se quita y otra se retira: los archivos y los documentos se conservan.
    await putUpload(ctx, ana, 'u1', await png(8, 8));
    await putUpload(ctx, ana, 'u2', await png(9, 9));
    const first = (await handleAddReference(ctx, { id, uploadId: 'u1', altText: 'Una' }, ana)) as { refId: string };
    const second = (await handleAddReference(ctx, { id, uploadId: 'u2', altText: 'Otra' }, ana)) as { refId: string };
    state = await snapshot();
    expect(state.files).toHaveLength(2);

    state = await step('quitar una referencia', () => handleRemoveReference(ctx, { id, refId: first.refId }, ana), state);
    state = await step('retirar una referencia', () => handleRetractImage(ctx, { id, refId: second.refId, reason: 'Sin permiso' }, fabi), state);
    expect(state.files).toHaveLength(2);

    // Editar y restaurar versión: las versiones anteriores quedan intactas y aparece una nueva.
    state = await step('editar', () => handleEditApice(ctx, { id, baseVersion: 1, content: content({ needs: 'Semillas' }) }, ana), state);
    state = await step('restaurar versión', () => handleRestoreVersion(ctx, { id, n: 1, baseVersion: 2 }, ana), state);
    expect((await apice()).version).toBe(3);

    // Aceptar dos imágenes seguidas: la primera sigue en `images/`.
    state = await step('aceptar la primera imagen', () => generateAndAccept('Primera'), state);
    const firstImage = (await apice()).image?.id;
    state = await step('aceptar la segunda imagen', () => generateAndAccept('Segunda'), state);
    expect(await ctx.db.doc(`apices/${id}/images/${firstImage}`).get().then((d) => d.exists)).toBe(true);

    // Archivar, restaurar y retirar la imagen actual: nada se borra.
    state = await step('archivar', () => handleArchiveApice(ctx, { id }, ana), state);
    state = await step('restaurar el ápice', () => handleRestoreApice(ctx, { id }, ana), state);
    const current = (await apice()).image?.id;
    state = await step('retirar la imagen del ápice', () => handleRetractImage(ctx, { id, imageId: current, reason: 'Motivo' }, fabi), state);
    expect((await apice()).image).toBeNull();
    expect([...state.docs.keys()].filter((p) => p.includes('/images/'))).toHaveLength(2);
  });
});
