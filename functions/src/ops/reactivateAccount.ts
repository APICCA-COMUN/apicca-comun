// RF-5 (001) · Reactivar una cuenta suspendida. RF-14 (004) · 14.7: desmarca sus propuestas abiertas.
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { readTarget } from './accountStatus';

export async function handleReactivateAccount(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireFacilitator(ctx, uid);
  const target = await readTarget(ctx, payload);
  const authored = await ctx.db.collection('amendments').where('authorUid', '==', target.uid).where('isOpen', '==', true).get();
  const batch = ctx.db.batch();
  batch.update(ctx.db.doc(`accounts/${target.uid}`), { status: 'active', reactivatedBy: actor.uid, reactivatedAt: ctx.now() });
  // RF-14 (004) · 14.7: sus propuestas abiertas vuelven a contar su acuerdo implícito.
  for (const doc of authored.docs) batch.update(doc.ref, { authorSuspended: false });
  await batch.commit();
  return {};
}
