// RF-12 (004) · 12.5, D-T7 (004) · Refleja el vencimiento antes de que la página muestre una propuesta o la constitución.
// Exige cuenta activa, devuelve siempre `{}`, acepta `id` opcional y procesa a lo sumo 10 vencidas por llamada.
import { requireActor } from '../access';
import { settleDue } from '../amendmentStore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';

/** Tope de propuestas por llamada, para no demorar la página. */
export const SETTLE_BATCH = 10;

export async function handleSettleAmendments(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  await requireActor(ctx, uid);
  const rawId = payload['id'];
  if (rawId !== undefined && typeof rawId !== 'string') throw new ApiError('invalid-request');
  await settleDue(ctx, rawId === undefined ? { limit: SETTLE_BATCH } : { id: readId({ id: rawId }) });
  return {};
}
