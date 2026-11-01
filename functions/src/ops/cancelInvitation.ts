// RF-1 (001) · Anular una invitación pendiente o vencida: su enlace deja de existir.
import { FieldValue } from 'firebase-admin/firestore';
import { emailKey } from '../../../shared/domain/invitations';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readEmail } from './emailPayload';

export async function handleCancelInvitation(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireFacilitator(ctx, uid);
  const ref = ctx.db.doc(`invitations/${await emailKey(readEmail(payload))}`);
  await ctx.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('invitation-not-found');
    if (snap.get('status') !== 'pending') throw new ApiError('invitation-not-cancellable');
    tx.update(ref, { status: 'cancelled', token: FieldValue.delete(), cancelledBy: actor.uid, cancelledAt: ctx.now() });
  });
  return {};
}
