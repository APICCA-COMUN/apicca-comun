// RF-18 (001) · Descartar la propuesta propia: se elimina y la imagen del ápice queda como estaba. Repetirlo no falla.
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { readId } from './apiceInput';

export async function handleDiscardProposal(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const id = readId(payload);
  await ctx.db.doc(`proposals/${id}_${actor.uid}`).delete();
  return {};
}
