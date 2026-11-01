// RF-1 (001), RF-4 (001), RF-5 (001) · Listas que lee la facilitación: invitaciones, solicitudes y cuentas.
// Las reglas de Firestore solo dejan leerlas a facilitadores activos (RNF-4 (001)); las páginas reciben
// la fuente por props para probarse con dobles.
import { collection, onSnapshot, type DocumentData } from 'firebase/firestore';
import type { AccountDoc } from '../../shared/domain/accounts';
import type { EnrollmentDoc } from '../../shared/domain/enrollment';
import type { InvitationDoc } from '../../shared/domain/invitations';
import { firebase } from './firebase';

export interface InvitationRow extends InvitationDoc {
  email: string;
  /** Solo las pendientes lo conservan: es lo que permite volver a ver el enlace. */
  token?: string;
}

export interface EnrollmentRow extends EnrollmentDoc {
  id: string;
  email: string;
  name: string;
  message: string;
  /** Motivo del descarte. */
  reason?: string;
}

export interface AccountRow extends AccountDoc {
  uid: string;
}

export type Unsubscribe = () => void;

export interface FacilitationSource {
  onInvitations(callback: (rows: InvitationRow[]) => void, onError?: () => void): Unsubscribe;
  onEnrollments(callback: (rows: EnrollmentRow[]) => void, onError?: () => void): Unsubscribe;
  onAccounts(callback: (rows: AccountRow[]) => void, onError?: () => void): Unsubscribe;
}

function watch<T>(path: string, map: (id: string, data: DocumentData) => T) {
  return (callback: (rows: T[]) => void, onError?: () => void): Unsubscribe =>
    onSnapshot(
      collection(firebase().db, path),
      (snapshot) => callback(snapshot.docs.map((doc) => map(doc.id, doc.data()))),
      () => onError?.(),
    );
}

/** Fuente real: escucha las colecciones con Firestore. */
export const firestoreFacilitationSource: FacilitationSource = {
  onInvitations: watch('invitations', (_id, data) => data as InvitationRow),
  onEnrollments: watch('enrollmentRequests', (id, data) => ({ ...(data as Omit<EnrollmentRow, 'id'>), id })),
  onAccounts: watch('accounts', (uid, data) => ({ ...(data as AccountDoc), uid })),
};
