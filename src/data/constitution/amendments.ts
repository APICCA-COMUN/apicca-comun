// RF-7 (004) · 7.1 a 7.4, RF-8 (004) · 8.2, RF-9 (004) · 9.1, 9.2, RF-10 (004) · 10.1, RF-11 (004) · 11.1 · Lectura de las
// propuestas de cambio: listas, detalle con revisiones, deliberación, posturas y objeciones. Solo las cuentas activas
// leen `amendments` (RF-9 (004) · 9.4, D-T15 (004)); la fuente se recibe por props para probarse con dobles.
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  closedAmendmentsQuery,
  openAmendmentsQuery,
  type Amendment,
  type AmendmentKind,
  type AmendmentResult,
  type AgreementState,
  type CloseReason,
  type Objection,
  type ObjectionStatus,
  type Stance,
} from '../../../shared/domain/constitution';
import type { QueryShape } from '../../../shared/domain/discovery';
import { firebase } from '../firebase';
import { bool, msOr, num, numOrNull, text, textOrNull, toMs, type DocLike, type Unsubscribe } from './read';

export type { Unsubscribe } from './read';

/** Contenido anterior a una revisión (`revisions/{n}`): lo que había antes de que `revisionNo` subiera (RF-8 (004) · 8.2). */
export interface AmendmentRevision {
  revisionNo: number;
  title: string;
  text: string;
  motive: string;
  at: number;
}

/** Comentario de la deliberación. Archivado conserva su texto y lleva el marcador de quién lo archivó (RF-9 (004) · 9.2). */
export interface AmendmentComment {
  id: string;
  text: string;
  authorUid: string;
  authorUsername: string;
  createdAt: number;
  editedAt: number | null;
  version: number;
  archived: boolean;
  archivedBy: string | null;
  archivedByUsername: string | null;
  archivedAt: number | null;
}

/** Marca opaca de dónde seguir; `null` en una tanda dice que no hay más. */
export type ClosedCursor = QueryDocumentSnapshot;

export interface ClosedPage {
  items: Amendment[];
  cursor: ClosedCursor | null;
}

export interface AmendmentsSource {
  /** Las abiertas, por cierre más próximo (RF-7 (004) · 7.1). */
  onOpen(callback: (amendments: Amendment[]) => void, onError?: () => void): Unsubscribe;
  /** Las cerradas, de 20 en 20, de la más reciente a la más antigua (RF-7 (004) · 7.2). */
  fetchClosedPage(request: { cursor?: ClosedCursor | null }): Promise<ClosedPage>;
  /** `null` si no existe o si las reglas no dejan leerla. */
  onAmendment(id: string, callback: (amendment: Amendment | null) => void): Unsubscribe;
  /** De la revisión más reciente a la primera. */
  onRevisions(id: string, callback: (revisions: AmendmentRevision[]) => void, onError?: () => void): Unsubscribe;
  /** En orden de llegada, con los archivados marcados. */
  onComments(id: string, callback: (comments: AmendmentComment[]) => void, onError?: () => void): Unsubscribe;
  onStances(id: string, callback: (stances: Stance[]) => void, onError?: () => void): Unsubscribe;
  /** En orden de apertura. */
  onObjections(id: string, callback: (objections: Objection[]) => void, onError?: () => void): Unsubscribe;
}

export function readAmendment(row: DocLike): Amendment {
  const data = row.data() ?? {};
  return {
    id: row.id,
    kind: text(data['kind']) as AmendmentKind,
    sectionId: textOrNull(data['sectionId']),
    after: textOrNull(data['after']),
    slotKey: text(data['slotKey']),
    title: text(data['title']),
    text: text(data['text']),
    motive: text(data['motive']),
    revisionNo: num(data['revisionNo'], 1),
    baseSectionVersion: numOrNull(data['baseSectionVersion']),
    authorUid: text(data['authorUid']),
    authorUsername: text(data['authorUsername']),
    authorSuspended: bool(data['authorSuspended']),
    openedAt: msOr(data['openedAt']),
    closesAt: msOr(data['closesAt']),
    extended: bool(data['extended']),
    isOpen: bool(data['isOpen']),
    result: textOrNull(data['result']) as AmendmentResult | null,
    reasons: Array.isArray(data['reasons']) ? (data['reasons'] as CloseReason[]) : [],
    closedAt: toMs(data['closedAt']),
    agreementsCounted: num(data['agreementsCounted']),
    objectionsResolved: num(data['objectionsResolved']),
    objectionsWithdrawn: num(data['objectionsWithdrawn']),
    newSectionId: textOrNull(data['newSectionId']),
  };
}

function readRevision(row: DocLike): AmendmentRevision {
  const data = row.data() ?? {};
  return { revisionNo: num(data['revisionNo'], Number(row.id)), title: text(data['title']), text: text(data['text']), motive: text(data['motive']), at: msOr(data['at']) };
}

