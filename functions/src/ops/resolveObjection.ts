// RF-10 (004) · 10.4, RF-12 (004) · 12.6, RNF-1 (004), D-T4 (004) · Dar por resuelta una objeción propia, con o sin la
// revisión que la atiende (`resolvedByRevision` puede ser nulo). Solo quien objetó; libera su postura para poder acordar.
import { Timestamp } from 'firebase-admin/firestore';
import { canTransitionObjection, type ObjectionStatus } from '../../../shared/domain/constitution';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readOpenAmendment, recordEvent } from '../amendmentStore';
import { readId } from './apiceInput';

/** Cierra la objeción propia como `resolved` o `withdrawn`; lo comparten `resolveObjection` y `withdrawObjection`. */
export async function closeOwnObjection(
  ctx: Ctx,
  payload: Record<string, unknown>,
  uid: string | null,
  to: 'resolved' | 'withdrawn',
): Promise<Record<string, never>> {
  if (uid === null) throw new ApiError('unauthenticated');
  const amendmentId = readId({ id: payload['amendmentId'] });
  const objectionId = readId({ id: payload['objectionId'] });
  const given = payload['resolvedByRevision'];
  if (to === 'withdrawn' && given !== undefined && given !== null) throw new ApiError('invalid-request');
  if (given !== undefined && given !== null && (typeof given !== 'number' || !Number.isInteger(given) || given < 1)) throw new ApiError('invalid-request');
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${uid}`));
    if (!account.exists) throw new ApiError('forbidden');
    if (account.get('status') !== 'active') throw new ApiError('account-suspended');
    const open = await readOpenAmendment(ctx, tx, amendmentId);
    const objectionRef = open.ref.collection('objections').doc(objectionId);
    const stanceRef = open.ref.collection('stances').doc(uid);
    const [objection, stance] = await Promise.all([tx.get(objectionRef), tx.get(stanceRef)]);
    if (!objection.exists) throw new ApiError('invalid-request');
    if (objection.get('uid') !== uid) throw new ApiError('forbidden');
    if (!canTransitionObjection(objection.get('status') as ObjectionStatus, to)) throw new ApiError('invalid-request');
    if (typeof given === 'number' && given > open.amendment.revisionNo) throw new ApiError('invalid-request');
    tx.update(objectionRef, {
      status: to,
      closedAt: Timestamp.fromDate(ctx.now()),
      resolvedByRevision: to === 'resolved' && typeof given === 'number' ? given : null,
      closedBy: 'author',
    });
    if (stance.exists && stance.get('openObjectionId') === objectionId) tx.update(stanceRef, { openObjectionId: null });
    recordEvent(ctx, tx, open, {
      kind: to === 'resolved' ? 'objection-resolved' : 'objection-withdrawn',
      actor: { uid, username: account.get('username') as string },
      detail: { objectionId },
    });
  });
  return {};
}

export const handleResolveObjection = (ctx: Ctx, payload: Record<string, unknown>, uid: string | null) =>
  closeOwnObjection(ctx, payload, uid, 'resolved');
