// RF-2 (001), RF-8 (016) · Registro por invitación (D-T15 (001), D-T10 (016) y D-T11 (016)): crear el usuario de Auth, reservar y
// crear la cuenta en una transacción, y compensar borrando el usuario de Auth si la transacción falla.
import { validateName, validatePassword, validateUsername, type AccountDoc } from '../../../shared/domain/accounts';
import { emailKey, invitationState, type InvitationDoc } from '../../../shared/domain/invitations';
import type { TimestampLike } from '../../../shared/domain/order';
import type { Validation } from '../../../shared/domain/result';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { findInvitationByToken, hashToken } from '../invitationToken';

interface StoredInvitation {
  email: string;
  tokenHash?: string;
  /** Solo las invitaciones anteriores a RF-8 (016) · 8.1 lo conservan. */
  token?: string;
  status: InvitationDoc['status'];
  issuedAt: { toDate(): Date };
  expiresAt: { toDate(): Date };
}

const text = (payload: Record<string, unknown>, key: string): string => {
  const value = payload[key];
  if (typeof value !== 'string') throw new ApiError('invalid-request');
  return value;
};

const unwrap = <T>(checked: Validation<T>): T => {
  if (!checked.ok) throw new ApiError(checked.code);
  return checked.value;
};

const toLike = (t: { toDate(): Date }): TimestampLike => {
  const ms = t.toDate().getTime();
  return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
};

/** Código de rechazo de una invitación que ya no admite registro; `null` si está pendiente. */
function invitationRejection(doc: StoredInvitation, now: Date): ApiError | null {
  const state = invitationState({ status: doc.status, issuedAt: toLike(doc.issuedAt), expiresAt: toLike(doc.expiresAt) }, now);
  if (state === 'expired') return new ApiError('invitation-expired');
  if (state === 'accepted') return new ApiError('invitation-used');
  if (state === 'cancelled') return new ApiError('invitation-cancelled');
  return null;
}

/** Un usuario de Auth sin cuenta más joven que esto puede ser de otro registro en curso, no un huérfano. */
const ORPHAN_GRACE_MS = 5 * 60 * 1000;

/**
 * Crea el usuario de Auth; si quedó uno huérfano (sin cuenta) de una caída anterior, lo reemplaza.
 * Solo se reemplaza el que tiene más de cinco minutos: dos registros simultáneos de la misma invitación
 * chocan en el correo, y el segundo vería el usuario del primero, todavía sin cuenta, como un huérfano y lo
 * borraría antes de que el primero terminara (RF-8 (016) · 8.2, D-T11 (016)).
 */
async function createAuthUser(ctx: Ctx, email: string, password: string, displayName: string): Promise<string> {
  const create = () => ctx.auth.createUser({ email, password, displayName });
  try {
    return (await create()).uid;
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/email-already-exists') throw error;
    const existing = await ctx.auth.getUserByEmail(email);
    if ((await ctx.db.doc(`accounts/${existing.uid}`).get()).exists) throw new ApiError('account-exists');
    const age = ctx.now().getTime() - Date.parse(existing.metadata.creationTime);
    // Si la fecha no se puede leer (NaN) o es reciente, se respeta al usuario: quien pierde la carrera ve la invitación como usada.
    if (!(age >= ORPHAN_GRACE_MS)) throw new ApiError('invitation-used');
    await ctx.auth.deleteUser(existing.uid);
    return (await create()).uid;
  }
}

export async function handleRegister(ctx: Ctx, payload: Record<string, unknown>, _uid: string | null): Promise<{ uid: string }> {
  const token = text(payload, 'token');
  if (token === '' || token.length > 128) throw new ApiError('invalid-request');
  const rawPassword = text(payload, 'password');
  const rawName = text(payload, 'name');
  const rawUsername = text(payload, 'username');

  const found = await findInvitationByToken(ctx, token);
  if (found === null) throw new ApiError('invitation-not-found');
  const invitation = found.data() as StoredInvitation;
  const rejection = invitationRejection(invitation, ctx.now());
  if (rejection !== null) throw rejection;
  const email = invitation.email;
  if (!(await ctx.db.collection('accounts').where('email', '==', email).limit(1).get()).empty) {
    throw new ApiError('account-exists');
  }

  const password = unwrap(validatePassword(rawPassword));
  const name = unwrap(validateName(rawName));
  const username = unwrap(validateUsername(rawUsername));
  if ((await ctx.db.doc(`usernames/${username}`).get()).exists) throw new ApiError('username-taken');

  const uid = await createAuthUser(ctx, email, password, name);
  try {
    const invitationRef = ctx.db.doc(`invitations/${await emailKey(email)}`);
    await ctx.db.runTransaction(async (tx) => {
      const current = await tx.get(invitationRef);
      const data = current.data() as StoredInvitation | undefined;
      // Renovada o anulada mientras se registraba: el token ya no es el que se usó (RF-2 (001)).
      if (data === undefined || !(data.tokenHash === hashToken(token) || data.token === token)) {
        if (data !== undefined && data.status === 'cancelled') throw new ApiError('invitation-cancelled');
        throw new ApiError('invitation-not-found');
      }
      const again = invitationRejection(data, ctx.now());
      if (again !== null) throw again;
      const usernameRef = ctx.db.doc(`usernames/${username}`);
      if ((await tx.get(usernameRef)).exists) throw new ApiError('username-taken');
      const account: AccountDoc = { email, name, username, role: 'member', status: 'active' };
      tx.set(usernameRef, { uid });
      tx.set(ctx.db.doc(`accounts/${uid}`), account);
      tx.update(invitationRef, { status: 'accepted', acceptedBy: uid, acceptedAt: ctx.now() });
    });
  } catch (error) {
    await ctx.auth.deleteUser(uid).catch(() => undefined);
    throw error;
  }
  return { uid };
}
