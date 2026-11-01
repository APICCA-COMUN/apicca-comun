// RF-8 (016) · 8.1 (D-T10 (016)): el servidor guarda solo el hash del token de invitación.
import { createHash } from 'node:crypto';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Ctx } from './context';

/** SHA-256 en hexadecimal. El token ya tiene 192 bits de azar, así que no hace falta sal ni un hash lento. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Busca la invitación de un token por `tokenHash`; si no está, por el campo `token` en claro que guardaban
 * las invitaciones anteriores a RF-8 (016) · 1. Devuelve `null` si ninguna coincide.
 *
 * TODO: la segunda búsqueda se puede retirar cuando hayan caducado todas las invitaciones anteriores,
 * 30 días después del despliegue de este cambio.
 */
export async function findInvitationByToken(ctx: Ctx, token: string): Promise<QueryDocumentSnapshot | null> {
  const invitations = ctx.db.collection('invitations');
  const [byHash] = (await invitations.where('tokenHash', '==', hashToken(token)).limit(1).get()).docs;
  if (byHash !== undefined) return byHash;
  const [legacy] = (await invitations.where('token', '==', token).limit(1).get()).docs;
  return legacy ?? null;
}
