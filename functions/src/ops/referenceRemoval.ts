// RF-16 (001) · Quitar o retirar una referencia: se oculta y se conserva, con quién, cuándo y (si se retira) el motivo.
// Un solo recorrido para las dos ops, así el contador y el evento no se desfasan (D-T19 (001)).
import { validateDiscardReason } from '../../../shared/domain/enrollment';
import { LIMITS, validateLength } from '../../../shared/domain/limits';
import { requireActor, type Actor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';
import { assertCanChangeReferences, newId, readToken } from './mediaInput';

export type RemovalKind = 'removed' | 'retracted';

/** Motivo de un retiro: obligatorio, recortado y acotado como cualquier texto largo. */
export function readReason(payload: Record<string, unknown>): string {
  const checked = validateDiscardReason(typeof payload['reason'] === 'string' ? payload['reason'] : '');
  if (!checked.ok) throw new ApiError(checked.code);
  if (!validateLength(checked.value, LIMITS.text).ok) throw new ApiError('text-too-long');
  return checked.value;
}

export async function removeReferenceDoc(
  ctx: Ctx,
  payload: Record<string, unknown>,
  actor: Actor,
  kind: RemovalKind,
  reason: string | null,
): Promise<Record<string, never>> {
  const id = readId(payload);
  const refId = readToken(payload, 'refId');
  await ctx.db.runTransaction(async (tx) => {
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (accountSnap.data()?.['status'] !== 'active') throw new ApiError('account-suspended');
    const apiceRef = ctx.db.doc(`apices/${id}`);
    const apiceSnap = await tx.get(apiceRef);
    if (!apiceSnap.exists) throw new ApiError('invalid-request');
    const apice = apiceSnap.data() as Record<string, unknown>;
    // Quitar vale en un ápice no archivado; retirar (facilitación) vale en cualquiera (RF-16 (001)).
    if (kind === 'removed') assertCanChangeReferences(actor, apice);
    const refDoc = ctx.db.doc(`apices/${id}/references/${refId}`);
    const refSnap = await tx.get(refDoc);
    if (!refSnap.exists) throw new ApiError('reference-not-found');
    const reference = refSnap.data() as { isRemoved?: boolean; removal?: { kind?: string } | null };
    const wasRemoved = reference.isRemoved === true;
    if (wasRemoved && (kind === 'removed' || reference.removal?.kind === 'retracted')) return;
    const at = ctx.now();
    tx.update(refDoc, { isRemoved: true, removal: { kind, byUsername: actor.username, at, reason } });
    if (!wasRemoved) {
      const active = (apice['activeReferenceCount'] as number | undefined) ?? 0;
      tx.update(apiceRef, { activeReferenceCount: Math.max(0, active - 1) });
    }
    tx.set(ctx.db.doc(`apices/${id}/events/${newId(ctx.random)}`), {
      type: kind === 'removed' ? 'reference-removed' : 'reference-retracted',
      byUid: actor.uid,
      byUsername: actor.username,
      at,
      detail: reason === null ? { refId } : { refId, reason },
    });
  });
  return {};
}

export async function removeAs(ctx: Ctx, payload: Record<string, unknown>, uid: string | null, kind: RemovalKind): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  if (kind === 'retracted') {
    if (actor.role !== 'facilitator') throw new ApiError('forbidden');
    return removeReferenceDoc(ctx, payload, actor, kind, readReason(payload));
  }
  return removeReferenceDoc(ctx, payload, actor, kind, null);
}
