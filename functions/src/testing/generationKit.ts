// Utillaje de las pruebas de generación de imágenes; no es código de producción ni cita requisitos.
import sharp from 'sharp';
import type { Ctx } from '../context';
import { ImageModelError, type ImageModel, type ImageRequest } from '../model/imageModel';

export const sampleImage = (): Promise<Buffer> =>
  sharp({ create: { width: 90, height: 70, channels: 3, background: '#aa5522' } }).png().toBuffer();

/** Modelo que espera una señal antes de responder: sirve para tener varias generaciones a la vez. */
export function gatedModel(image: Uint8Array): ImageModel & { started(): number; open(): void; requests: ImageRequest[] } {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const requests: ImageRequest[] = [];
  return {
    requests,
    started: () => requests.length,
    open,
    async generate(request) {
      requests.push(request);
      await gate;
      return image;
    },
  };
}

export const failingModel = (kind: ConstructorParameters<typeof ImageModelError>[0]): ImageModel => ({
  generate: () => Promise.reject(new ImageModelError(kind)),
});

export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function until(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const limit = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > limit) throw new Error('until: se agotó la espera');
    await wait(20);
  }
}

export const countOf = async (ctx: Ctx, path: string): Promise<number | undefined> =>
  (await ctx.db.doc(path).get()).data()?.['count'] as number | undefined;

export const withModel = (ctx: Ctx, imageModel: ImageModel): Ctx => ({ ...ctx, imageModel });
