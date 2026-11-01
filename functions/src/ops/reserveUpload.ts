// RF-7 (016) · 7.3, D-7 (016), D-T9 (016) · Reserva de una subida a Storage: cobra la cuota diaria de subidas y deja
// `uploadReservations/{uploadId}` para una persona, válida una hora. Las reglas de Storage exigen esa reserva.
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { consumeDailySlot } from '../rateLimit';
import { newId } from './mediaInput';

/** Vigencia de una reserva de subida (RF-7 (016) · 7.3). */
export const UPLOAD_RESERVATION_MS = 60 * 60 * 1000;

export async function handleReserveUpload(ctx: Ctx, _payload: Record<string, unknown>, uid: string | null): Promise<{ uploadId: string }> {
  const actor = await requireActor(ctx, uid);
  await consumeDailySlot(ctx, 'upload', actor.uid);
  const uploadId = newId(ctx.random);
  const createdAt = ctx.now();
  await ctx.db.doc(`uploadReservations/${uploadId}`).create({
    uid: actor.uid,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + UPLOAD_RESERVATION_MS),
  });
  return { uploadId };
}
