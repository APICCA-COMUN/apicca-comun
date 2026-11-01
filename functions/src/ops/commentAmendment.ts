// RF-9 (004) · 9.1, 9.3, RF-16 (004) · 16.1, 16.2, RNF-1 (004), RF-7 (016) · 7.1, RF-9 (016) · 9.2, RF-3 (017) · Comentar una propuesta abierta (D-T12 (004)).
// Cualquier cuenta activa comenta; una propuesta cerrada o vencida no admite comentarios nuevos (`readOpenAmendment`).
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import { readOpenAmendment, recordEvent } from '../amendmentStore';
import type { Ctx } from '../context';
import { readSafeId } from '../ids';
import { takeDailySlot } from '../rateLimit';
import { readComment } from './constitutionInput';

export function readAmendmentId(payload: Record<string, unknown>): string {
  return readSafeId(payload, 'amendmentId');
}

export function readCommentId(payload: Record<string, unknown>): string {
  return readSafeId(payload, 'commentId');
}

export async function handleCommentAmendment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ id: string }> {
  const actor = await requireActor(ctx, uid);
  const amendmentId = readAmendmentId(payload);
  const text = readComment(payload['text']);
  const id = await ctx.db.runTransaction(async (tx) => {
    const open = await readOpenAmendment(ctx, tx, amendmentId);
    // RF-7 (016) · 7.1, RF-3 (017): cuota diaria por persona, cobrada con la escritura; una propuesta cerrada no la gasta.
    const charge = await takeDailySlot(ctx, tx, 'comment', actor.uid);
    charge();
    const ref = open.ref.collection('comments').doc();
    tx.create(ref, {
      text,
      authorUid: actor.uid,
      authorUsername: actor.username,
      createdAt: Timestamp.fromDate(ctx.now()),
      editedAt: null,
      version: 1,
      archived: false,
      archivedBy: null,
    });
    recordEvent(ctx, tx, open, { kind: 'commented', actor: { uid: actor.uid, username: actor.username }, detail: { commentId: ref.id } });
    return ref.id;
  });
  return { id };
}
