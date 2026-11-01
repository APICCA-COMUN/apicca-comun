// RF-5 (009), RNF-2 (009) · Archivar un mensaje: lo hace su autora o un facilitador; no se borra, queda quién y cuándo.
// El mensaje de apertura se archiva con el hilo (`archiveThread`), no por separado.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readMessageId, readThreadId } from './forumInput';

export async function handleArchiveMessage(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const threadRef = ctx.db.doc(`threads/${readThreadId(payload)}`);
  const ref = threadRef.collection('messages').doc(readMessageId(payload));
  await ctx.db.runTransaction(async (tx) => {
    const [thread, message] = await Promise.all([tx.get(threadRef), tx.get(ref)]);
    if (!thread.exists) throw new ApiError('thread-not-found');
    if (!message.exists) throw new ApiError('message-not-found');
    if (message.get('authorUid') !== actor.uid && actor.role !== 'facilitator') throw new ApiError('forbidden');
    if (message.get('isArchived') === true) return;
    if (message.get('isOpening') === true) throw new ApiError('forbidden');
    tx.update(ref, { isArchived: true, archivedByUid: actor.uid, archivedAt: Timestamp.fromDate(ctx.now()) });
    tx.update(threadRef, { messageCount: FieldValue.increment(-1) });
  });
  return {};
}
