// RF-4 (004) · 4.2, RF-1 (004) · 1.4 · Reordenar `order` antes de la apertura: debe ser una permutación de los ids vigentes (D-T12 (004)).
import { Timestamp } from 'firebase-admin/firestore';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';

function readOrder(raw: unknown): string[] {
  if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string')) throw new ApiError('invalid-request');
  return raw as string[];
}

export async function handleReorderSections(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireFacilitator(ctx, uid);
  const order = readOrder(payload['order']);
  const stateRef = ctx.db.doc('constitution/state');
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (account.get('status') !== 'active' || account.get('role') !== 'facilitator') throw new ApiError('forbidden');
    const stateSnap = await tx.get(stateRef);
    if (stateSnap.get('isOpen') === true) throw new ApiError('constitution-open');
    const current = (stateSnap.get('order') as string[] | undefined) ?? [];
    const same = order.length === current.length && new Set(order).size === order.length && order.every((id) => current.includes(id));
    if (!same) throw new ApiError('invalid-request');
    tx.set(stateRef, { order, updatedAt: Timestamp.fromDate(ctx.now()) }, { merge: true });
  });
  return {};
}
