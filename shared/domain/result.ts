// Resultado de una validación del dominio: el valor normalizado o un código tipificado.
import type { ErrorCode } from './messages';

export type Validation<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };

export const valid = <T>(value: T): Validation<T> => ({ ok: true, value });
export const invalid = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code });
