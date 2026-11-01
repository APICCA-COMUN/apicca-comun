// Sesión de las pruebas de navegador (T-8.1, D-T13 (002)): inicia y cierra sesión en el emulador de Auth con la
// misma app de Firebase que usa el sitio (`src/data/firebase.ts`, con VITE_USE_EMULATORS), antes de montar una
// ruta que pide cuenta. Las cuentas las crea el comando `seedFull`.
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebase } from '../../src/data/firebase';

export async function signInAs(account: { email: string; password: string }): Promise<void> {
  await signInWithEmailAndPassword(firebase().auth, account.email, account.password);
}

export async function signOutNow(): Promise<void> {
  await signOut(firebase().auth);
}
