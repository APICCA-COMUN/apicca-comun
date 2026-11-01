// RF-4 (004) · 4.3, 4.5, 4.6, RNF-1 (004) · Abrir la constitución en una sola transacción (D-T11 (004)):
// la primera versión de cada sección con autoría «texto inicial», el registro de la apertura e `isOpen`. La segunda
// apertura relee `isOpen` dentro de su transacción y falla; no hay op que vuelva a cerrarla.
import { INITIAL_AUTHOR, type SectionMeta } from '../../../shared/domain/constitution';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';

export async function handleOpenConstitution(ctx: Ctx, _payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireFacilitator(ctx, uid);
  await ctx.db.runTransaction(async (tx) => {
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (accountSnap.data()?.['status'] !== 'active') throw new ApiError('account-suspended');
    const stateRef = ctx.db.doc('constitution/state');
    const state = (await tx.get(stateRef)).data() ?? {};
    if (state['isOpen'] === true) throw new ApiError('constitution-already-open');
    const order = Array.isArray(state['order']) ? (state['order'] as string[]) : [];
    const sections = order.length === 0 ? [] : await tx.getAll(...order.map((id) => ctx.db.doc(`constitutionSections/${id}`)));
    const at = ctx.now();
    const meta: SectionMeta = { version: 1, proposedByUid: null, proposedByUsername: INITIAL_AUTHOR, openAmendment: null };
    for (const snap of sections) {
      if (!snap.exists) continue;
      const section = snap.data() as Record<string, unknown>;
      tx.set(snap.ref.collection('versions').doc('1'), {
        version: 1,
        title: section['title'],
        text: section['text'],
        kind: 'initial',
        amendmentId: null,
        proposedByUid: null,
        proposedByUsername: INITIAL_AUTHOR,
        agreementsCounted: 0,
        authorAgreementCounted: false,
        objectionsResolved: 0,
        objectionsWithdrawn: 0,
        at,
      });
      tx.set(snap.ref.collection('private').doc('meta'), meta);
      tx.update(snap.ref, { updatedAt: at });
    }
    const seq = (typeof state['logSeq'] === 'number' ? state['logSeq'] : 0) + 1;
    tx.set(ctx.db.doc(`constitutionLog/${seq}`), {
      seq,
      kind: 'opened',
      sectionId: null,
      sectionTitle: null,
      version: null,
      amendmentId: null,
      byUid: actor.uid,
      byUsername: actor.username,
      at,
    });
    tx.set(stateRef, { isOpen: true, openedAt: at, order, updatedAt: at, logSeq: seq });
  });
  return {};
}
