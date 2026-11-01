// RF-1 (007), RF-2 (007), RF-3 (007), RF-4 (007), RNF-1 (007), RF-5 (016) · Entrega la imagen de una referencia a quien puede verla
// (D-T2 (007)). La cuenta se lee en cada petición: sin sesión, sin cuenta o suspendida, quien llama es visitante.
// Todo rechazo, incluido el de algo inexistente, es el mismo error, para no dar pistas.
import type { AccountDoc } from '../../../shared/domain/accounts';
import { canReadReference, type ApiceViewer } from '../../../shared/domain/access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { consumeAnonymousReadSlot } from '../rateLimit';
import { readId } from './apiceInput';
import { accessStateOf, readToken } from './mediaInput';

async function viewerOf(ctx: Ctx, uid: string | null): Promise<ApiceViewer | null> {
  if (uid === null) return null;
  const snap = await ctx.db.doc(`accounts/${uid}`).get();
  if (!snap.exists) return null;
  const { role, status } = snap.data() as AccountDoc;
  return status === 'active' ? { uid, role, status } : null;
}

export async function handleReadReference(
  ctx: Ctx,
  payload: Record<string, unknown>,
  uid: string | null,
): Promise<{ contentType: string; data: string }> {
  const id = readId(payload);
  const refId = readToken(payload, 'refId');
  const path = `apices/${id}/references/${refId}`;
  const viewer = await viewerOf(ctx, uid);
  // Quien lee como visitante (sin sesión, sin cuenta o suspendida): 100 lecturas por origen y por hora (RF-5 (016)).
  if (viewer === null) await consumeAnonymousReadSlot(ctx);
  const [apiceSnap, refSnap] = await Promise.all([ctx.db.doc(`apices/${id}`).get(), ctx.db.doc(path).get()]);
  if (!apiceSnap.exists || !refSnap.exists) throw new ApiError('reference-not-found');
  const isRemoved = refSnap.data()?.['isRemoved'] !== false;
  if (!canReadReference(viewer, accessStateOf(apiceSnap.data() as Record<string, unknown>), isRemoved)) {
    throw new ApiError('reference-not-found');
  }
  const file = ctx.storage.bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new ApiError('reference-not-found');
  const [[bytes], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
  return { contentType: meta.contentType ?? 'application/octet-stream', data: bytes.toString('base64') };
}
