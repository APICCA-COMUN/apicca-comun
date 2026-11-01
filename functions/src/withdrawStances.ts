// RF-14 (004) · 14.1, RNF-1 (004), D-T9 (004) · Retiro de las posturas de una persona que deja de estar activa.
// `planStanceWithdrawals` solo lee (propuestas abiertas, sus posturas con `getAll` y sus objeciones abiertas) y devuelve
// el plan; `applyStanceWithdrawals` solo escribe. Así quien llama (`suspendAccount`) respeta lecturas antes de escrituras.
// Por propuesta se escribe a lo sumo: postura, objeción, evento y contador `eventSeq` (4 escrituras).
import { Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { canTransitionAgreement, canTransitionObjection, type AgreementState, type ObjectionStatus } from '../../shared/domain/constitution';
import { toAmendment, recordEvent, type EventActor, type OpenAmendment } from './amendmentStore';
import type { Ctx } from './context';

/** Retiro previsto en una propuesta: lo que se escribe en su postura, su objeción y su registro. */
export interface StanceWithdrawal {
  open: OpenAmendment;
  stanceRef: DocumentReference;
  stanceUpdate: Record<string, unknown>;
  objectionRef: DocumentReference | null;
  objectionUpdate: Record<string, unknown> | null;
  detail: Record<string, string | number | boolean | null>;
}

export interface WithdrawalPlan {
  subjectUid: string;
  withdrawals: StanceWithdrawal[];
  /** Propuestas abiertas de `subjectUid`: se marcan con `authorSuspended` (RF-14 (004) · 14.7). */
  authoredRefs: DocumentReference[];
  /** Escrituras que producirá el plan: por propuesta, postura + (objeción) + evento + contador. */
  writeCount: number;
}

/** Lee las propuestas abiertas y las posturas de `uid`; no escribe nada. */
export async function planStanceWithdrawals(ctx: Ctx, tx: Transaction, uid: string, username: string): Promise<WithdrawalPlan> {
  const opens = await tx.get(ctx.db.collection('amendments').where('isOpen', '==', true));
  const stanceRefs = opens.docs.map((doc) => doc.ref.collection('stances').doc(uid));
  const stances = stanceRefs.length === 0 ? [] : await tx.getAll(...stanceRefs);
  const pending: { index: number; objectionRef: DocumentReference }[] = [];
  stances.forEach((stance, index) => {
    const objectionId = stance.exists ? (stance.get('openObjectionId') as string | null | undefined) : null;
    if (typeof objectionId === 'string') pending.push({ index, objectionRef: opens.docs[index]!.ref.collection('objections').doc(objectionId) });
  });
  const objections = pending.length === 0 ? [] : await tx.getAll(...pending.map((item) => item.objectionRef));
  const objectionAt = new Map<number, { ref: DocumentReference; status: ObjectionStatus | null }>();
  pending.forEach((item, position) => {
    const snap = objections[position]!;
    objectionAt.set(item.index, { ref: item.objectionRef, status: snap.exists ? (snap.get('status') as ObjectionStatus) : null });
  });
  const at = Timestamp.fromDate(ctx.now());
  const withdrawals: StanceWithdrawal[] = [];
  let writeCount = 0;
  opens.docs.forEach((doc, index) => {
    const stance = stances[index]!;
    if (!stance.exists) return;
    const agreement = (stance.get('agreement') as AgreementState | undefined) ?? 'none';
    const withdrawsAgreement = canTransitionAgreement(agreement, 'withdrawn') && agreement === 'active';
    const found = objectionAt.get(index);
    const withdrawsObjection = found !== undefined && found.status !== null && canTransitionObjection(found.status, 'withdrawn');
    const stanceHasLink = typeof stance.get('openObjectionId') === 'string';
    if (!withdrawsAgreement && !withdrawsObjection && !stanceHasLink) return;
    const data = doc.data();
    const stanceUpdate: Record<string, unknown> = {};
    if (withdrawsAgreement) Object.assign(stanceUpdate, { agreement: 'withdrawn', withdrawnReason: 'inactive' });
    if (stanceHasLink) stanceUpdate['openObjectionId'] = null;
    withdrawals.push({
      open: { amendment: toAmendment(doc.id, data), eventSeq: typeof data['eventSeq'] === 'number' ? data['eventSeq'] : 0, ref: doc.ref },
      stanceRef: stanceRefs[index]!,
      stanceUpdate,
      objectionRef: withdrawsObjection ? found.ref : null,
      objectionUpdate: withdrawsObjection ? { status: 'withdrawn', closedAt: at, resolvedByRevision: null, closedBy: 'inactive' } : null,
      detail: {
        subjectUid: uid,
        subjectUsername: username,
        agreementWithdrawn: withdrawsAgreement,
        objectionWithdrawn: withdrawsObjection,
      },
    });
    writeCount += 3 + (withdrawsObjection ? 1 : 0);
  });
  const authoredRefs = opens.docs.filter((doc) => doc.get('authorUid') === uid).map((doc) => doc.ref);
  return { subjectUid: uid, withdrawals, authoredRefs, writeCount: writeCount + authoredRefs.length };
}

/** Escribe el plan: postura, objeción y un evento por propuesta, con quién (`actor`) y cuándo. Solo escribe. */
export function applyStanceWithdrawals(ctx: Ctx, tx: Transaction, plan: WithdrawalPlan, actor: EventActor): void {
  for (const ref of plan.authoredRefs) tx.update(ref, { authorSuspended: true });
  for (const item of plan.withdrawals) {
    tx.update(item.stanceRef, item.stanceUpdate);
    if (item.objectionRef !== null && item.objectionUpdate !== null) tx.update(item.objectionRef, item.objectionUpdate);
    recordEvent(ctx, tx, item.open, { kind: 'stance-withdrawn-inactive', actor, detail: item.detail });
  }
}
