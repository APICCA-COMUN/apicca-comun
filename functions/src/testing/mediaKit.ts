// Utillaje de las pruebas de referencias contra el emulador de Storage; no es código de producción ni cita requisitos.
import sharp from 'sharp';
import type { Ctx } from '../context';

export const png = (width = 8, height = 8): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } }).png().toBuffer();

export const jpegWithGps = (): Promise<Buffer> =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: '#cc3333' } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 26/1 46/1', GPSLongitudeRef: 'W', GPSLongitude: '79/1 58/1 56/1' } })
    .toBuffer();

export const animatedGif = (): Promise<Buffer> => {
  const frame = (shade: number): Buffer => Buffer.alloc(8 * 8 * 4, shade);
  return sharp(Buffer.concat([frame(0), frame(200)]), { raw: { width: 8, height: 16, channels: 4, pageHeight: 8 } })
    .gif({ loop: 0, delay: [100, 100] })
    .toBuffer();
};

export async function clearBucket(ctx: Ctx): Promise<void> {
  await ctx.storage.bucket().deleteFiles({ force: true });
}

export async function putFile(ctx: Ctx, path: string, bytes: Uint8Array, contentType = 'image/png'): Promise<void> {
  await ctx.storage.bucket().file(path).save(Buffer.from(bytes), { contentType });
}

/**
 * Lo que hace el cliente antes de `addReference`: la reserva del servidor (RF-7 (016) · 7.3) y el temporal en
 * `uploads/{uid}/{uploadId}`. `expiresInMs` negativo deja la reserva caducada.
 */
export async function putUpload(
  ctx: Ctx,
  uid: string,
  uploadId: string,
  bytes: Uint8Array,
  options: { contentType?: string; expiresInMs?: number } = {},
): Promise<void> {
  const now = ctx.now();
  await ctx.db.doc(`uploadReservations/${uploadId}`).set({
    uid,
    createdAt: now,
    expiresAt: new Date(now.getTime() + (options.expiresInMs ?? 60 * 60 * 1000)),
  });
  await putFile(ctx, `uploads/${uid}/${uploadId}`, bytes, options.contentType);
}

export async function listPaths(ctx: Ctx, prefix: string): Promise<string[]> {
  const [files] = await ctx.storage.bucket().getFiles({ prefix });
  return files.map((file) => file.name).sort();
}

export async function readFile(ctx: Ctx, path: string): Promise<Buffer> {
  const [bytes] = await ctx.storage.bucket().file(path).download();
  return bytes;
}

/** Siembra una referencia ya aceptada: archivo, documento y contador del ápice. */
export async function seedReference(
  ctx: Ctx,
  apiceId: string,
  refId: string,
  options: { uploader?: { uid: string; username: string }; removal?: Record<string, unknown> } = {},
): Promise<void> {
  const path = `apices/${apiceId}/references/${refId}`;
  const bytes = await png();
  await putFile(ctx, path, bytes);
  const removed = options.removal !== undefined;
  await ctx.db.doc(path).set({
    path,
    altText: `Referencia ${refId}`,
    contentType: 'image/png',
    bytes: bytes.length,
    width: 8,
    height: 8,
    uploadedByUid: options.uploader?.uid ?? 'uid-sembrado',
    uploadedByUsername: options.uploader?.username ?? 'sembrada',
    uploadedAt: ctx.now(),
    isRemoved: removed,
    removal: options.removal ?? null,
  });
  if (!removed) {
    const apice = await ctx.db.doc(`apices/${apiceId}`).get();
    await apice.ref.update({ activeReferenceCount: ((apice.data()?.['activeReferenceCount'] as number | undefined) ?? 0) + 1 });
  }
}
