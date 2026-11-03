// RF-1 (009), RF-2 (009), RF-7 (009), D-T6 (009), RF-1 (017), RF-1 (018), D-T2 (018), D-T3 (018), D-T4 (018) · Lectura del foro: lista de hilos
// por tandas con filtro de eje y un hilo con su apertura y sus mensajes más recientes por páginas. Escribir es cosa de las ops. La fuente se recibe por props, como las demás.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where, type Firestore, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { AXES, type Axis } from '../../shared/domain/apice';
import { FORUM_LIMITS, type ThreadSummary } from '../../shared/domain/forum';
import { latestMessagesQuery, openingMessageQuery } from '../../shared/domain/forum/queries';
import type { QueryShape } from '../../shared/domain/discovery';
import { toMs } from './constitution/read';
import { firebase } from './firebase';

export interface ForumMessage {
  id: string;
  authorUid: string;
  authorUsername: string;
  text: string;
  createdAt: number;
  /** `null` si nunca se editó. */
  editedAt: number | null;
  isArchived: boolean;
  /** El mensaje de apertura solo se archiva junto con el hilo (RF-5 (009), D-T9 (009)). */
  isOpening: boolean;
}

export interface ForumThread extends ThreadSummary {
  authorUid: string;
  createdAt: number;
  isArchived: boolean;
}

export interface ThreadPage {
  threads: ThreadSummary[];
  /** Cursor opaco de la tanda siguiente; `null` si no hay más. */
  next: QueryDocumentSnapshot | null;
}

/** Una página de mensajes en orden cronológico (RF-1 (018) · 1.2, D-T3 (018)). */
export interface MessagePage {
  messages: ForumMessage[];
  /** Cursor opaco de la página anterior; `null` si no hay más. */
  before: QueryDocumentSnapshot | null;
}

export interface ThreadView extends MessagePage {
  thread: ForumThread;
  /** El mensaje de apertura; `null` si el hilo no tiene (datos inconsistentes) o no se pidieron mensajes. */
  opening: ForumMessage | null;
}

