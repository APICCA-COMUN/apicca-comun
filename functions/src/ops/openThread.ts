// RF-3 (009) · 3.1–3.3, RNF-2 (009), RNF-5 (009) · Abrir un hilo con su primer mensaje (D-T3 (009)).
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { consumeThreadSlot } from '../rateLimit';
import { readAxis, readForumMessage, readThreadTitle } from './forumInput';

export async function handleOpenThread(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ id: string }> {
  const actor = await requireActor(ctx, uid);
  const title = readThreadTitle(payload['title']);
  const axis = readAxis(payload['axis']);
  const text = readForumMessage(payload['text']);
  await consumeThreadSlot(ctx, actor.uid);
  const now = Timestamp.fromDate(ctx.now());
  const ref = ctx.db.collection('threads').doc();
  const author = { authorUid: actor.uid, authorUsername: actor.username };
  const batch = ctx.db.batch();
  batch.create(ref, { title, axis, ...author, createdAt: now, lastMessageAt: now, messageCount: 1, isArchived: false });
  batch.create(ref.collection('messages').doc(), { ...author, text, createdAt: now, editedAt: null, isArchived: false, isOpening: true });
  await batch.commit();
  return { id: ref.id };
}
