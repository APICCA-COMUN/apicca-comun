// RF-17 (001) · Generar una imagen propuesta (D-T7 (001), D-T8 (001)): una transacción reserva una unidad del tope y el
// candado «una en curso»; el modelo corre fuera de la transacción con tiempo máximo; el resultado se lleva a 64 × 64
// con la paleta y queda como propuesta solo visible para quien la pidió. Las fallas liberan la reserva y no cuentan.
import type { Transaction } from 'firebase-admin/firestore';
import { DAILY_LIMIT, GENERATION_TIMEOUT_MS, GLOBAL_DAILY_LIMIT, buildImagePrompt, isBlocked, recordOutcome } from '../../../shared/domain/generation';
import { PROPOSAL_TTL_MS } from '../../../shared/domain/images';
import type { ErrorCode } from '../../../shared/domain/messages';
import { requireActor, type Actor } from '../access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import {
  LOCK_TTL_MS,
  countFrom,
  counterDoc,
  dayKey,
  globalDayRef,
  stateDoc,
  stateFrom,
  stateRef,
  userDayRef,
  type GenerationState,
} from '../generationStore';
import { toPixelPng } from '../images';
import { ImageModelError, type ImageModelErrorKind } from '../model/imageModel';
import { withTimeout } from '../model/timeout';
import { readId } from './apiceInput';
import { assertCanChangeReferences } from './mediaInput';

const FAILURE_CODES: Record<ImageModelErrorKind, ErrorCode> = {
  failure: 'generation-failed',
  timeout: 'generation-timeout',
  empty: 'generation-empty',
  rejected: 'generation-rejected',
};

interface ActiveReference {
  id: string;
  path: string;
  altText: string;
  uploadedAt: number;
}

interface Reserved {
  day: string;
  name: string;
  description: string;
  axes: string[];
  version: number;
  imageId: string | null;
  references: ActiveReference[];
}

/** Referencias no quitadas, en un orden estable (el de subida). Se ordena en memoria: no pide índice compuesto. */
async function activeReferences(ctx: Ctx, tx: Transaction, apiceId: string): Promise<ActiveReference[]> {
  const snap = await tx.get(ctx.db.collection(`apices/${apiceId}/references`).where('isRemoved', '==', false));
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      const uploadedAt = (data['uploadedAt'] as { toMillis?(): number } | undefined)?.toMillis?.() ?? 0;
      return { id: doc.id, path: data['path'] as string, altText: data['altText'] as string, uploadedAt };
    })
    .sort((a, b) => a.uploadedAt - b.uploadedAt || a.id.localeCompare(b.id));
}

async function reserve(ctx: Ctx, actor: Actor, apiceId: string): Promise<Reserved> {
  return ctx.db.runTransaction(async (tx) => {
    const now = ctx.now();
    const day = dayKey(now);
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    const apiceRef = ctx.db.doc(`apices/${apiceId}`);
    const apiceSnap = await tx.get(apiceRef);
    const stateSnap = await tx.get(stateRef(ctx, actor.uid));
    const state = stateFrom(stateSnap.data());
    const orphan = state.lock !== null && now.getTime() - state.lock.startedAt.getTime() >= LOCK_TTL_MS;
    const orphanDay = orphan && state.lock ? state.lock.day : null;
    const userSnap = await tx.get(userDayRef(ctx, actor.uid, day));
    const globalSnap = await tx.get(globalDayRef(ctx, day));
    // La reserva de un candado huérfano vive en el día en que se pidió, que puede no ser hoy.
    const otherDay = orphanDay !== null && orphanDay !== day ? orphanDay : null;
    const orphanUserSnap = otherDay ? await tx.get(userDayRef(ctx, actor.uid, otherDay)) : null;
    const orphanGlobalSnap = otherDay ? await tx.get(globalDayRef(ctx, otherDay)) : null;
    const references = apiceSnap.exists ? await activeReferences(ctx, tx, apiceId) : [];

    if (accountSnap.data()?.['status'] !== 'active') throw new ApiError('account-suspended');
    if (!apiceSnap.exists) throw new ApiError('invalid-request');
    const apice = apiceSnap.data() as Record<string, unknown>;
    assertCanChangeReferences(actor, apice);
    if (isBlocked(state, now)) throw new ApiError('generation-blocked');
    if (state.lock !== null && !orphan) throw new ApiError('generation-in-progress');

    let userCount = countFrom(userSnap.data());
    let globalCount = countFrom(globalSnap.data());
    if (orphanDay === day) {
      userCount = Math.max(0, userCount - 1);
      globalCount = Math.max(0, globalCount - 1);
    } else if (otherDay && orphanUserSnap && orphanGlobalSnap) {
      tx.set(userDayRef(ctx, actor.uid, otherDay), counterDoc(countFrom(orphanUserSnap.data()) - 1, now));
      tx.set(globalDayRef(ctx, otherDay), counterDoc(countFrom(orphanGlobalSnap.data()) - 1, now));
    }
    if (userCount >= DAILY_LIMIT) throw new ApiError('generation-limit-reached');
    if (globalCount >= GLOBAL_DAILY_LIMIT) throw new ApiError('generation-global-limit');

    tx.set(userDayRef(ctx, actor.uid, day), counterDoc(userCount + 1, now));
    tx.set(globalDayRef(ctx, day), counterDoc(globalCount + 1, now));
    tx.set(stateRef(ctx, actor.uid), stateDoc({ ...state, lock: { apiceId, startedAt: now, day } }));
    const image = apice['image'] as { id?: string } | null;
    return {
      day,
      name: apice['name'] as string,
      description: apice['description'] as string,
      axes: (apice['axes'] as string[] | undefined) ?? [],
      version: apice['version'] as number,
      imageId: image?.id ?? null,
      references,
    };
  });
}

