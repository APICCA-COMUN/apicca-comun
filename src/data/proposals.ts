// RF-17 (001), RF-18 (001) · Lectura de la propuesta de imagen propia. Solo quien la pidió puede leerla (las reglas
// lo deciden); documento `proposals/{apiceId}_{uid}` (plan §4.4). La página recibe la fuente por props para probarse con dobles.
import { doc, onSnapshot } from 'firebase/firestore';
import type { TimestampLike } from '../../shared/domain/order';
import { firebase } from './firebase';

export interface ProposalRow {
  png: Uint8Array;
  createdAt?: TimestampLike | undefined;
  expiresAt?: TimestampLike | undefined;
}

export type Unsubscribe = () => void;

export interface ProposalSource {
  /** `null` si la persona no tiene propuesta pendiente en ese ápice. */
  onProposal(apiceId: string, uid: string, callback: (row: ProposalRow | null) => void, onError?: () => void): Unsubscribe;
}

export const firestoreProposalSource: ProposalSource = {
  onProposal: (apiceId, uid, callback, onError) =>
    onSnapshot(
      doc(firebase().db, 'proposals', `${apiceId}_${uid}`),
      (snapshot) => {
        if (!snapshot.exists()) return callback(null);
        const data = snapshot.data() as { png: { toUint8Array(): Uint8Array }; createdAt?: TimestampLike; expiresAt?: TimestampLike };
        callback({ png: data.png.toUint8Array(), createdAt: data.createdAt, expiresAt: data.expiresAt });
      },
      () => onError?.(),
    ),
};
