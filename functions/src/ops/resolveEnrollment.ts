// RF-4 (001), RF-8 (016) · 8.3, RF-9 (016) · 9.2 · La persona facilitadora acepta o descarta una solicitud de ingreso.
import { FieldValue } from 'firebase-admin/firestore';
import { isEnrollmentExpired, validateDiscardReason } from '../../../shared/domain/enrollment';
import type { TimestampLike } from '../../../shared/domain/order';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readSafeId } from '../ids';
import { handleInvite } from './invite';

export type EnrollmentResolution = { link: string } | { accountExists: true } | Record<string, never>;

export async function handleResolveEnrollment(
  ctx: Ctx,
  payload: Record<string, unknown>,
  uid: string | null,
): Promise<EnrollmentResolution> {
  const actor = await requireFacilitator(ctx, uid);
  const id = readSafeId(payload, 'id');
  const { decision, reason } = payload;
  if (decision !== 'accept' && decision !== 'discard') throw new ApiError('invalid-request');
  const ref = ctx.db.doc(`enrollmentRequests/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('status') !== 'pending') throw new ApiError('invalid-request');
  // Una caducada ya no se resuelve aunque el TTL de Firestore aún no la haya borrado (D-T12 (016)).
  const expiresAt = snap.get('expiresAt') as TimestampLike | undefined;
  const stamped = { status: 'pending' as const, createdAt: snap.get('createdAt') as TimestampLike };
  if (isEnrollmentExpired(expiresAt ? { ...stamped, expiresAt } : stamped, ctx.now())) {
    throw new ApiError('enrollment-expired');
  }

  if (decision === 'discard') {
    const checked = validateDiscardReason(typeof reason === 'string' ? reason : '');
    if (!checked.ok) throw new ApiError(checked.code);
    await ref.update({ status: 'discarded', resolvedBy: actor.uid, resolvedAt: ctx.now(), reason: checked.value, expiresAt: FieldValue.delete() });
    return {};
  }

  const email = snap.get('email') as string;
  // La invitación sigue las reglas de RF-1 (001); si el correo ya tiene cuenta, la solicitud queda pendiente.
  let link: string;
  try {
    ({ link } = await handleInvite(ctx, { email }, actor.uid));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'account-exists') return { accountExists: true };
    throw error;
  }
  await ref.update({ status: 'accepted', resolvedBy: actor.uid, resolvedAt: ctx.now(), expiresAt: FieldValue.delete() });
  return { link };
}
