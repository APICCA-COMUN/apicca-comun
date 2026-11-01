// Solicitud de inscripción: validación, estados y listas (RF-4 (001)).
import { validateName } from './accounts';
import { LIMITS, countCodePoints, isBlank, normalizeEmail } from './limits';
import { compareTimestamps, compareTimestampsDescending, type TimestampLike } from './order';
import { invalid, valid, type Validation } from './result';

/** Versión del texto de tratamiento de datos que se acepta; sube al cambiar el texto. */
export const PRIVACY_TEXT_VERSION = '2026-10-07';

/** Días que una solicitud pendiente espera antes de caducar (RF-8 (016) · 8.3, D-T12 (016)). */
export const ENROLLMENT_TTL_DAYS = 30;

export type EnrollmentStatus = 'pending' | 'accepted' | 'discarded';

export interface EnrollmentDoc {
  status: EnrollmentStatus;
  createdAt: TimestampLike;
  /**
   * Instante de caducidad de una pendiente (RF-8 (016) · 8.3). Las solicitudes anteriores a la 016 no lo
   * tienen y no caducan; al resolverse se borra para que el TTL de Firestore no elimine una solicitud resuelta.
   */
  expiresAt?: TimestampLike;
}

export interface EnrollmentInput {
  email: string;
  name: string;
  message: string;
  accepted: boolean;
}

export interface EnrollmentRequest {
  email: string;
  name: string;
  message: string;
}

const EMAIL_FORM = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Correo normalizado, o `email-invalid` si es demasiado largo o no tiene forma de correo. */
export function validateEmail(raw: string): Validation<string> {
  const email = normalizeEmail(raw);
  if (countCodePoints(email) > LIMITS.email || !EMAIL_FORM.test(email)) return invalid('email-invalid');
  return valid(email);
}

export function validateEnrollmentRequest(input: EnrollmentInput): Validation<EnrollmentRequest> {
  const emailCheck = validateEmail(input.email);
  if (!emailCheck.ok) return emailCheck;
  const email = emailCheck.value;
  const name = validateName(input.name);
  if (!name.ok) return name;
  if (countCodePoints(input.message) > LIMITS.enrollmentMessage) return invalid('message-too-long');
  if (!input.accepted) return invalid('consent-required');
  return valid({ email, name: name.value, message: input.message });
}

/**
 * Una solicitud pendiente cuyo `expiresAt` ya pasó (RF-8 (016) · 8.3). El TTL de Firestore puede tardar hasta
 * 24 horas en borrarla, así que mientras tanto se trata como caducada. Sin `expiresAt` no caduca.
 */
export function isEnrollmentExpired(request: EnrollmentDoc, now: Date): boolean {
  if (request.status !== 'pending' || request.expiresAt === undefined) return false;
  const nowLike: TimestampLike = { seconds: Math.floor(now.getTime() / 1000), nanoseconds: (now.getTime() % 1000) * 1_000_000 };
  return compareTimestamps(request.expiresAt, nowLike) <= 0;
}

/**
 * Pendientes por un lado y resueltas (aceptadas o descartadas) por otro, cada una de la más reciente a la más
 * antigua. Las pendientes caducadas no se listan (RF-8 (016) · 8.3).
 */
export function splitEnrollmentLists<T extends EnrollmentDoc>(
  requests: readonly T[],
  now: Date = new Date(),
): { pending: T[]; resolved: T[] } {
  const byNewest = (a: T, b: T): number => compareTimestampsDescending(a.createdAt, b.createdAt);
  return {
    pending: requests.filter((r) => r.status === 'pending' && !isEnrollmentExpired(r, now)).sort(byNewest),
    resolved: requests.filter((r) => r.status !== 'pending').sort(byNewest),
  };
}

/** Descartar exige un motivo; uno vacío o de solo espacios no vale. */
export function validateDiscardReason(reason: string): Validation<string> {
  return isBlank(reason) ? invalid('reason-required') : valid(reason.trim());
}
