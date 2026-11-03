// RF-2 (018), D-T6 (018), D-T8 (018): cobra el cupo de ediciones; con el texto igual responde la versión vigente sin escribir ni cobrar.
// RF-9 (004) · 9.1, 9.3, RF-16 (004) · 16.1, 16.2, D-T10 (004) · Editar un comentario propio guardando la versión anterior.
// `baseVersion` es opcional: si llega y no coincide, responde el conflicto `{ ok: false, conflict: true, current }`.
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import { readOpenAmendment } from '../amendmentStore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { takeDailySlot } from '../rateLimit';
import { readAmendmentId, readCommentId } from './commentAmendment';
import { readComment } from './constitutionInput';

export interface CommentCurrent {
  text: string;
  version: number;
}

export type EditCommentResult = { ok: true; version: number } | { ok: false; conflict: true; current: CommentCurrent };

export async function handleEditComment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<EditCommentResult> {
  const actor = await requireActor(ctx, uid);
  const amendmentId = readAmendmentId(payload);
  const commentId = readCommentId(payload);
  const text = readComment(payload['text']);
  const base = payload['baseVersion'];
  if (base !== undefined && (typeof base !== 'number' || !Number.isInteger(base) || base < 1)) throw new ApiError('invalid-request');
  return ctx.db.runTransaction(async (tx) => {
    const open = await readOpenAmendment(ctx, tx, amendmentId);
    const ref = open.ref.collection('comments').doc(commentId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('comment-not-found');
    if (snap.get('authorUid') !== actor.uid || snap.get('archived') === true) throw new ApiError('forbidden');
    const version = snap.get('version') as number;
    const previousText = snap.get('text') as string;
    if (base !== undefined && base !== version) return { ok: false as const, conflict: true as const, current: { text: previousText, version } };
    if (previousText === text) return { ok: true as const, version };
    const applyCharge = await takeDailySlot(ctx, tx, 'edit', actor.uid);
    applyCharge();
    const at = Timestamp.fromDate(ctx.now());
    const savedAt = (snap.get('editedAt') as Timestamp | null) ?? (snap.get('createdAt') as Timestamp);
    tx.create(ref.collection('versions').doc(String(version)), {
      version,
      text: previousText,
      at: savedAt,
      byUid: actor.uid,
      byUsername: actor.username,
    });
    tx.update(ref, { text, version: version + 1, editedAt: at });
    return { ok: true as const, version: version + 1 };
  });
}
