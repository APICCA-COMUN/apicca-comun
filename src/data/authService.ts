// RF-3 (001) · Acceso a Firebase Auth para entrar y restablecer la contraseña. Las páginas lo piden
// por contexto, así que las pruebas inyectan un doble y no inician Firebase.
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { createContext, useContext } from 'react';
import { firebase } from './firebase';

export interface AuthService {
  signIn(email: string, password: string): Promise<void>;
  /** Pide a Auth el correo con el enlace para elegir otra contraseña. */
  sendReset(email: string): Promise<void>;
  /** Comprueba el código del enlace y devuelve el correo de la cuenta. */
  verifyResetCode(code: string): Promise<string>;
  confirmReset(code: string, password: string): Promise<void>;
}

export const firebaseAuthService: AuthService = {
  signIn: async (email, password) => {
    await signInWithEmailAndPassword(firebase().auth, email, password);
  },
  sendReset: (email) => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://apicca.web.app';
    return sendPasswordResetEmail(firebase().auth, email, {
      url: `${origin}/accion`,
      handleCodeInApp: true,
    });
  },
  verifyResetCode: (code) => verifyPasswordResetCode(firebase().auth, code),
  confirmReset: (code, password) => confirmPasswordReset(firebase().auth, code, password),
};

export const AuthServiceContext = createContext<AuthService>(firebaseAuthService);

export function useAuthService(): AuthService {
  return useContext(AuthServiceContext);
}

/** Código de error de Firebase Auth (`auth/...`), si el error lo trae. */
export function authCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}
