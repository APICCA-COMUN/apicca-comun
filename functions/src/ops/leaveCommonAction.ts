// RF-3 (010) · 3.1, RNF-5 (010), D-T3 (010) · Retirarse de una Acción Común; la autora no se retira mientras siga abierta.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { canLeave } from '../../../shared/domain/commonActions';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { takeDailySlot } from '../rateLimit';
import { actionRef, readAction, readActionId } from './commonActionInput';

export async function handleLeaveCommonAction(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ participantCount: number }> {
  const actor = await requireActor(ctx, uid);
  const ref = actionRef(ctx, readActionId(payload));
  return ctx.db.runTransaction(async (tx) => {
    const { data } = await readAction(tx, ref);
    if (!data.participantUids.includes(actor.uid)) return { participantCount: data.participantCount };
    if (data.status === 'archivada') throw new ApiError('action-archived');
    if (!canLeave(actor, data)) throw new ApiError('author-cannot-leave');
    const participant = await tx.get(ref.collection('participants').doc(actor.uid));
    const charge = await takeDailySlot(ctx, tx, 'edit', actor.uid);
    charge();
    // Una participación suspendida ya no cuenta en `participantCount` (D-T6 (010)).
    const counted = participant.exists && participant.get('suspended') !== true;
    tx.update(ref, {
      participantUids: FieldValue.arrayRemove(actor.uid),
      ...(counted ? { participantCount: FieldValue.increment(-1) } : {}),
      updatedAt: Timestamp.fromDate(ctx.now()),
    });
    tx.delete(ref.collection('participants').doc(actor.uid));
    return { participantCount: data.participantCount - (counted ? 1 : 0) };
  });
}
