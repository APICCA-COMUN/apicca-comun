// RF-18 (001) · Aceptar la propuesta propia como imagen del ápice, con texto alternativo. Si el ápice cambió desde que se
// generó, avisa y pide confirmar (RF-16 (001)); la imagen anterior se conserva en `images/` (RNF-7 (001), RNF-6 (001)).
import { isProposalExpired, proposalWarnings, validateAltText, type ProposalWarning } from '../../../shared/domain/images';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { toDate } from '../generationStore';
import { readId } from './apiceInput';
import { assertCanChangeReferences, newId } from './mediaInput';

export type AcceptResult = { ok: true } | { ok: false; warnings: ProposalWarning[] };

export async function handleAcceptProposal(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<AcceptResult> {
  const actor = await requireActor(ctx, uid);
  const id = readId(payload);
  if (typeof payload['altText'] !== 'string') throw new ApiError('invalid-request');
  const alt = validateAltText(payload['altText']);
  if (!alt.ok) throw new ApiError(alt.code);
  const confirmed = payload['confirm'] === true;

  return ctx.db.runTransaction(async (tx): Promise<AcceptResult> => {
    const now = ctx.now();
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    const apiceRef = ctx.db.doc(`apices/${id}`);
    const apiceSnap = await tx.get(apiceRef);
    const proposalRef = ctx.db.doc(`proposals/${id}_${actor.uid}`);
    const proposalSnap = await tx.get(proposalRef);
    const references = apiceSnap.exists
      ? await tx.get(ctx.db.collection(`apices/${id}/references`).where('isRemoved', '==', false))
      : null;
    const previousId = (apiceSnap.data()?.['image'] as { id?: string } | null | undefined)?.id ?? null;
    const previousRef = previousId ? ctx.db.doc(`apices/${id}/images/${previousId}`) : null;
    const previousSnap = previousRef ? await tx.get(previousRef) : null;

    if (accountSnap.data()?.['status'] !== 'active') throw new ApiError('account-suspended');
    if (!apiceSnap.exists) throw new ApiError('invalid-request');
    const apice = apiceSnap.data() as Record<string, unknown>;
    assertCanChangeReferences(actor, apice);
    if (!proposalSnap.exists) throw new ApiError('proposal-not-found');
    const proposal = proposalSnap.data() as Record<string, unknown>;
    const createdAt = toDate(proposal['createdAt']);
    if (createdAt === null || isProposalExpired(createdAt, now)) throw new ApiError('proposal-expired');

    const warnings = proposalWarnings(
      {
        version: proposal['baseVersion'] as number,
        imageId: (proposal['baseImageId'] as string | null) ?? null,
        referenceIds: (proposal['referenceIds'] as string[] | undefined) ?? [],
      },
      { version: apice['version'] as number, imageId: previousId, activeReferenceIds: references?.docs.map((d) => d.id) ?? [] },
    );
    if (warnings.length > 0 && !confirmed) return { ok: false, warnings };

    const imageId = newId(ctx.random);
    const png = proposal['png'] as Buffer;
    tx.set(ctx.db.doc(`apices/${id}/images/${imageId}`), {
      png,
      altText: alt.value,
      acceptedByUid: actor.uid,
      acceptedByUsername: actor.username,
      acceptedAt: now,
      replacedAt: null,
      isRemoved: false,
      removal: null,
    });
    if (previousRef && previousSnap?.exists) tx.update(previousRef, { replacedAt: now });
    tx.update(apiceRef, { image: { id: imageId, altText: alt.value, png } });
    tx.delete(proposalRef);
    tx.set(ctx.db.doc(`apices/${id}/events/${newId(ctx.random)}`), {
      type: 'image-accepted',
      byUid: actor.uid,
      byUsername: actor.username,
      at: now,
      detail: { imageId },
    });
    return { ok: true };
  });
}
