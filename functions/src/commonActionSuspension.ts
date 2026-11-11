// RF-9 (010), D-T6 (010) · Lo que la suspensión cambia en las Acciones Comunes, sin borrar nada: las participaciones de la
// persona pasan a `suspended` y dejan de contar, y lo que propuso sale de la lista (`authorSuspended`, `isListed`). Reactivar
// lo deshace. Las lecturas van antes que las escrituras, como pide la transacción de `suspendAccount`.
import { FieldValue, type DocumentReference, type DocumentSnapshot, type Query, type QuerySnapshot, type Transaction } from 'firebase-admin/firestore';
import { isListed, type CommonActionDoc } from '../../shared/domain/commonActions';
import type { Ctx } from './context';

/** Una transacción o un lote: los dos actualizan un documento con sus campos. */
interface Writer {
  update(ref: DocumentReference, data: Record<string, unknown>): unknown;
}

export interface ActionSuspensionPlan {
  apply(writer: Writer): void;
}

interface Reader {
  query(query: Query): Promise<QuerySnapshot>;
  doc(ref: DocumentReference): Promise<DocumentSnapshot>;
}

async function plan(ctx: Ctx, uid: string, suspended: boolean, read: Reader): Promise<ActionSuspensionPlan> {
  const actions = ctx.db.collection('commonActions');
  const joined = await read.query(actions.where('participantUids', 'array-contains', uid));
  const authored = await read.query(actions.where('authorUid', '==', uid));
  const participants = await Promise.all(joined.docs.map((doc) => read.doc(doc.ref.collection('participants').doc(uid))));
  return {
    apply(writer) {
      const changes = new Map<string, Record<string, unknown>>();
      const change = (path: string) => changes.get(path) ?? changes.set(path, {}).get(path)!;
      joined.docs.forEach((doc, index) => {
        const entry = participants[index];
        if (entry === undefined || !entry.exists || entry.get('suspended') === suspended) return;
        writer.update(entry.ref, { suspended });
        change(doc.ref.path)['participantCount'] = FieldValue.increment(suspended ? -1 : 1);
      });
      for (const doc of authored.docs) {
        const data = doc.data() as CommonActionDoc;
        Object.assign(change(doc.ref.path), { authorSuspended: suspended, isListed: isListed({ ...data, authorSuspended: suspended }) });
      }
      for (const [path, fields] of changes) writer.update(ctx.db.doc(path), fields);
    },
  };
}

/** Dentro de la transacción de `suspendAccount`. */
export const planActionSuspension = (ctx: Ctx, tx: Transaction, uid: string): Promise<ActionSuspensionPlan> =>
  plan(ctx, uid, true, { query: (query) => tx.get(query), doc: (ref) => tx.get(ref) });

/** Para el lote de `reactivateAccount`. */
export const planActionReactivation = (ctx: Ctx, uid: string): Promise<ActionSuspensionPlan> => plan(ctx, uid, false, { query: (query) => query.get(), doc: (ref) => ref.get() });
