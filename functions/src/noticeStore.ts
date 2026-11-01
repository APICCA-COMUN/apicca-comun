// RF-1 (012) · Avisos de cambios en un ápice: `notices/{uid}/items/{apiceId}_{actorUid}_{type}` (D-T2 (012)).
// El id determinista reúne las ediciones seguidas de una misma persona y deja el aviso con la fecha nueva.
import type { Transaction } from 'firebase-admin/firestore';
import type { Ctx } from './context';

export interface ApiceNoticeInput {
  type: 'apice-editado' | 'apice-archivado';
  apiceId: string;
  apiceName: string;
  authorUid: string;
  actorUid: string;
  actorUsername: string;
  at: Date;
}

/** Escribe el aviso para la autora; no hace nada si actúa ella misma (RF-1 (012) · 1.1). */
export function writeApiceNotice(tx: Transaction, ctx: Ctx, input: ApiceNoticeInput): void {
  if (input.actorUid === input.authorUid) return;
  tx.set(ctx.db.doc(`notices/${input.authorUid}/items/${input.apiceId}_${input.actorUid}_${input.type}`), {
    type: input.type,
    apiceId: input.apiceId,
    apiceName: input.apiceName,
    actorUsername: input.actorUsername,
    createdAt: input.at,
  });
}
