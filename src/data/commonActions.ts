// RF-5 (010) · 5.1, 5.2, RF-6 (010), RF-8 (010), D-T7 (010) · Lectura de las Acciones Comunes: la lista (o «Lo mío») y una
// Acción Común con sus participantes visibles y los ápices que quien mira puede ver. Escribir es cosa de las ops.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import type { ApiceStatus, Axis } from '../../shared/domain/apice';
import { commonActionsQuery, sortCommonActions, type CommonActionStatus } from '../../shared/domain/commonActions';
import { msOr, num, text } from './constitution/read';
import { firebase } from './firebase';

/** Lo que el mapa y la lista necesitan de cada Acción Común. */
export interface CommonActionSummary {
  id: string;
  title: string;
  description: string;
  axis: Axis | null;
  status: CommonActionStatus;
  authorUid: string;
  authorUsername: string;
  apiceIds: string[];
  participantUids: string[];
  participantCount: number;
  /** Milisegundos desde la época. */
  createdAt: number;
}

export interface LinkedApice {
  id: string;
  name: string;
  status: ApiceStatus;
}

export interface CommonActionDetail extends CommonActionSummary {
  /** Participantes visibles, por orden de llegada. */
  participants: { uid: string; username: string }[];
  /** Los ápices enlazados que quien mira puede ver, en el orden del camino. */
  apices: LinkedApice[];
  /** Cuántos ápices enlazados no puede ver quien mira (RF-4 (010) · 4.3). */
  hiddenApices: number;
}

export interface CommonActionSource {
  /** Las listadas, ordenadas (RF-5 (010)); con `uid`, solo en las que esa persona participa (RF-6 (010)). */
  list(uid: string | null): Promise<CommonActionSummary[]>;
  /** `null` si no existe o si las reglas no dejan leerla (RF-5 (010) · 5.2: sin pistas). */
  get(id: string): Promise<CommonActionDetail | null>;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

function summaryOf(id: string, data: Record<string, unknown>): CommonActionSummary {
  return {
    id,
    title: text(data['title']),
    description: text(data['description']),
    axis: typeof data['axis'] === 'string' ? (data['axis'] as Axis) : null,
    status: (data['status'] as CommonActionStatus | undefined) ?? 'abierta',
    authorUid: text(data['authorUid']),
    authorUsername: text(data['authorUsername']),
    apiceIds: strings(data['apiceIds']),
    participantUids: strings(data['participantUids']),
    participantCount: num(data['participantCount']),
    createdAt: msOr(data['createdAt']),
  };
}

const quietly = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await read();
  } catch {
    return fallback;
  }
};

export function createCommonActionSource(db: Firestore): CommonActionSource {
  return {
    async list(uid) {
      const shape = commonActionsQuery(uid);
      const snapshot = await getDocs(
        query(collection(db, shape.collection), ...shape.conditions.map((c) => where(c.field, c.op, c.value)), orderBy(shape.orderBy.field, shape.orderBy.direction), limit(shape.limit ?? 100)),
      );
      return sortCommonActions(snapshot.docs.map((d) => summaryOf(d.id, d.data())));
    },
    async get(id) {
      const snap = await quietly(() => getDoc(doc(db, 'commonActions', id)), null);
      if (snap === null || !snap.exists()) return null;
      const summary = summaryOf(snap.id, snap.data());
      const participants = await quietly(async () => {
        const docs = (await getDocs(query(collection(db, 'commonActions', id, 'participants'), where('suspended', '==', false)))).docs;
        return docs
          .map((d) => ({ uid: text(d.get('uid')), username: text(d.get('username')), joinedAt: msOr(d.get('joinedAt')) }))
          .sort((a, b) => a.joinedAt - b.joinedAt)
          .map(({ uid, username }) => ({ uid, username }));
      }, []);
      const read = await Promise.all(
        summary.apiceIds.map((apiceId) =>
          quietly(async () => {
            const apice = await getDoc(doc(db, 'apices', apiceId));
            return apice.exists() ? { id: apice.id, name: text(apice.get('name')), status: apice.get('status') as ApiceStatus } : null;
          }, null),
        ),
      );
      const apices = read.filter((apice): apice is LinkedApice => apice !== null);
      return { ...summary, participants, apices, hiddenApices: summary.apiceIds.length - apices.length };
    },
  };
}

/** Fuente real. */
export const firestoreCommonActionSource: CommonActionSource = {
  list: (uid) => createCommonActionSource(firebase().db).list(uid),
  get: (id) => createCommonActionSource(firebase().db).get(id),
};
