// RF-7 (010) · 7.1, 7.2, RF-1 (010) · 1.5, RNF-5 (010), D-T3 (010) · Cerrar, reabrir o archivar una Acción Común. La autora
// hace las tres; un facilitador solo archiva, y queda registrado quién. Reabrir vuelve a contar el tope de abiertas (D-4 (010)).
import { Timestamp } from 'firebase-admin/firestore';
import { canArchive, canManage, COMMON_ACTION_LIMITS, isListed, type CommonActionStatus } from '../../../shared/domain/commonActions';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { takeDailySlot } from '../rateLimit';
import { actionRef, readAction, readActionId } from './commonActionInput';

const STATUSES: readonly CommonActionStatus[] = ['abierta', 'cerrada', 'archivada'];

export async function handleSetCommonActionStatus(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const ref = actionRef(ctx, readActionId(payload));
  const status = payload['status'];
  if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) throw new ApiError('invalid-request');
  const target = status as CommonActionStatus;
  await ctx.db.runTransaction(async (tx) => {
    const { data } = await readAction(tx, ref);
    if (data.status === 'archivada') throw new ApiError('action-archived');
    const allowed = target === 'archivada' ? canArchive(actor, data) : canManage(actor, data);
    if (!allowed) throw new ApiError('not-action-author');
    if (data.status === target) return;
    if (target === 'abierta') {
      const open = await tx.get(
        ctx.db.collection('commonActions').where('authorUid', '==', data.authorUid).where('status', '==', 'abierta').limit(COMMON_ACTION_LIMITS.openPerAuthor),
      );
      if (open.size >= COMMON_ACTION_LIMITS.openPerAuthor) throw new ApiError('action-limit');
    }
    const charge = await takeDailySlot(ctx, tx, 'edit', actor.uid);
    charge();
    const archivedBy = target === 'archivada' ? { archivedBy: actor.uid } : {};
    tx.update(ref, { status: target, isListed: isListed({ ...data, status: target }), ...archivedBy, updatedAt: Timestamp.fromDate(ctx.now()) });
  });
  return {};
}
