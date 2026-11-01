// RF-16 (001) · Una facilitadora retira una imagen aceptada de un ápice, con motivo y en cualquier ápice. Si era la actual,
// el ápice queda sin imagen; las anteriores se conservan (RF-18 (001), RNF-7 (001), D-T19 (001)).
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';
import { newId, readToken } from './mediaInput';
import { readReason } from './referenceRemoval';

export async function retractApiceImage(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  if (actor.role !== 'facilitator') throw new ApiError('forbidden');
  const reason = readReason(payload);
  const id = readId(payload);
  const imageId = readToken(payload, 'imageId');
  await ctx.db.runTransaction(async (tx) => {
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    const apiceRef = ctx.db.doc(`apices/${id}`);
    const apiceSnap = await tx.get(apiceRef);
    const imageRef = ctx.db.doc(`apices/${id}/images/${imageId}`);
    const imageSnap = await tx.get(imageRef);
    if (accountSnap.data()?.['status'] !== 'active') throw new ApiError('account-suspended');
    if (!apiceSnap.exists) throw new ApiError('invalid-request');
    if (!imageSnap.exists) throw new ApiError('image-missing');
    if (imageSnap.data()?.['isRemoved'] === true) return;
    const at = ctx.now();
    tx.update(imageRef, { isRemoved: true, removal: { kind: 'retracted', byUsername: actor.username, at, reason } });
    if ((apiceSnap.data()?.['image'] as { id?: string } | null)?.id === imageId) tx.update(apiceRef, { image: null });
    tx.set(ctx.db.doc(`apices/${id}/events/${newId(ctx.random)}`), {
      type: 'image-retracted',
      byUid: actor.uid,
      byUsername: actor.username,
      at,
      detail: { imageId, reason },
    });
  });
  return {};
}
