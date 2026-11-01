// RF-12 (001) · Lecturas del historial de un ápice: su cabecera y sus versiones. Las reglas de Firestore solo
// dejan leer las versiones a cuentas activas que pueden ver el ápice (RNF-4 (001)); la página recibe la
// fuente por props para probarse con dobles.
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { ApiceContent, ApiceStatus, Visibility } from '../../shared/domain/apice';
import type { TimestampLike } from '../../shared/domain/order';
import { firebase } from './firebase';

/** Lo que del ápice decide quién ve el historial y si se puede restaurar. */
export interface ApiceHead {
  id: string;
  version: number;
  visibility: Visibility;
  isArchived: boolean;
  authorUid: string;
}

export interface VersionRow {
  n: number;
  kind: 'create' | 'edit' | 'restore';
  restoredFromN: number | null;
  savedByUsername: string;
  savedAt: TimestampLike;
  content: ApiceContent & { status: ApiceStatus };
}

export type Unsubscribe = () => void;

export interface HistorySource {
  /** `null` si no existe o si las reglas no dejan leerlo. */
  onApice(id: string, callback: (head: ApiceHead | null) => void): Unsubscribe;
  onVersions(id: string, callback: (rows: VersionRow[]) => void, onError?: () => void): Unsubscribe;
}

/** Fuente real: escucha el ápice y sus versiones con Firestore. */
export const firestoreHistorySource: HistorySource = {
  onApice: (id, callback) =>
    onSnapshot(
      doc(firebase().db, 'apices', id),
      (snapshot) => {
        const data = snapshot.data();
        callback(
          data === undefined
            ? null
            : {
                id: snapshot.id,
                version: data['version'] as number,
                visibility: data['visibility'] as Visibility,
                isArchived: data['isArchived'] as boolean,
                authorUid: data['authorUid'] as string,
              },
        );
      },
      () => callback(null),
    ),
  onVersions: (id, callback, onError) =>
    onSnapshot(
      query(collection(firebase().db, 'apices', id, 'versions'), orderBy('n', 'desc')),
      (snapshot) => callback(snapshot.docs.map((d) => d.data() as VersionRow)),
      () => onError?.(),
    ),
};