type Outcome = 'failure' | 'discard';

/** Libera la reserva: devuelve la unidad al día en que se pidió y suelta el candado. Una falla del modelo alimenta el bloqueo. */
async function release(ctx: Ctx, uid: string, day: string, outcome: Outcome): Promise<void> {
  await ctx.db.runTransaction(async (tx) => {
    const now = ctx.now();
    const stateSnap = await tx.get(stateRef(ctx, uid));
    const userSnap = await tx.get(userDayRef(ctx, uid, day));
    const globalSnap = await tx.get(globalDayRef(ctx, day));
    const state = stateFrom(stateSnap.data());
    tx.set(userDayRef(ctx, uid, day), counterDoc(countFrom(userSnap.data()) - 1, now));
    tx.set(globalDayRef(ctx, day), counterDoc(countFrom(globalSnap.data()) - 1, now));
    const next: GenerationState =
      outcome === 'failure' ? { ...state, ...recordOutcome(state, 'failure', now), lock: null } : { ...state, lock: null };
    tx.set(stateRef(ctx, uid), stateDoc(next));
  });
}

async function produce(ctx: Ctx, reserved: Reserved): Promise<Buffer> {
  const built = buildImagePrompt({
    name: reserved.name,
    description: reserved.description,
    axes: reserved.axes as Parameters<typeof buildImagePrompt>[0]['axes'],
    references: reserved.references.map((ref) => ({ id: ref.id, altText: ref.altText, isRemoved: false })),
  });
  const bucket = ctx.storage.bucket();
  const references = await Promise.all(built.referenceIds.map(async (refId) => {
    const ref = reserved.references.find((r) => r.id === refId);
    const [bytes] = await bucket.file(ref?.path ?? '').download();
    return new Uint8Array(bytes);
  }));
  const raw = await withTimeout(ctx.imageModel.generate({ prompt: built.prompt, references }), GENERATION_TIMEOUT_MS);
  try {
    return await toPixelPng(raw);
  } catch {
    // Bytes que no son una imagen: para la persona es lo mismo que un resultado vacío.
    throw new ImageModelError('empty');
  }
}

export async function handleGenerateImage(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const actor = await requireActor(ctx, uid);
  const apiceId = readId(payload);
  const reserved = await reserve(ctx, actor, apiceId);

  let png: Buffer;
  try {
    png = await produce(ctx, reserved);
  } catch (error) {
    await release(ctx, actor.uid, reserved.day, 'failure');
    throw new ApiError(FAILURE_CODES[error instanceof ImageModelError ? error.kind : 'failure']);
  }

  // Al terminar se vuelve a mirar: la cuenta y el ápice pudieron cambiar durante la espera (RF-5 (001), RF-14 (001)).
  const verdict = await ctx.db.runTransaction(async (tx): Promise<ErrorCode | null> => {
    const now = ctx.now();
    const accountSnap = await tx.get(ctx.db.doc(`accounts/${actor.uid}`));
    const apiceSnap = await tx.get(ctx.db.doc(`apices/${apiceId}`));
    const stateSnap = await tx.get(stateRef(ctx, actor.uid));
    const userSnap = await tx.get(userDayRef(ctx, actor.uid, reserved.day));
    const globalSnap = await tx.get(globalDayRef(ctx, reserved.day));
    const state = stateFrom(stateSnap.data());
    const apice = apiceSnap.data();
    const problem: ErrorCode | null =
      accountSnap.data()?.['status'] !== 'active' ? 'account-suspended' : apice?.['isArchived'] === true ? 'apice-archived' : null;
    if (problem !== null) {
      tx.set(userDayRef(ctx, actor.uid, reserved.day), counterDoc(countFrom(userSnap.data()) - 1, now));
      tx.set(globalDayRef(ctx, reserved.day), counterDoc(countFrom(globalSnap.data()) - 1, now));
      tx.set(stateRef(ctx, actor.uid), stateDoc({ ...state, lock: null }));
      return problem;
    }
    tx.set(ctx.db.doc(`proposals/${apiceId}_${actor.uid}`), {
      apiceId,
      requestedByUid: actor.uid,
      png,
      referenceIds: reserved.references.map((ref) => ref.id),
      baseVersion: reserved.version,
      baseImageId: reserved.imageId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS),
    });
    tx.set(stateRef(ctx, actor.uid), stateDoc({ ...state, ...recordOutcome(state, 'success', now), lock: null }));
    return null;
  });
  if (verdict !== null) throw new ApiError(verdict);
  return {};
}
