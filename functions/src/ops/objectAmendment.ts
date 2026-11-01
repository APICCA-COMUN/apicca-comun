// RF-10 (004) · 10.1, 10.2, 10.3, RF-16 (004) · 16.1, 16.2, RF-12 (004) · 12.6, RNF-1 (004), D-T4 (004) · Objetar una propuesta abierta.
// Una objeción abierta por persona; con un acuerdo vigente se pide revocarlo antes; quien propuso no objeta.
import { Timestamp } from 'firebase-admin/firestore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readOpenAmendment, recordEvent } from '../amendmentStore';
import { readId } from './apiceInput';
import { readReason } from './constitutionInput';

export async function handleObjectAmendment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ objectionId: string }> {
  if (uid === null) throw new ApiError('unauthenticated');
  const amendmentId = readId({ id: payload['amendmentId'] });
  const reason = readReason(payload['reason']);
  const objectionId = ctx.db.collection('amendments').doc().id;
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${uid}`));
    if (!account.exists) throw new ApiError('forbidden');
    if (account.get('status') !== 'active') throw new ApiError('account-suspended');
    const open = await readOpenAmendment(ctx, tx, amendmentId);
    if (open.amendment.authorUid === uid) throw new ApiError('own-amendment');
    const stanceRef = open.ref.collection('stances').doc(uid);
    const stance = await tx.get(stanceRef);
    if (stance.get('agreement') === 'active') throw new ApiError('object-with-agreement');
    if ((stance.get('openObjectionId') as string | null | undefined) != null) throw new ApiError('objection-already-open');
    const username = account.get('username') as string;
    const at = Timestamp.fromDate(ctx.now());
    tx.create(open.ref.collection('objections').doc(objectionId), {
      uid,
      username,
      reason,
      status: 'open',
      openedAt: at,
      closedAt: null,
      resolvedByRevision: null,
      closedBy: null,
    });
    if (stance.exists) tx.update(stanceRef, { openObjectionId: objectionId });
    else tx.set(stanceRef, { username, agreement: 'none', agreedAtRevision: null, agreedAt: null, openObjectionId: objectionId, withdrawnReason: null });
    recordEvent(ctx, tx, open, { kind: 'objected', actor: { uid, username } });
  });
  return { objectionId };
}
