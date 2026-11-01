// RF-1 (004) · 1.1 a 1.3, RF-2 (004) · 2.1 a 2.4, RF-3 (004) · 3.1, 3.2 · Lectura del estado, las secciones y sus
// historiales. Las reglas deciden (D-T15 (004)): el visitante pide solo `isRetired == false` y nunca lee `private`
// ni `versions` ni el registro; aquí ni siquiera lo intenta. La fuente se recibe por props para probarse con dobles.
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type {
  AmendmentKind,
  ConstitutionLogKind,
  ConstitutionState,
  Section,
  SectionMeta,
  SectionVersion,
  SectionVersionKind,
} from '../../../shared/domain/constitution';
import { firebase } from '../firebase';
import { bool, msOr, num, numOrNull, text, textOrNull, toMs, type DocLike, type ReaderAudience, type Unsubscribe } from './read';

export type { ReaderAudience, Unsubscribe } from './read';

/** Entrada del registro de cambios del conjunto (`constitutionLog/{seq}`, plan §5.3). */
export interface LogEntry {
  seq: number;
  kind: ConstitutionLogKind;
  /** Nulos en la entrada `opened`, que no es de una sección. */
  sectionId: string | null;
  sectionTitle: string | null;
  version: number | null;
  amendmentId: string | null;
  byUid: string | null;
  byUsername: string;
  at: number;
}

export interface SectionsSource {
  /** `null` si el estado aún no existe (antes de redactar el texto inicial). */
  onState(callback: (state: ConstitutionState | null) => void, onError?: () => void): Unsubscribe;
  /** Visitante: solo vigentes. Cuenta activa: también las retiradas. Sin orden; ordénalas con `orderSections`. */
  onSections(audience: ReaderAudience, callback: (sections: Section[]) => void, onError?: () => void): Unsubscribe;
  /** Autoría y propuesta abierta de una sección. El visitante no lee nada: recibe `null`. */
  onMeta(audience: ReaderAudience, sectionId: string, callback: (meta: SectionMeta | null) => void, onError?: () => void): Unsubscribe;
  /** Historial de una sección, de la versión más reciente a la primera. El visitante recibe lista vacía. */
  onVersions(audience: ReaderAudience, sectionId: string, callback: (versions: SectionVersion[]) => void, onError?: () => void): Unsubscribe;
  /** Historial del conjunto, del cambio más reciente al primero. El visitante recibe lista vacía. */
  onLog(audience: ReaderAudience, callback: (entries: LogEntry[]) => void, onError?: () => void): Unsubscribe;
}

/** Entradas del registro que pide una sola lectura; la constitución cambia despacio (RF-16 (004)). */
export const LOG_LIMIT = 500;

export function readState(data: Record<string, unknown> | undefined): ConstitutionState | null {
  if (data === undefined) return null;
  return {
    isOpen: bool(data['isOpen']),
    openedAt: toMs(data['openedAt']),
    order: Array.isArray(data['order']) ? data['order'].filter((id): id is string => typeof id === 'string') : [],
    updatedAt: msOr(data['updatedAt']),
    logSeq: num(data['logSeq']),
  };
}

export function readSection(row: DocLike): Section {
  const data = row.data() ?? {};
  return {
    id: row.id,
    title: text(data['title']),
    text: text(data['text']),
    updatedAt: msOr(data['updatedAt']),
    isRetired: bool(data['isRetired']),
    retiredAt: toMs(data['retiredAt']),
  };
}

function readMeta(data: Record<string, unknown> | undefined): SectionMeta | null {
  if (data === undefined) return null;
  const open = data['openAmendment'];
  const o = typeof open === 'object' && open !== null ? (open as Record<string, unknown>) : null;
  return {
    version: num(data['version']),
    proposedByUid: textOrNull(data['proposedByUid']),
    proposedByUsername: text(data['proposedByUsername']),
    openAmendment: o === null ? null : { id: text(o['id']), kind: text(o['kind']) as AmendmentKind, closesAt: msOr(o['closesAt']) },
  };
}

