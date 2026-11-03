// RF-1 (001), RF-8 (016) · 8.1, RF-3 (018) · Crear o renovar una invitación (D-T14 (001), D-T10 (016), D-T10 (018)): un documento
// por correo, sin duplicados; guarda solo el hash del token, que se devuelve en claro una sola vez.
import type { Transaction } from 'firebase-admin/firestore';
import { emailKey, invitationExpiry } from '../../../shared/domain/invitations';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { hashToken } from '../invitationToken';
import { readEmail } from './emailPayload';

/** 192 bits en base64url. */
const TOKEN_BYTES = 24;

/**
 * Escribe la invitación dentro de `tx` y devuelve el enlace (D-T10 (018)). Lee la cuenta antes de escribir, así que
 * quien llama debe haber hecho ya todas sus lecturas. Si la transacción se reintenta, el token se genera de nuevo
 * y solo vale el enlace del intento que se confirma.
 */
export async function writeInvitation(ctx: Ctx, tx: Transaction, email: string, createdBy: string): Promise<string> {
  const accounts = await tx.get(ctx.db.collection('accounts').where('email', '==', email).limit(1));
  if (!accounts.empty) throw new ApiError('account-exists');
  const ref = ctx.db.doc(`invitations/${await emailKey(email)}`);
  const token = Buffer.from(ctx.random(TOKEN_BYTES)).toString('base64url');
  const issuedAt = ctx.now();
  // `set` sin mezcla: renovar reemplaza el hash anterior, borra el `token` en claro de una invitación heredada
  // y borra rastros de anulación.
  tx.set(ref, {
    email,
    tokenHash: hashToken(token),
    status: 'pending',
    issuedAt,
    expiresAt: invitationExpiry(issuedAt),
    createdBy,
  });
  return `/registro/${token}`;
}

export async function handleInvite(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ link: string }> {
  const actor = await requireFacilitator(ctx, uid);
  const email = readEmail(payload);
  const link = await ctx.db.runTransaction((tx) => writeInvitation(ctx, tx, email, actor.uid));
  return { link };
}
