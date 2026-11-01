// RF-4 (004) · 4.2, RF-1 (004) · 1.4 · Quitar una sección antes de la apertura: se borra y sale de `order` (D-T12 (004)).
import { Timestamp } from 'firebase-admin/firestore';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';

export async function handleRemoveSection(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireFacilitator(ctx, uid);
  const id = readId(payload);
  const stateRef = ctx.db.doc('constitution/state');
  const ref = ctx.db.doc(`constitutionSections/${id}`);
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (account.get('status') !== 'active' || account.get('role') !== 'facilitator') throw new ApiError('forbidden');
    const [stateSnap, sectionSnap] = await Promise.all([tx.get(stateRef), tx.get(ref)]);
    if (stateSnap.get('isOpen') === true) throw new ApiError('constitution-open');
    if (!sectionSnap.exists) throw new ApiError('section-not-found');
    const order = ((stateSnap.get('order') as string[] | undefined) ?? []).filter((item) => item !== id);
    tx.delete(ref);
    tx.delete(ref.collection('private').doc('meta'));
    tx.set(stateRef, { order, updatedAt: Timestamp.fromDate(ctx.now()) }, { merge: true });
  });
  return {};
}
