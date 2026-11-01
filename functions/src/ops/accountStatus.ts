// RF-5 (001), RF-9 (016) · 9.2 · Cambio de estado de una cuenta, común a suspender y reactivar.
import type { AccountDoc } from '../../../shared/domain/accounts';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readSafeId } from '../ids';

/** Lee la cuenta destino del payload; ausente o inexistente es `invalid-request`. */
export async function readTarget(ctx: Ctx, payload: Record<string, unknown>): Promise<{ uid: string; account: AccountDoc }> {
  const uid = readSafeId(payload, 'uid');
  const snap = await ctx.db.doc(`accounts/${uid}`).get();
  if (!snap.exists) throw new ApiError('invalid-request');
  return { uid, account: snap.data() as AccountDoc };
}
