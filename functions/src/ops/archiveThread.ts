// RF-5 (009), RNF-2 (009) · Archivar un hilo: lo hace su autora o un facilitador; no se borra, queda quién y cuándo.
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readThreadId } from './forumInput';

export async function handleArchiveThread(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const ref = ctx.db.doc(`threads/${readThreadId(payload)}`);
  await ctx.db.runTransaction(async (tx) => {
    const thread = await tx.get(ref);
    if (!thread.exists) throw new ApiError('thread-not-found');
    if (thread.get('authorUid') !== actor.uid && actor.role !== 'facilitator') throw new ApiError('forbidden');
    if (thread.get('isArchived') === true) return;
    tx.update(ref, { isArchived: true, archivedByUid: actor.uid, archivedAt: Timestamp.fromDate(ctx.now()) });
  });
  return {};
}
