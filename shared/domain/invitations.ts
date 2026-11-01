// Invitaciones: vencimiento, clave del correo, estado y orden (RF-1 (001)).
// El correo se normaliza con `normalizeEmail` de `limits.ts`: es la única manera de compararlos.
import { normalizeEmail } from './limits';
import { compareTimestampsDescending, type TimestampLike } from './order';

export const INVITATION_DAYS = 30;

/** Lo que se guarda: la invitación vencida no cambia de estado guardado, se deduce de `expiresAt`. */
export type StoredInvitationStatus = 'pending' | 'accepted' | 'cancelled';
export type InvitationState = 'pending' | 'expired' | 'accepted' | 'cancelled';

export interface InvitationDoc {
  status: StoredInvitationStatus;
  /** Cuándo se creó o renovó por última vez. */
  issuedAt: TimestampLike;
  expiresAt: TimestampLike;
}

export const INVITATION_STATE_LABELS: Record<InvitationState, string> = {
  pending: 'Pendiente',
  expired: 'Vencida',
  accepted: 'Aceptada',
  cancelled: 'Anulada',
};

/** A los 30 días exactos de crearla o renovarla. */
export function invitationExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + INVITATION_DAYS * 24 * 3600 * 1000);
}

/** Id de documento: SHA-256 en hexadecimal del correo normalizado; no guarda el correo en claro. */
export async function emailKey(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeEmail(email));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const toMillis = (t: TimestampLike): number => t.seconds * 1000 + Math.floor(t.nanoseconds / 1e6);

/** El instante exacto del vencimiento ya cuenta como vencida. */
export function invitationState(doc: InvitationDoc, now: Date): InvitationState {
  if (doc.status !== 'pending') return doc.status;
  return now.getTime() >= toMillis(doc.expiresAt) ? 'expired' : 'pending';
}

/** De la más reciente a la más antigua. */
export function compareInvitations(a: InvitationDoc, b: InvitationDoc): number {
  return compareTimestampsDescending(a.issuedAt, b.issuedAt);
}
