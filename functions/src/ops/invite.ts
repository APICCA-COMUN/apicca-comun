// RF-1 (001), RF-8 (016) · 8.1 · Crear o renovar una invitación (D-T14 (001), D-T10 (016)): un documento por correo, sin
// duplicados; guarda solo el hash del token, que se devuelve en claro una sola vez.
import { emailKey, invitationExpiry } from '../../../shared/domain/invitations';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { hashToken } from '../invitationToken';
import { readEmail } from './emailPayload';

/** 192 bits en base64url. */
const TOKEN_BYTES = 24;

export async function handleInvite(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ link: string }> {
  const actor = await requireFacilitator(ctx, uid);
  const email = readEmail(payload);
  if (!(await ctx.db.collection('accounts').where('email', '==', email).limit(1).get()).empty) {
    throw new ApiError('account-exists');
  }
  const token = Buffer.from(ctx.random(TOKEN_BYTES)).toString('base64url');
  const issuedAt = ctx.now();
  // `set` sin mezcla: renovar reemplaza el hash anterior, borra el `token` en claro de una invitación heredada
  // y borra rastros de anulación.
  await ctx.db.doc(`invitations/${await emailKey(email)}`).set({
    email,
    tokenHash: hashToken(token),
    status: 'pending',
    issuedAt,
    expiresAt: invitationExpiry(issuedAt),
    createdBy: actor.uid,
  });
  return { link: `/registro/${token}` };
}
