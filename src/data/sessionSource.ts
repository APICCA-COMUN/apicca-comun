// RF-3 (001), RF-5 (001) · Fuente real de la sesión: Firebase Auth y la escucha de `accounts/{uid}`.
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { AccountDoc } from '../../shared/domain/accounts';
import type { SessionSource } from '../app/session';
import { firebase } from './firebase';

export const firebaseSessionSource: SessionSource = {
  onAuth: (callback) => onAuthStateChanged(firebase().auth, (user) => callback(user?.uid ?? null)),
  onAccount: (uid, callback) =>
    onSnapshot(
      doc(firebase().db, 'accounts', uid),
      (snap) => callback(snap.exists() ? (snap.data() as AccountDoc) : null),
      () => callback(null),
    ),
  signOut: () => signOut(firebase().auth),
};
