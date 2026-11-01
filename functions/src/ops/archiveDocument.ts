// RF-5 (004) · 5.6, 5.7 · Archivar un documento de la constitución: solo marca `isArchived`, sin versión nueva ni cambio
// de `updatedAt` (D-T12 (004)). `restoreDocument` comparte el cambio de bandera.
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';

/** Fija `isArchived`; si el documento ya está así no escribe (idempotente). */
export async function setDocumentArchived(
  ctx: Ctx,
  payload: Record<string, unknown>,
  uid: string | null,
  isArchived: boolean,
): Promise<Record<string, never>> {
  const actor = await requireFacilitator(ctx, uid);
  const id = readId(payload);
  const ref = ctx.db.doc(`constitutionDocuments/${id}`);
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (account.get('status') !== 'active' || account.get('role') !== 'facilitator') throw new ApiError('forbidden');
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('invalid-request');
    if (snap.get('isArchived') !== isArchived) tx.update(ref, { isArchived });
  });
  return {};
}

export const handleArchiveDocument = (ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> =>
  setDocumentArchived(ctx, payload, uid, true);
