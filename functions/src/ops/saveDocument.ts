// RF-5 (004) · 5.3, 5.5, RF-16 (004) · 16.1, 16.2, RF-17 (004) · 17.2 · Crear (versión 1) o editar con `baseVersion` un
// documento de la constitución; con otra versión vigente responde el conflicto (D-T10 (004), forma de RF-16 (001)).
import { Timestamp } from 'firebase-admin/firestore';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId, readInteger } from './apiceInput';
import { readText, readTitle } from './constitutionInput';

export interface DocumentContent {
  version: number;
  title: string;
  text: string;
}

export type SaveDocumentResult =
  | { ok: true; id: string; version: number }
  | { ok: false; conflict: true; current: DocumentContent };

export async function handleSaveDocument(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<SaveDocumentResult> {
  const actor = await requireFacilitator(ctx, uid);
  const existingId = payload['id'] === undefined ? null : readId(payload);
  const baseVersion = existingId === null ? null : readInteger(payload, 'baseVersion');
  const title = readTitle(payload['title'], 'document');
  const text = readText(payload['text'], 'document');
  const ref = existingId === null ? ctx.db.collection('constitutionDocuments').doc() : ctx.db.doc(`constitutionDocuments/${existingId}`);
  return ctx.db.runTransaction(async (tx): Promise<SaveDocumentResult> => {
    const account = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (account.get('status') !== 'active' || account.get('role') !== 'facilitator') throw new ApiError('forbidden');
    const snap = await tx.get(ref);
    const now = Timestamp.fromDate(ctx.now());
    const saver = { byUid: actor.uid, byUsername: actor.username };
    if (existingId === null) {
      tx.create(ref, { title, text, createdAt: now, updatedAt: now, version: 1, isArchived: false });
      tx.create(ref.collection('versions').doc('1'), { title, text, version: 1, ...saver, at: now });
      return { ok: true, id: ref.id, version: 1 };
    }
    if (!snap.exists) throw new ApiError('invalid-request');
    const current: DocumentContent = {
      version: snap.get('version') as number,
      title: snap.get('title') as string,
      text: snap.get('text') as string,
    };
    if (current.version !== baseVersion) return { ok: false, conflict: true, current };
    if (current.title === title && current.text === text) return { ok: true, id: ref.id, version: current.version };
    const version = current.version + 1;
    tx.update(ref, { title, text, version, updatedAt: now });
    tx.create(ref.collection('versions').doc(String(version)), { title, text, version, ...saver, at: now });
    return { ok: true, id: ref.id, version };
  });
}
