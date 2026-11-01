// Quién llama: lee `accounts/{uid}` en cada op, así la suspensión surte efecto de inmediato
// sin esperar a que caduque el token (D-T3 (001), RF-5 (001)).
import type { AccountDoc } from '../../shared/domain/accounts';
import type { Ctx } from './context';
import { ApiError } from './errors';

export interface Actor extends AccountDoc {
  uid: string;
}

/** Cuenta activa; sin sesión, sin cuenta o suspendida se rechaza con su código. */
export async function requireActor(ctx: Ctx, uid: string | null): Promise<Actor> {
  if (uid === null) throw new ApiError('unauthenticated');
  const snap = await ctx.db.doc(`accounts/${uid}`).get();
  if (!snap.exists) throw new ApiError('forbidden');
  const account = snap.data() as AccountDoc;
  if (account.status !== 'active') throw new ApiError('account-suspended');
  return { ...account, uid };
}

export async function requireFacilitator(ctx: Ctx, uid: string | null): Promise<Actor> {
  const actor = await requireActor(ctx, uid);
  if (actor.role !== 'facilitator') throw new ApiError('forbidden');
  return actor;
}
