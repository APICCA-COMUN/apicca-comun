// Error tipificado de las ops: lleva un código de `shared/domain/messages.ts` y su mensaje en español.
import { messageFor, type ErrorCode } from '../../shared/domain/messages';

export class ApiError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(messageFor(code));
    this.name = 'ApiError';
    this.code = code;
  }
}
