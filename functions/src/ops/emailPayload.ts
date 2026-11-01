// RF-1 (001) · Lectura común del `email` de las ops de invitaciones.
import { validateEmail } from '../../../shared/domain/enrollment';
import { ApiError } from '../errors';

/** Correo normalizado del payload; ausente o no textual es `invalid-request`, mal formado `email-invalid`. */
export function readEmail(payload: Record<string, unknown>): string {
  if (typeof payload['email'] !== 'string') throw new ApiError('invalid-request');
  const checked = validateEmail(payload['email']);
  if (!checked.ok) throw new ApiError(checked.code);
  return checked.value;
}
