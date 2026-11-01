// RF-8 (004) · 8.3, 8.4, RF-14 (004) · 14.4, RF-12 (004) · 12.6, RNF-1 (004) · Retirar una propuesta propia y abierta.
// Conserva todo su contenido, fija `result: withdrawn`, libera la cerradura y la marca de la sección, y registra el hecho.
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import { readOpenAmendment, recordEvent, releaseSlot } from '../amendmentStore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';

export async function handleWithdrawAmendment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const id = readId({ id: payload['amendmentId'] });
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (account.get('status') !== 'active') throw new ApiError('account-suspended');
    const open = await readOpenAmendment(ctx, tx, id);
    const { amendment } = open;
    if (amendment.authorUid !== actor.uid) throw new ApiError('not-amendment-author');
    tx.update(open.ref, { isOpen: false, result: 'withdrawn', closedAt: Timestamp.fromDate(ctx.now()) });
    releaseSlot(ctx, tx, amendment.slotKey);
    if (amendment.sectionId !== null) {
      tx.set(ctx.db.doc(`constitutionSections/${amendment.sectionId}/private/meta`), { openAmendment: null }, { merge: true });
    }
    recordEvent(ctx, tx, open, { kind: 'withdrawn', actor: { uid: actor.uid, username: actor.username } });
  });
  return {};
}
