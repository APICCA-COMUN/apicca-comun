// RF-16 (001) · Una facilitadora retira una imagen, con motivo y en cualquier ápice: una referencia (`refId`) o una imagen
// aceptada del ápice (`imageId`).
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { retractApiceImage } from './retractApiceImage';
import { removeAs } from './referenceRemoval';

export function handleRetractImage(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  if ('imageId' in payload) {
    if ('refId' in payload) return Promise.reject(new ApiError('invalid-request'));
    return retractApiceImage(ctx, payload, uid);
  }
  return removeAs(ctx, payload, uid, 'retracted');
}
