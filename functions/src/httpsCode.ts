// Traduce un código tipificado al código de HTTPS de las callables; el código tipificado
// viaja aparte en `details.code` y es el que usa la interfaz (T-1.30).
import type { FunctionsErrorCode } from 'firebase-functions/v2/https';
import type { ErrorCode } from '../../shared/domain/messages';

export function httpsCodeFor(code: ErrorCode): FunctionsErrorCode {
  switch (code) {
    case 'unauthenticated':
      return 'unauthenticated';
    case 'forbidden':
    case 'account-suspended':
    case 'cannot-suspend-facilitator':
    case 'cannot-suspend-self':
      return 'permission-denied';
    case 'rate-limited':
      return 'resource-exhausted';
    case 'unknown-op':
      return 'not-found';
    case 'invalid-request':
    case 'payload-too-large':
      return 'invalid-argument';
    default:
      return 'failed-precondition';
  }
}
