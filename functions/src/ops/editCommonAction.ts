// RF-7 (010) · 7.3, RF-4 (010) · 4.1, 4.2, RNF-5 (010), D-T3 (010) · Editar una Acción Común propia: título, descripción, eje
// y, si llegan, sus ápices. Cada edición guarda su versión en `versions/{n}` (Principio 6).
import { Timestamp } from 'firebase-admin/firestore';
import { canManage } from '../../../shared/domain/commonActions';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { takeDailySlot } from '../rateLimit';
import {
  actionRef,
  checkVisibleApices,
  readAction,
  readActionDescription,
  readActionId,
  readActionTitle,
  readApiceIds,
  readOptionalAxis,
  versionOf,
} from './commonActionInput';

export async function handleEditCommonAction(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ version: number }> {
  const actor = await requireActor(ctx, uid);
  const ref = actionRef(ctx, readActionId(payload));
  const title = readActionTitle(payload['title']);
  const description = readActionDescription(payload['description']);
  const axis = readOptionalAxis(payload['axis']);
  const newIds = payload['apiceIds'] === undefined ? null : readApiceIds(payload['apiceIds']);
  return ctx.db.runTransaction(async (tx) => {
    const { data } = await readAction(tx, ref);
    if (data.status === 'archivada') throw new ApiError('action-archived');
    if (!canManage(actor, data)) throw new ApiError('not-action-author');
    // Solo los ápices que se suman se comprueban: los que ya estaban siguen enlazados aunque hoy no se vean (RF-4 (010) · 4.3).
    if (newIds !== null) await checkVisibleApices(ctx, tx, actor, newIds.filter((id) => !data.apiceIds.includes(id)));
    const charge = await takeDailySlot(ctx, tx, 'edit', actor.uid);
    charge();
    const at = ctx.now();
    const version = data.version + 1;
    const next = { title, description, axis, apiceIds: newIds ?? data.apiceIds };
    tx.update(ref, { ...next, version, updatedAt: Timestamp.fromDate(at) });
    tx.create(ref.collection('versions').doc(String(version)), versionOf(next, actor.uid, at));
    return { version };
  });
}
