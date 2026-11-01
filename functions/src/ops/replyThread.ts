// RF-4 (009) · 4.1, RNF-2 (009) · Responder en un hilo: añade el mensaje y actualiza actividad y número de respuestas.
// `messageCount` cuenta los mensajes del hilo, el de apertura incluido; la interfaz muestra `messageCount - 1` respuestas.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readForumMessage, readThreadId } from './forumInput';

export async function handleReplyThread(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ id: string }> {
  const actor = await requireActor(ctx, uid);
  const threadId = readThreadId(payload);
  const text = readForumMessage(payload['text']);
  const threadRef = ctx.db.doc(`threads/${threadId}`);
  const messageRef = threadRef.collection('messages').doc();
  await ctx.db.runTransaction(async (tx) => {
    const thread = await tx.get(threadRef);
    if (!thread.exists) throw new ApiError('thread-not-found');
    if (thread.get('isArchived') === true) throw new ApiError('thread-archived');
    const now = Timestamp.fromDate(ctx.now());
    tx.create(messageRef, { authorUid: actor.uid, authorUsername: actor.username, text, createdAt: now, editedAt: null, isArchived: false });
    tx.update(threadRef, { lastMessageAt: now, messageCount: FieldValue.increment(1) });
  });
  return { id: messageRef.id };
}