function readComment(row: DocLike): AmendmentComment {
  const data = row.data() ?? {};
  return {
    id: row.id,
    text: text(data['text']),
    authorUid: text(data['authorUid']),
    authorUsername: text(data['authorUsername']),
    createdAt: msOr(data['createdAt']),
    editedAt: toMs(data['editedAt']),
    version: num(data['version'], 1),
    archived: bool(data['archived']),
    archivedBy: textOrNull(data['archivedBy']),
    archivedByUsername: textOrNull(data['archivedByUsername']),
    archivedAt: toMs(data['archivedAt']),
  };
}

function readStance(row: DocLike): Stance {
  const data = row.data() ?? {};
  return {
    uid: row.id,
    username: text(data['username']),
    agreement: (textOrNull(data['agreement']) ?? 'none') as AgreementState,
    agreedAtRevision: numOrNull(data['agreedAtRevision']),
    agreedAt: toMs(data['agreedAt']),
    openObjectionId: textOrNull(data['openObjectionId']),
    withdrawnReason: data['withdrawnReason'] === 'inactive' ? 'inactive' : null,
  };
}

function readObjection(row: DocLike): Objection {
  const data = row.data() ?? {};
  return {
    id: row.id,
    uid: text(data['uid']),
    username: text(data['username']),
    reason: text(data['reason']),
    status: (textOrNull(data['status']) ?? 'open') as ObjectionStatus,
    openedAt: msOr(data['openedAt']),
    closedAt: toMs(data['closedAt']),
    resolvedByRevision: numOrNull(data['resolvedByRevision']),
    closedBy: data['closedBy'] === 'author' || data['closedBy'] === 'inactive' ? data['closedBy'] : null,
  };
}

/** De una `QueryShape` del dominio al objeto de consulta del SDK; `extra` agrega el cursor. */
function build(db: Firestore, shape: QueryShape, extra: ReturnType<typeof startAfter>[] = [], overLimit = 0) {
  return query(
    collection(db, shape.collection),
    ...shape.conditions.map((c) => where(c.field, c.op, c.value)),
    orderBy(shape.orderBy.field, shape.orderBy.direction),
    ...extra,
    ...(shape.limit === undefined ? [] : [limit(shape.limit + overLimit)]),
  );
}

/** Fuente real sobre una base; las pruebas la arman con un doble de `firebase/firestore`. */
export function createAmendmentsSource(db: Firestore): AmendmentsSource {
  const sub = (id: string, name: string) => collection(db, 'amendments', id, name);
  return {
    onOpen: (callback, onError) =>
      onSnapshot(build(db, openAmendmentsQuery()), (s) => callback(s.docs.map(readAmendment)), () => onError?.()),
    async fetchClosedPage({ cursor }) {
      const shape = closedAmendmentsQuery();
      const size = shape.limit ?? 20;
      // Una más que la tanda: así se sabe si queda otra sin leer de más.
      const snapshot = await getDocs(build(db, shape, cursor ? [startAfter(cursor)] : [], 1));
      const docs = snapshot.docs.slice(0, size);
      return { items: docs.map(readAmendment), cursor: snapshot.docs.length > size ? (docs[docs.length - 1] ?? null) : null };
    },
    onAmendment: (id, callback) =>
      onSnapshot(
        doc(db, 'amendments', id),
        (s) => callback(s.exists() ? readAmendment({ id: s.id, data: () => s.data() }) : null),
        () => callback(null),
      ),
    onRevisions: (id, callback, onError) =>
      onSnapshot(query(sub(id, 'revisions'), orderBy('revisionNo', 'desc')), (s) => callback(s.docs.map(readRevision)), () => onError?.()),
    onComments: (id, callback, onError) =>
      onSnapshot(query(sub(id, 'comments'), orderBy('createdAt', 'asc')), (s) => callback(s.docs.map(readComment)), () => onError?.()),
    onStances: (id, callback, onError) => onSnapshot(sub(id, 'stances'), (s) => callback(s.docs.map(readStance)), () => onError?.()),
    onObjections: (id, callback, onError) =>
      onSnapshot(query(sub(id, 'objections'), orderBy('openedAt', 'asc')), (s) => callback(s.docs.map(readObjection)), () => onError?.()),
  };
}

export const firestoreAmendmentsSource: AmendmentsSource = {
  onOpen: (cb, err) => createAmendmentsSource(firebase().db).onOpen(cb, err),
  fetchClosedPage: (request) => createAmendmentsSource(firebase().db).fetchClosedPage(request),
  onAmendment: (id, cb) => createAmendmentsSource(firebase().db).onAmendment(id, cb),
  onRevisions: (id, cb, err) => createAmendmentsSource(firebase().db).onRevisions(id, cb, err),
  onComments: (id, cb, err) => createAmendmentsSource(firebase().db).onComments(id, cb, err),
  onStances: (id, cb, err) => createAmendmentsSource(firebase().db).onStances(id, cb, err),
  onObjections: (id, cb, err) => createAmendmentsSource(firebase().db).onObjections(id, cb, err),
};
