// RF-9 (004) · 9.2, RNF-1 (004) · Archivar un comentario: la autora o un facilitador; deja marcador con quién y cuándo
// y conserva el texto. Es la única acción de quien facilita dentro de una deliberación.
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import { readOpenAmendment, recordEvent } from '../amendmentStore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readAmendmentId, readCommentId } from './commentAmendment';

export async function handleArchiveComment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const amendmentId = readAmendmentId(payload);
  const commentId = readCommentId(payload);
  await ctx.db.runTransaction(async (tx) => {
    const open = await readOpenAmendment(ctx, tx, amendmentId);
    const ref = open.ref.collection('comments').doc(commentId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('comment-not-found');
    if (snap.get('authorUid') !== actor.uid && actor.role !== 'facilitator') throw new ApiError('forbidden');
    if (snap.get('archived') === true) return;
    tx.update(ref, { archived: true, archivedBy: actor.uid, archivedByUsername: actor.username, archivedAt: Timestamp.fromDate(ctx.now()) });
    recordEvent(ctx, tx, open, { kind: 'comment-archived', actor: { uid: actor.uid, username: actor.username }, detail: { commentId } });
  });
  return {};
}