export interface ForumSource {
  fetchThreads(options: { axis: Axis | null; after?: QueryDocumentSnapshot | null }): Promise<ThreadPage>;
  /** `null` si el hilo no existe o no se puede leer (archivado, para quien no modera). */
  fetchThread(id: string, options: { includeArchived: boolean }): Promise<ThreadView | null>;
  /** La página de mensajes anterior a `before`, en orden cronológico y sin el de apertura (RF-1 (018) · 1.2). */
  fetchOlder(id: string, options: { includeArchived: boolean; before: QueryDocumentSnapshot }): Promise<MessagePage>;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isAxis = (v: unknown): v is Axis => typeof v === 'string' && (AXES as readonly string[]).includes(v);

function toSummary(id: string, data: Record<string, unknown>): ThreadSummary | null {
  const lastMessageAt = toMs(data['lastMessageAt']);
  const axis = data['axis'];
  if (lastMessageAt === null || !isAxis(axis)) return null;
  return {
    id,
    title: str(data['title']),
    axis,
    authorUsername: str(data['authorUsername']),
    lastMessageAt,
    messageCount: typeof data['messageCount'] === 'number' ? data['messageCount'] : 1,
  };
}

function toMessage(d: QueryDocumentSnapshot): ForumMessage[] {
  const m = d.data();
  const createdAt = toMs(m['createdAt']);
  if (createdAt === null) return [];
  return [{ id: d.id, authorUid: str(m['authorUid']), authorUsername: str(m['authorUsername']), text: str(m['text']), createdAt, editedAt: toMs(m['editedAt']), isArchived: m['isArchived'] === true, isOpening: m['isOpening'] === true }];
}

/** Hay anteriores si la página vino llena y no trajo la apertura, que es el mensaje más antiguo (D-T4 (018)). */
function olderCursor(docs: QueryDocumentSnapshot[], openingId: string | null): QueryDocumentSnapshot | null {
  const last = docs[docs.length - 1];
  const reachedOpening = docs.some((d) => d.id === openingId || d.data()['isOpening'] === true);
  return docs.length === FORUM_LIMITS.messagePageSize && last !== undefined && !reachedOpening ? last : null;
}

/** Las restricciones de Firestore de una forma declarada: el orden y el tope salen de ella, para que pida el índice que se generó. */
function constraintsOf(shape: QueryShape): QueryConstraint[] {
  return [...shape.conditions.map((c) => where(c.field, c.op, c.value)), orderBy(shape.orderBy.field, shape.orderBy.direction), ...(shape.limit === undefined ? [] : [limit(shape.limit)])];
}

export function createForumSource(db: Firestore): ForumSource {
  return {
    async fetchThreads({ axis, after }) {
      const constraints: QueryConstraint[] = [where('isArchived', '==', false)];
      if (axis !== null) constraints.push(where('axis', '==', axis));
      constraints.push(orderBy('lastMessageAt', 'desc'));
      if (after) constraints.push(startAfter(after));
      constraints.push(limit(FORUM_LIMITS.pageSize));
      const snap = await getDocs(query(collection(db, 'threads'), ...constraints));
      const threads = snap.docs.flatMap((d) => {
        const summary = toSummary(d.id, d.data());
        return summary === null ? [] : [summary];
      });
      const last = snap.docs[snap.docs.length - 1];
      return { threads, next: snap.docs.length === FORUM_LIMITS.pageSize && last !== undefined ? last : null };
    },
    async fetchThread(id, { includeArchived }) {
      let head;
      try {
        head = await getDoc(doc(db, 'threads', id));
      } catch (caught) {
        // Un hilo archivado ajeno se lee como inexistente; cualquier otro fallo se propaga (RF-1 (017) · 1.3, D-T2 (017)).
        if ((caught as { code?: string }).code === 'permission-denied') return null;
        throw caught;
      }
      if (!head.exists()) return null;
      const data = head.data();
      const summary = toSummary(id, data);
      if (summary === null) return null;
      const thread = { ...summary, authorUid: str(data['authorUid']), createdAt: toMs(data['createdAt']) ?? summary.lastMessageAt, isArchived: data['isArchived'] === true };
      // Sin moderar, un hilo archivado no se muestra: no se piden mensajes que las reglas negarían (RF-1 (017) · 1.3).
      if (thread.isArchived && !includeArchived) return { thread, opening: null, messages: [], before: null };
      const [openingSnap, latestSnap] = await Promise.all([
        getDocs(query(collection(db, 'threads', id, 'messages'), ...constraintsOf(openingMessageQuery({ includeArchived })))),
        getDocs(query(collection(db, 'threads', id, 'messages'), ...constraintsOf(latestMessagesQuery({ includeArchived })))),
      ]);
      const opening = openingSnap.docs.flatMap(toMessage)[0] ?? null;
      const messages = latestSnap.docs.flatMap(toMessage).reverse().filter((m) => m.id !== opening?.id);
      return { thread, opening, messages, before: olderCursor(latestSnap.docs, opening?.id ?? null) };
    },
    async fetchOlder(id, { includeArchived, before }) {
      const snap = await getDocs(query(collection(db, 'threads', id, 'messages'), ...constraintsOf(latestMessagesQuery({ includeArchived })), startAfter(before)));
      return { messages: snap.docs.flatMap(toMessage).reverse().filter((m) => !m.isOpening), before: olderCursor(snap.docs, null) };
    },
  };
}

export const firestoreForumSource: ForumSource = {
  fetchThreads: (options) => createForumSource(firebase().db).fetchThreads(options),
  fetchThread: (id, options) => createForumSource(firebase().db).fetchThread(id, options),
  fetchOlder: (id, options) => createForumSource(firebase().db).fetchOlder(id, options),
};
