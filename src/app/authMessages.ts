// RF-3 (001) · Textos de los errores de Firebase Auth al entrar y al restablecer la contraseña.
import { messageFor } from '../../shared/domain/messages';

/** Mismo texto para correo o contraseña incorrectos: no revela cuál falló (RF-3 (001)). */
export const BAD_CREDENTIALS = 'El correo o la contraseña no coinciden.';
export const SIGN_IN_FAILED = 'No pudimos iniciar tu sesión. Inténtalo de nuevo.';
export const RESET_LINK_INVALID = 'Este enlace venció o ya se usó. Puedes pedir otro.';
export const RESET_SENT =
  'Si el correo tiene una cuenta, te enviaremos un enlace para elegir una contraseña nueva. Revisa tu bandeja.';

export function signInMessage(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return BAD_CREDENTIALS;
    case 'auth/too-many-requests':
      // El umbral y la duración los fija Firebase Auth (RF-3 (001)).
      return messageFor('rate-limited');
    default:
      return SIGN_IN_FAILED;
  }
}

export function isResetLinkError(code: string | undefined): boolean {
  return code === 'auth/expired-action-code' || code === 'auth/invalid-action-code' || code === 'auth/user-disabled';
}
