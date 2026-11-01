// Callable `media`: las ops que procesan imágenes (D-T2 (001)); aparte de `api` por su memoria y su tiempo.
import type { Ctx } from './context';
import { dispatch, type OpHandler } from './dispatch';
import { handleAddReference } from './ops/addReference';
import { handleGenerateImage } from './ops/generateImage';
import { handleReadReference } from './ops/readReference';

export const MEDIA_OPS: Record<string, OpHandler> = {
  addReference: handleAddReference,
  generateImage: handleGenerateImage,
  readReference: handleReadReference,
};

export function handleMedia(ctx: Ctx, data: unknown, uid: string | null): Promise<unknown> {
  return dispatch(MEDIA_OPS, data, ctx, uid);
}
