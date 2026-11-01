// RF-4 (004) · 4.2, RF-1 (004) · 1.4, RF-16 (004) · 16.1, 16.2 · Crear o editar una sección antes de la apertura (D-T12 (004)).
// Sin versiones ni `private/meta` hasta abrir (D-8 (004)); abierta la constitución solo cambia por una propuesta aprobada.
import { Timestamp } from 'firebase-admin/firestore';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';
import { readText, readTitle } from './constitutionInput';

export async function handleSaveSection(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ id: string }> {
  const actor = await requireFacilitator(ctx, uid);
  const editing = payload['id'] !== undefined;
  const existingId = editing ? readId(payload) : null;
  const title = readTitle(payload['title'], 'section');
  const text = readText(payload['text'], 'section');
  const stateRef = ctx.db.doc('constitution/state');
  const ref = existingId === null ? ctx.db.collection('constitutionSections').doc() : ctx.db.doc(`constitutionSections/${existingId}`);
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (account.get('status') !== 'active' || account.get('role') !== 'facilitator') throw new ApiError('forbidden');
    const [stateSnap, sectionSnap] = await Promise.all([tx.get(stateRef), tx.get(ref)]);
    if (stateSnap.get('isOpen') === true) throw new ApiError('constitution-open');
    if (existingId !== null && !sectionSnap.exists) throw new ApiError('section-not-found');
    const now = Timestamp.fromDate(ctx.now());
    if (existingId === null) {
      const order = (stateSnap.get('order') as string[] | undefined) ?? [];
      tx.create(ref, { title, text, updatedAt: now, isRetired: false, retiredAt: null });
      tx.set(
        stateRef,
        stateSnap.exists
          ? { order: [...order, ref.id], updatedAt: now }
          : { isOpen: false, openedAt: null, order: [ref.id], updatedAt: now, logSeq: 0 },
        { merge: true },
      );
    } else {
      tx.update(ref, { title, text, updatedAt: now });
      tx.set(stateRef, { updatedAt: now }, { merge: true });
    }
  });
  return { id: ref.id };
}
