// RF-1 (010) · 1.1–1.5, RF-4 (010) · 4.1, RNF-2 (010), RNF-5 (010), D-T3 (010) · Proponer una Acción Común: abierta, con su
// autoría, su fecha, su versión 1 y la autora como primera participante.
import { Timestamp } from 'firebase-admin/firestore';
import { COMMON_ACTION_LIMITS } from '../../../shared/domain/commonActions';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { takeDailySlot } from '../rateLimit';
import { checkVisibleApices, readActionDescription, readActionTitle, readApiceIds, readOptionalAxis, versionOf } from './commonActionInput';

export async function handleProposeCommonAction(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ id: string }> {
  const actor = await requireActor(ctx, uid);
  const title = readActionTitle(payload['title']);
  const description = readActionDescription(payload['description']);
  const axis = readOptionalAxis(payload['axis']);
  const apiceIds = readApiceIds(payload['apiceIds']);
  const ref = ctx.db.collection('commonActions').doc();
  await ctx.db.runTransaction(async (tx) => {
    // Lecturas primero: los ápices, el tope de abiertas (D-4 (010)) y el cupo diario.
    await checkVisibleApices(ctx, tx, actor, apiceIds);
    const open = await tx.get(
      ctx.db.collection('commonActions').where('authorUid', '==', actor.uid).where('status', '==', 'abierta').limit(COMMON_ACTION_LIMITS.openPerAuthor),
    );
    if (open.size >= COMMON_ACTION_LIMITS.openPerAuthor) throw new ApiError('action-limit');
    const charge = await takeDailySlot(ctx, tx, 'action', actor.uid);
    charge();
    const at = ctx.now();
    const now = Timestamp.fromDate(at);
    const data = { title, description, axis, apiceIds };
    tx.create(ref, {
      ...data,
      status: 'abierta',
      authorUid: actor.uid,
      authorUsername: actor.username,
      authorSuspended: false,
      isListed: true,
      participantUids: [actor.uid],
      participantCount: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    tx.create(ref.collection('participants').doc(actor.uid), { uid: actor.uid, username: actor.username, joinedAt: now, suspended: false });
    tx.create(ref.collection('versions').doc('1'), versionOf(data, actor.uid, at));
  });
  return { id: ref.id };
}
