// RF-5 (001) · Cambio de estado de una cuenta, común a suspender y reactivar.
import type { AccountDoc } from '../../../shared/domain/accounts';
import type { Ctx } from '../context';
import { ApiError } from '../errors';

/** Lee la cuenta destino del payload; ausente o inexistente es `invalid-request`. */
export async function readTarget(ctx: Ctx, payload: Record<string, unknown>): Promise<{ uid: string; account: AccountDoc }> {
  const uid = payload['uid'];
  if (typeof uid !== 'string' || uid === '' || uid.includes('/')) throw new ApiError('invalid-request');
  const snap = await ctx.db.doc(`accounts/${uid}`).get();
  if (!snap.exists) throw new ApiError('invalid-request');
  return { uid, account: snap.data() as AccountDoc };
}
