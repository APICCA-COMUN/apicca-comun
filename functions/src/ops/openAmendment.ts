// RF-6 (004) · 6.1 a 6.6, RF-16 (004) · 16.4, RNF-1 (004) · Abrir una propuesta de cambiar, añadir o quitar una sección
// (D-T1 (004), D-T5 (004), D-T17 (004)). En una transacción: lee cuenta, estado, sección, cerradura y el conteo de abiertas; luego escribe
// la propuesta, el evento 1, la cerradura y, al cambiar o quitar, la marca `private/meta.openAmendment` de la sección.
// Con la cerradura ocupada responde `{ ok: false, taken: true, amendmentId }` para enlazar a la abierta (RF-6 (004) · 6.5).
import { Timestamp } from 'firebase-admin/firestore';
import { checkProposedContent, dueAt, slotKeyOf, CONSTITUTION_LIMITS } from '../../../shared/domain/constitution';
import { requireActor } from '../access';
import { appendEvent, takeSlot } from '../amendmentStore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';
import { readReason, readText, readTitle } from './constitutionInput';

export type OpenAmendmentResult = { ok: true; id: string } | { ok: false; taken: true; amendmentId: string };

type Kind = 'change' | 'remove' | 'add';

export async function handleOpenAmendment(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<OpenAmendmentResult> {
  const actor = await requireActor(ctx, uid);
  const kind = payload['kind'];
  if (kind !== 'change' && kind !== 'remove' && kind !== 'add') throw new ApiError('invalid-request');
  const type: Kind = kind;
  const sectionId = type === 'add' ? null : readId({ id: payload['sectionId'] });
  const afterRaw = payload['after'];
  if (type === 'add' && afterRaw !== undefined && afterRaw !== null && typeof afterRaw !== 'string') throw new ApiError('invalid-request');
  const after = type === 'add' ? (typeof afterRaw === 'string' ? readId({ id: afterRaw }) : null) : null;
  const motive = readReason(payload['motive']);
  // Quitar no propone texto: la propuesta guarda el de la sección vigente para mostrarlo.
  const proposed = type === 'remove' ? null : { title: readTitle(payload['title'], 'section'), text: readText(payload['text'], 'section') };
  const slotKey = type === 'add' ? slotKeyOf({ kind: 'add', after }) : slotKeyOf({ kind: type, sectionId: sectionId as string });
  const targetId = type === 'add' ? after : sectionId;
  const ref = ctx.db.collection('amendments').doc();

  return ctx.db.runTransaction(async (tx): Promise<OpenAmendmentResult> => {
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (accountSnap.get('status') !== 'active') throw new ApiError('account-suspended');
    const state = await tx.get(ctx.db.doc('constitution/state'));
    if (state.get('isOpen') !== true) throw new ApiError('constitution-not-open');
    let current: { title: string; text: string } | null = null;
    let baseSectionVersion: number | null = null;
    const metaRef = targetId === null ? null : ctx.db.doc(`constitutionSections/${targetId}/private/meta`);
    if (targetId !== null && metaRef !== null) {
      const section = await tx.get(ctx.db.doc(`constitutionSections/${targetId}`));
      if (!section.exists) throw new ApiError('section-not-found');
      if (section.get('isRetired') === true) throw new ApiError('section-retired');
      current = { title: section.get('title') as string, text: section.get('text') as string };
      if (type !== 'add') baseSectionVersion = ((await tx.get(metaRef)).get('version') as number | undefined) ?? 1;
    }
    if (type === 'change' && proposed !== null) {
      if (!checkProposedContent('change', current, proposed).ok) throw new ApiError('amendment-unchanged');
    }
    const open = await tx.get(ctx.db.collection('amendments').where('isOpen', '==', true).count());
    if (open.data().count >= CONSTITUTION_LIMITS.openAmendments) throw new ApiError('amendment-limit');
    // `takeSlot` escribe al tomar la cerradura: va después de todas las lecturas.
    const slot = await takeSlot(ctx, tx, slotKey, ref.id);
    if (!slot.ok) return slot;

    const openedAt = ctx.now();
    const closesAt = Timestamp.fromMillis(dueAt(openedAt.getTime()));
    const content = proposed ?? (current as { title: string; text: string });
    tx.create(ref, {
      kind: type,
      sectionId,
      after,
      slotKey,
      title: content.title,
      text: content.text,
      motive,
      revisionNo: 1,
      baseSectionVersion,
      authorUid: actor.uid,
      authorUsername: actor.username,
      openedAt: Timestamp.fromDate(openedAt),
      closesAt,
      extended: false,
      isOpen: true,
      result: null,
      reasons: [],
      closedAt: null,
      agreementsCounted: 0,
      objectionsResolved: 0,
      objectionsWithdrawn: 0,
      newSectionId: null,
      eventSeq: 1,
    });
    appendEvent(ctx, tx, ref.id, 1, { kind: 'opened', actor: { uid: actor.uid, username: actor.username }, detail: { kind: type } });
    if (type !== 'add' && metaRef !== null) tx.set(metaRef, { openAmendment: { id: ref.id, kind: type, closesAt } }, { merge: true });
    return { ok: true, id: ref.id };
  });
}
