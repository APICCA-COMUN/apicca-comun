// RF-11 (004) · 11.1, 11.3, RF-12 (004) · 12.6, RNF-1 (004), D-T4 (004) · Revocar el acuerdo con una propuesta abierta.
// Sin acuerdo vigente no hace nada; quien propuso no tiene documento de postura y no revoca.
import { canTransitionAgreement, type AgreementState } from '../../../shared/domain/constitution';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readOpenAmendment, recordEvent } from '../amendmentStore';
import { readId } from './apiceInput';

export async function handleRevokeAgreement(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  if (uid === null) throw new ApiError('unauthenticated');
  const amendmentId = readId({ id: payload['amendmentId'] });
  await ctx.db.runTransaction(async (tx) => {
    const account = await tx.get(ctx.db.doc(`accounts/${uid}`));
    if (!account.exists) throw new ApiError('forbidden');
    if (account.get('status') !== 'active') throw new ApiError('account-suspended');
    const open = await readOpenAmendment(ctx, tx, amendmentId);
    if (open.amendment.authorUid === uid) throw new ApiError('own-amendment');
    const stanceRef = open.ref.collection('stances').doc(uid);
    const stance = await tx.get(stanceRef);
    const from = (stance.get('agreement') as AgreementState | undefined) ?? 'none';
    if (from !== 'active' || !canTransitionAgreement(from, 'revoked')) return;
    tx.update(stanceRef, { agreement: 'revoked' });
    recordEvent(ctx, tx, open, { kind: 'agreement-revoked', actor: { uid, username: account.get('username') as string } });
  });
  return {};
}
