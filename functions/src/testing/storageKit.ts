// Utillaje de las pruebas contra el emulador de Storage; no es código de producción ni cita requisitos.
import type { Ctx } from '../context';

/** PNG de 1 × 1 píxel: los bytes fijos de los archivos que siembran las pruebas. */
export const PNG_BYTES = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==', 'base64'),
);

export async function clearBucket(ctx: Ctx): Promise<void> {
  await ctx.storage.bucket().deleteFiles({ force: true });
}

export async function putFile(ctx: Ctx, path: string, bytes: Uint8Array, contentType = 'image/png'): Promise<void> {
  await ctx.storage.bucket().file(path).save(Buffer.from(bytes), { contentType });
}

export async function listPaths(ctx: Ctx, prefix: string): Promise<string[]> {
  const [files] = await ctx.storage.bucket().getFiles({ prefix });
  return files.map((file) => file.name).sort();
}

export async function readFile(ctx: Ctx, path: string): Promise<Buffer> {
  const [bytes] = await ctx.storage.bucket().file(path).download();
  return bytes;
}
