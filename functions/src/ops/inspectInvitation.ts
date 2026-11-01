// RF-2 (001), RF-8 (016) · 8.1 · Quien abre un enlace de invitación ve su estado y el correo; no requiere sesión.
import { invitationState, type InvitationDoc, type InvitationState } from '../../../shared/domain/invitations';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { findInvitationByToken } from '../invitationToken';

export interface InvitationView {
  state: Exclude<InvitationState, 'cancelled'>;
  email: string;
  accountExists: boolean;
}

export async function handleInspectInvitation(ctx: Ctx, payload: Record<string, unknown>, _uid: string | null): Promise<InvitationView> {
  const token = payload['token'];
  if (typeof token !== 'string' || token === '' || token.length > 128) throw new ApiError('invalid-request');
  const snap = await findInvitationByToken(ctx, token);
  if (snap === null) throw new ApiError('invitation-not-found');
  const raw = snap.data() as { email: string; status: InvitationDoc['status']; issuedAt: { toDate(): Date }; expiresAt: { toDate(): Date } };
  const toLike = (t: { toDate(): Date }) => {
    const ms = t.toDate().getTime();
    return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
  };
  const state = invitationState({ status: raw.status, issuedAt: toLike(raw.issuedAt), expiresAt: toLike(raw.expiresAt) }, ctx.now());
  if (state === 'cancelled') throw new ApiError('invitation-not-found');
  const accountExists = !(await ctx.db.collection('accounts').where('email', '==', raw.email).limit(1).get()).empty;
  return { state, email: raw.email, accountExists };
}
