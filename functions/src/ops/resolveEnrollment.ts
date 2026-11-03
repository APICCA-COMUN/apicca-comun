// RF-4 (001), RF-8 (016) · 8.3, RF-9 (016) · 9.2, RF-3 (018) · La persona facilitadora acepta o descarta una solicitud
// de ingreso, una sola vez: todo ocurre en una transacción (D-T11 (018)).
import { FieldValue } from 'firebase-admin/firestore';
import { isEnrollmentExpired, validateDiscardReason } from '../../../shared/domain/enrollment';
import type { TimestampLike } from '../../../shared/domain/order';
import { requireFacilitator } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readSafeId } from '../ids';
import { writeInvitation } from './invite';

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
  const discardReason = decision === 'discard' ? validateDiscardReason(typeof reason === 'string' ? reason : '') : null;
  if (discardReason && !discardReason.ok) throw new ApiError(discardReason.code);
  const ref = ctx.db.doc(`enrollmentRequests/${id}`);

  // Si dos facilitadores chocan, Firestore reintenta la transacción del segundo, que ya la encuentra resuelta
  // (RF-3 (018) · 3.1 a 3.3).
  return ctx.db.runTransaction(async (tx): Promise<EnrollmentResolution> => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('invalid-request');
    if (snap.get('status') !== 'pending') throw new ApiError('enrollment-resolved');
    // Una caducada ya no se resuelve aunque el TTL de Firestore aún no la haya borrado (D-T12 (016)).
    const expiresAt = snap.get('expiresAt') as TimestampLike | undefined;
    const stamped = { status: 'pending' as const, createdAt: snap.get('createdAt') as TimestampLike };
    if (isEnrollmentExpired(expiresAt ? { ...stamped, expiresAt } : stamped, ctx.now())) {
      throw new ApiError('enrollment-expired');
    }
    const resolved = { resolvedBy: actor.uid, resolvedAt: ctx.now(), expiresAt: FieldValue.delete() };

    if (discardReason?.ok) {
      tx.update(ref, { status: 'discarded', reason: discardReason.value, ...resolved });
      return {};
    }

    // La invitación sigue las reglas de RF-1 (001); si el correo ya tiene cuenta, la solicitud queda pendiente
    // y la transacción no escribe nada (RF-3 (018) · 3.4).
    let link: string;
    try {
      link = await writeInvitation(ctx, tx, snap.get('email') as string, actor.uid);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'account-exists') return { accountExists: true };
      throw error;
    }
    tx.update(ref, { status: 'accepted', ...resolved });
    return { link };
  });
}
