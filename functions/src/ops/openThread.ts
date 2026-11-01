// RF-3 (009) · 3.1–3.3, RNF-2 (009), RNF-5 (009), RF-3 (017) · Abrir un hilo con su primer mensaje (D-T3 (009)).
import { Timestamp } from 'firebase-admin/firestore';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { takeThreadSlot } from '../rateLimit';
import { readAxis, readForumMessage, readThreadTitle } from './forumInput';

export async function handleOpenThread(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ id: string }> {
  const actor = await requireActor(ctx, uid);
  const title = readThreadTitle(payload['title']);
  const axis = readAxis(payload['axis']);
  const text = readForumMessage(payload['text']);
  const ref = ctx.db.collection('threads').doc();
  const author = { authorUid: actor.uid, authorUsername: actor.username };
  await ctx.db.runTransaction(async (tx) => {
    // El cupo de hilos se cobra en la misma escritura que crea el hilo (RF-3 (017), D-T3 (017)).
    const charge = await takeThreadSlot(ctx, tx, actor.uid);
    charge();
    const now = Timestamp.fromDate(ctx.now());
    tx.create(ref, { title, axis, ...author, createdAt: now, lastMessageAt: now, messageCount: 1, isArchived: false });
    tx.create(ref.collection('messages').doc(), { ...author, text, createdAt: now, editedAt: null, isArchived: false, isOpening: true });
  });
  return { id: ref.id };
}