function readVersion(row: DocLike): SectionVersion {
  const data = row.data() ?? {};
  return {
    version: num(data['version'], Number(row.id)),
    title: text(data['title']),
    text: text(data['text']),
    kind: text(data['kind']) as SectionVersionKind,
    amendmentId: textOrNull(data['amendmentId']),
    proposedByUid: textOrNull(data['proposedByUid']),
    proposedByUsername: text(data['proposedByUsername']),
    agreementsCounted: num(data['agreementsCounted']),
    authorAgreementCounted: bool(data['authorAgreementCounted']),
    objectionsResolved: num(data['objectionsResolved']),
    objectionsWithdrawn: num(data['objectionsWithdrawn']),
    at: msOr(data['at']),
  };
}

function readLog(row: DocLike): LogEntry {
  const data = row.data() ?? {};
  return {
    seq: num(data['seq'], Number(row.id)),
    kind: text(data['kind']) as ConstitutionLogKind,
    sectionId: textOrNull(data['sectionId']),
    sectionTitle: textOrNull(data['sectionTitle']),
    version: numOrNull(data['version']),
    amendmentId: textOrNull(data['amendmentId']),
    byUid: textOrNull(data['byUid']),
    byUsername: text(data['byUsername']),
    at: msOr(data['at']),
  };
}

/** Fuente real sobre una base; las pruebas la arman con un doble de `firebase/firestore`. */
export function createSectionsSource(db: Firestore): SectionsSource {
  const quiet: Unsubscribe = () => undefined;
  return {
    onState: (callback, onError) =>
      onSnapshot(doc(db, 'constitution', 'state'), (s) => callback(readState(s.data())), () => onError?.()),
    onSections: (audience, callback, onError) => {
      // La condición de la regla de RF-2 (004) · 2.3: sin ella el visitante recibiría permiso denegado.
      const base = collection(db, 'constitutionSections');
      const source = audience === 'visitor' ? query(base, where('isRetired', '==', false)) : base;
      return onSnapshot(source, (s) => callback(s.docs.map(readSection)), () => onError?.());
    },
    onMeta: (audience, sectionId, callback, onError) => {
      if (audience === 'visitor') {
        callback(null);
        return quiet;
      }
      return onSnapshot(doc(db, 'constitutionSections', sectionId, 'private', 'meta'), (s) => callback(readMeta(s.data())), () => onError?.());
    },
    onVersions: (audience, sectionId, callback, onError) => {
      if (audience === 'visitor') {
        callback([]);
        return quiet;
      }
      return onSnapshot(
        query(collection(db, 'constitutionSections', sectionId, 'versions'), orderBy('version', 'desc')),
        (s) => callback(s.docs.map(readVersion)),
        () => onError?.(),
      );
    },
    onLog: (audience, callback, onError) => {
      if (audience === 'visitor') {
        callback([]);
        return quiet;
      }
      return onSnapshot(
        query(collection(db, 'constitutionLog'), orderBy('seq', 'desc'), limit(LOG_LIMIT)),
        (s) => callback(s.docs.map(readLog)),
        () => onError?.(),
      );
    },
  };
}

export const firestoreSectionsSource: SectionsSource = {
  onState: (cb, err) => createSectionsSource(firebase().db).onState(cb, err),
  onSections: (a, cb, err) => createSectionsSource(firebase().db).onSections(a, cb, err),
  onMeta: (a, id, cb, err) => createSectionsSource(firebase().db).onMeta(a, id, cb, err),
  onVersions: (a, id, cb, err) => createSectionsSource(firebase().db).onVersions(a, id, cb, err),
  onLog: (a, cb, err) => createSectionsSource(firebase().db).onLog(a, cb, err),
};

/** Las secciones en el orden del estado (RF-1 (004) · 1.1); las que el lector no recibe se omiten, las nuevas van al final. */
export function orderSections(state: ConstitutionState | null, sections: Section[]): Section[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const ordered = (state?.order ?? []).flatMap((id) => byId.get(id) ?? []);
  const listed = new Set(ordered.map((s) => s.id));
  return [...ordered, ...sections.filter((s) => !listed.has(s.id))];
}
