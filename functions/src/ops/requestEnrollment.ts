// RF-4 (001) · Solicitud pública de inscripción: campo trampa, límite (D-T16 (001)), validación y guardado.
// Responde siempre lo mismo, así que no revela si el correo ya tiene cuenta, invitación o solicitud.
import { PRIVACY_TEXT_VERSION, validateEnrollmentRequest } from '../../../shared/domain/enrollment';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { consumeEnrollmentSlot } from '../rateLimit';

const RECEIVED = { received: true } as const;

export async function handleRequestEnrollment(
  ctx: Ctx,
  payload: Record<string, unknown>,
  _uid: string | null,
): Promise<typeof RECEIVED> {
  const { email, name, message, accepted, website } = payload;
  if (typeof email !== 'string' || typeof name !== 'string' || typeof message !== 'string' || typeof accepted !== 'boolean') {
    throw new ApiError('invalid-request');
  }
  // Un humano no ve este campo: si viene lleno es un programa, y no se le dice que fue descubierto.
  if (website !== undefined && website !== '') return RECEIVED;
  const checked = validateEnrollmentRequest({ email, name, message, accepted });
  if (!checked.ok) throw new ApiError(checked.code);
  await consumeEnrollmentSlot(ctx);
  const now = ctx.now();
  await ctx.db.collection('enrollmentRequests').add({
    ...checked.value,
    status: 'pending',
    createdAt: now,
    privacyVersion: PRIVACY_TEXT_VERSION,
    acceptedAt: now,
  });
  return RECEIVED;
}
