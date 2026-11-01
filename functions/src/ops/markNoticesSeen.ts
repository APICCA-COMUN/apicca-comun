// RF-3 (012) · Marcar los avisos como leídos: fija `noticesSeenAt` en la cuenta activa que llama (D-T5 (012)).
import { requireActor } from '../access';
import type { Ctx } from '../context';

export async function handleMarkNoticesSeen(ctx: Ctx, _payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  await ctx.db.doc(`accounts/${actor.uid}`).update({ noticesSeenAt: ctx.now() });
  return {};
}
