// RF-8 (004) · 8.1, 8.2, 8.4, RF-14 (004) · 14.4, RF-17 (004) · 17.2, RNF-1 (004) · Revisar una propuesta propia y abierta
// (D-T10 (004)). Guarda el contenido anterior en `revisions/{n}`, sube `revisionNo` y no toca las posturas: los acuerdos
// previos quedan «anteriores a la revisión n» porque su `agreedAtRevision` es menor. Con otra base responde el conflicto.
import { Timestamp } from 'firebase-admin/firestore';
import { checkProposedContent } from '../../../shared/domain/constitution';
import { requireActor } from '../access';
import { readOpenAmendment, recordEvent } from '../amendmentStore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId, readInteger } from './apiceInput';
import { readReason, readText, readTitle } from './constitutionInput';

export interface AmendmentContent {
  revisionNo: number;
  title: string;
  text: string;
  motive: string;
}

export type ReviseAmendmentResult = { ok: true; revisionNo: number } | { ok: false; conflict: true; current: AmendmentContent };

export async function handleReviseAmendment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<ReviseAmendmentResult> {
  const actor = await requireActor(ctx, uid);
  const id = readId({ id: payload['amendmentId'] });
  const baseRevision = readInteger(payload, 'baseRevision');
  const motive = readReason(payload['motive']);
  const proposed = payload['title'] === undefined && payload['text'] === undefined ? null : { title: readTitle(payload['title'], 'section'), text: readText(payload['text'], 'section') };
  return ctx.db.runTransaction(async (tx): Promise<ReviseAmendmentResult> => {
    const account = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (account.get('status') !== 'active') throw new ApiError('account-suspended');
    const open = await readOpenAmendment(ctx, tx, id);
    const { amendment } = open;
    if (amendment.authorUid !== actor.uid) throw new ApiError('not-amendment-author');
    const previous: AmendmentContent = { revisionNo: amendment.revisionNo, title: amendment.title, text: amendment.text, motive: amendment.motive };
    if (previous.revisionNo !== baseRevision) return { ok: false, conflict: true, current: previous };
    // Quitar no tiene texto propio: solo se revisa el motivo.
    if (amendment.kind !== 'remove' && proposed === null) throw new ApiError('invalid-request');
    const next = amendment.kind === 'remove' || proposed === null ? { title: amendment.title, text: amendment.text } : proposed;
    if (amendment.kind === 'change' && amendment.sectionId !== null) {
      const section = await tx.get(ctx.db.doc(`constitutionSections/${amendment.sectionId}`));
      const current = section.exists ? { title: section.get('title') as string, text: section.get('text') as string } : null;
      if (!checkProposedContent('change', current, next).ok) throw new ApiError('amendment-unchanged');
    }
    const revisionNo = previous.revisionNo + 1;
    tx.create(open.ref.collection('revisions').doc(String(previous.revisionNo)), { ...previous, at: Timestamp.fromDate(ctx.now()) });
    tx.update(open.ref, { title: next.title, text: next.text, motive, revisionNo });
    recordEvent(ctx, tx, open, { kind: 'revised', actor: { uid: actor.uid, username: actor.username }, detail: { revisionNo } });
    return { ok: true, revisionNo };
  });
}
