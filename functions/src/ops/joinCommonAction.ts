// RF-2 (010) · 2.1, 2.2, RF-7 (010) · 7.2, RNF-5 (010), D-T3 (010) · Sumarse a una Acción Común abierta, una sola vez.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { canJoin } from '../../../shared/domain/commonActions';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { takeDailySlot } from '../rateLimit';
import { actionRef, readAction, readActionId } from './commonActionInput';

export async function handleJoinCommonAction(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ participantCount: number }> {
  const actor = await requireActor(ctx, uid);
  const ref = actionRef(ctx, readActionId(payload));
  return ctx.db.runTransaction(async (tx) => {
    const { data } = await readAction(tx, ref);
    // RF-2 (010) · 2.1: si ya participa, devuelve el estado actual sin cambiar nada.
    if (data.participantUids.includes(actor.uid)) return { participantCount: data.participantCount };
    if (!data.isListed && data.authorUid !== actor.uid) throw new ApiError('action-not-found');
    if (!canJoin(actor, data)) throw new ApiError('action-closed');
    const charge = await takeDailySlot(ctx, tx, 'edit', actor.uid);
    charge();
    const now = Timestamp.fromDate(ctx.now());
    tx.update(ref, { participantUids: FieldValue.arrayUnion(actor.uid), participantCount: FieldValue.increment(1), updatedAt: now });
    tx.set(ref.collection('participants').doc(actor.uid), { uid: actor.uid, username: actor.username, joinedAt: now, suspended: false });
    return { participantCount: data.participantCount + 1 };
  });
}
