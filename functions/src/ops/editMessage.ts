// RF-2 (018), D-T6 (018), D-T8 (018): cobra el cupo de ediciones y no escribe ni cobra si el texto no cambia.
// RF-6 (009), RNF-2 (009) · Editar un mensaje propio: guarda el texto nuevo y la fecha de edición.
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { takeDailySlot } from '../rateLimit';
import { ApiError } from '../errors';
import { readForumMessage, readMessageId, readThreadId } from './forumInput';

export async function handleEditMessage(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const threadId = readThreadId(payload);
  const messageId = readMessageId(payload);
  const text = readForumMessage(payload['text']);
  const threadRef = ctx.db.doc(`threads/${threadId}`);
  const ref = threadRef.collection('messages').doc(messageId);
  await ctx.db.runTransaction(async (tx) => {
    const [thread, message] = await Promise.all([tx.get(threadRef), tx.get(ref)]);
    if (!thread.exists) throw new ApiError('thread-not-found');
    if (!message.exists) throw new ApiError('message-not-found');
    if (message.get('authorUid') !== actor.uid || message.get('isArchived') === true || thread.get('isArchived') === true) throw new ApiError('forbidden');
    if (message.get('text') === text) return;
    const applyCharge = await takeDailySlot(ctx, tx, 'edit', actor.uid);
    applyCharge();
    tx.update(ref, { text, editedAt: Timestamp.fromDate(ctx.now()) });
  });
  return {};
}
