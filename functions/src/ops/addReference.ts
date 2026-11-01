// RF-15 (001), RF-7 (016) · 7.3 · Subir una referencia a un ápice (D-T9 (001)): descarga el temporal, valida el formato real,
// reescribe sin metadatos, lo coloca y recién entonces crea el documento dentro de la transacción que cuenta.
import { MAX_IMAGE_DIMENSION, REFERENCE_MAX_BYTES, validateAltText, validateReferenceMeta } from '../../../shared/domain/images';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { inspectImage, stripMetadata } from '../images';
import { readId } from './apiceInput';
import { assertCanChangeReferences, newId, readToken } from './mediaInput';

export async function handleAddReference(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ refId: string }> {
  const actor = await requireActor(ctx, uid);
  const id = readId(payload);
  const uploadId = readToken(payload, 'uploadId');
  if (typeof payload['altText'] !== 'string') throw new ApiError('invalid-request');
  const alt = validateAltText(payload['altText']);
  if (!alt.ok) throw new ApiError(alt.code);

  // Comprobaciones baratas antes de descargar nada.
  const apiceSnap = await ctx.db.doc(`apices/${id}`).get();
  if (!apiceSnap.exists) throw new ApiError('invalid-request');
  const current = apiceSnap.data() as Record<string, unknown>;
  assertCanChangeReferences(actor, current);

  const bucket = ctx.storage.bucket();
  const temp = bucket.file(`uploads/${actor.uid}/${uploadId}`);
  const [exists] = await temp.exists();
  if (!exists) throw new ApiError('invalid-request');
  const [tempMeta] = await temp.getMetadata();
  const tempSize = Number(tempMeta.size);
  if (!(tempSize > 0) || tempSize > REFERENCE_MAX_BYTES) throw new ApiError('image-too-large');
  const [original] = await temp.download();

  const inspected = await inspectImage(original, MAX_IMAGE_DIMENSION);
  if (!inspected.ok) throw new ApiError(inspected.code);
  const { format, contentType, width, height } = inspected.value;
  const clean = await stripMetadata(original, format);

  const count = (current['activeReferenceCount'] as number | undefined) ?? 0;
  const early = validateReferenceMeta({ contentType, bytes: clean.length, altText: alt.value, currentCount: count, width, height });
  if (!early.ok) throw new ApiError(early.code);

  const refId = newId(ctx.random);
  const path = `apices/${id}/references/${refId}`;
  const placed = bucket.file(path);
  try {
    await placed.save(clean, { contentType, resumable: false });
    await ctx.db.runTransaction(async (tx) => {
      const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
      if (accountSnap.data()?.['status'] !== 'active') throw new ApiError('account-suspended');
      // Una reserva vigente y propia por referencia, y se gasta aquí: dos llamadas con el mismo temporal no crean dos
      // referencias (RF-7 (016) · 7.3).
      const reservationRef = ctx.db.doc(`uploadReservations/${uploadId}`);
      const reservation = await tx.get(reservationRef);
      const expiresAt = reservation.get('expiresAt') as { toMillis(): number } | undefined;
      if (!reservation.exists || reservation.get('uid') !== actor.uid || expiresAt === undefined || expiresAt.toMillis() <= ctx.now().getTime()) {
        throw new ApiError('invalid-request');
      }
      const apiceRef = ctx.db.doc(`apices/${id}`);
      const snap = await tx.get(apiceRef);
      if (!snap.exists) throw new ApiError('invalid-request');
      const apice = snap.data() as Record<string, unknown>;
      assertCanChangeReferences(actor, apice);
      const active = (apice['activeReferenceCount'] as number | undefined) ?? 0;
      // El tope se decide aquí, con el contador leído en la transacción: la segunda de dos subidas simultáneas ve 5.
      const checked = validateReferenceMeta({ contentType, bytes: clean.length, altText: alt.value, currentCount: active, width, height });
      if (!checked.ok) throw new ApiError(checked.code);
      const at = ctx.now();
      tx.set(ctx.db.doc(path), {
        path,
        altText: checked.value.altText,
        contentType,
        bytes: clean.length,
        width,
        height,
        uploadedByUid: actor.uid,
        uploadedByUsername: actor.username,
        uploadedAt: at,
        isRemoved: false,
        removal: null,
      });
      tx.update(apiceRef, { activeReferenceCount: active + 1 });
      tx.delete(reservationRef);
      tx.set(ctx.db.doc(`apices/${id}/events/${newId(ctx.random)}`), {
        type: 'reference-added',
        byUid: actor.uid,
        byUsername: actor.username,
        at,
        detail: { refId },
      });
    });
  } catch (error) {
    // Nada de referencias a medias (RF-15 (001)): si algo falla, el archivo colocado se va.
    await placed.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
  await temp.delete({ ignoreNotFound: true }).catch(() => undefined);
  return { refId };
}
