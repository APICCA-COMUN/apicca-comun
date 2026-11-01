// RF-13 (001), RF-14 (001) · Cambios de bandera de un ápice (visibilidad, archivo) con su evento inmutable (D-T19 (001)).
import type { ApiceAccessState, ApiceViewer } from '../../../shared/domain/access';
import { writeApiceNotice } from '../noticeStore';
import { requireActor, type Actor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId } from './apiceInput';

export interface FlagChange {
  type: 'visibility' | 'archive' | 'restore';
  /** Lanza si la persona no puede; recibe el estado ya leído dentro de la transacción. */
  check: (viewer: ApiceViewer, apice: ApiceAccessState) => void;
  /** Campos a escribir, o `null` si el ápice ya está como se pide (idempotente, sin evento). */
  update: (apice: Record<string, unknown>, actor: Actor, at: Date) => Record<string, unknown> | null;
  detail: (apice: Record<string, unknown>) => Record<string, unknown>;
}

/** Transacción: relee la cuenta, lee el ápice, valida permiso, aplica el cambio y registra el evento. */
export async function changeApiceFlag(ctx: Ctx, payload: Record<string, unknown>, uid: string | null, change: FlagChange): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const id = readId(payload);
  await ctx.db.runTransaction(async (tx) => {
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    if (accountSnap.data()?.['status'] !== 'active') throw new ApiError('account-suspended');
    const ref = ctx.db.doc(`apices/${id}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('invalid-request');
    const apice = snap.data() as Record<string, unknown>;
    change.check(
      { uid: actor.uid, role: actor.role, status: actor.status },
      {
        visibility: apice['visibility'] as ApiceAccessState['visibility'],
        isArchived: apice['isArchived'] === true,
        authorUid: apice['authorUid'] as string,
      },
    );
    const at = ctx.now();
    const fields = change.update(apice, actor, at);
    if (fields === null) return;
    tx.update(ref, fields);
    const eventId = Buffer.from(ctx.random(15)).toString('base64url');
    tx.set(ctx.db.doc(`apices/${id}/events/${eventId}`), {
      type: change.type,
      byUid: actor.uid,
      byUsername: actor.username,
      at,
      detail: change.detail(apice),
    });
    if (change.type === 'archive') {
      writeApiceNotice(tx, ctx, {
        type: 'apice-archivado',
        apiceId: id,
        apiceName: apice['name'] as string,
        authorUid: apice['authorUid'] as string,
        actorUid: actor.uid,
        actorUsername: actor.username,
        at,
      });
    }
  });
  return {};
}
