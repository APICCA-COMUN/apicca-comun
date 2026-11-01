// RF-5 (001) · Suspender una cuenta: surte efecto de inmediato (D-T3 (001)); su nombre de usuario y contenido se conservan.
// RF-14 (004) · 14.1, 14.7, RNF-1 (004), D-T9 (004) · En la misma transacción se retiran sus acuerdos y objeciones abiertas
// y se marcan sus propuestas abiertas con `authorSuspended`.
import { canSuspend } from '../../../shared/domain/access';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { applyStanceWithdrawals, planStanceWithdrawals } from '../withdrawStances';
import { readTarget } from './accountStatus';

export async function handleSuspendAccount(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireFacilitator(ctx, uid);
  const target = await readTarget(ctx, payload);
  const permission = canSuspend({ uid: actor.uid, role: actor.role }, { uid: target.uid, role: target.account.role });
  if (!permission.ok) throw new ApiError(permission.code);
  const accountRef = ctx.db.doc(`accounts/${target.uid}`);
  await ctx.db.runTransaction(async (tx) => {
    // Lecturas primero: la cuenta (su estado y rol pueden haber cambiado) y las posturas (D-T9 (004)).
    const fresh = await tx.get(accountRef);
    if (!fresh.exists) throw new ApiError('invalid-request');
    const recheck = canSuspend({ uid: actor.uid, role: actor.role }, { uid: target.uid, role: fresh.get('role') });
    if (!recheck.ok) throw new ApiError(recheck.code);
    const plan = await planStanceWithdrawals(ctx, tx, target.uid, fresh.get('username') as string);
    tx.update(accountRef, { status: 'suspended', suspendedBy: actor.uid, suspendedAt: ctx.now() });
    applyStanceWithdrawals(ctx, tx, plan, { uid: actor.uid, username: actor.username });
  });
  await ctx.auth.revokeRefreshTokens(target.uid);
  return {};
}
