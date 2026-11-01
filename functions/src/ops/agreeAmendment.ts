// RF-11 (004) · 11.1, 11.2, 11.3, RF-12 (004) · 12.6, RNF-1 (004), D-T4 (004) · Manifestar el acuerdo con una propuesta abierta.
// Una postura por persona (`stances/{uid}`): repetir el acuerdo no hace nada; quien propuso no tiene documento y no acuerda;
// una objeción abierta lo impide. Guarda la revisión vigente (`agreedAtRevision`) para saber qué acuerdos anteceden a una revisión.
import { Timestamp } from 'firebase-admin/firestore';
import { canTransitionAgreement, type AgreementState } from '../../../shared/domain/constitution';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readOpenAmendment, recordEvent } from '../amendmentStore';
import { readId } from './apiceInput';

export async function handleAgreeAmendment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
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
    if (from === 'active') return;
    if ((stance.get('openObjectionId') as string | null | undefined) != null) throw new ApiError('agree-with-objection');
    if (!canTransitionAgreement(from, 'active')) throw new ApiError('forbidden');
    const username = account.get('username') as string;
    tx.set(stanceRef, {
      username,
      agreement: 'active',
      agreedAtRevision: open.amendment.revisionNo,
      agreedAt: Timestamp.fromDate(ctx.now()),
      openObjectionId: null,
      withdrawnReason: null,
    });
    recordEvent(ctx, tx, open, { kind: 'agreed', actor: { uid, username }, detail: { revisionNo: open.amendment.revisionNo } });
  });
  return {};
}
