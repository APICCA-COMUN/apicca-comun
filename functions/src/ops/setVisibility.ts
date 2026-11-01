// RF-13 (001) · Cambiar la visibilidad de un ápice (privado/público) y dejar el evento (D-T19 (001)).
import { canChangeVisibility } from '../../../shared/domain/access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { changeApiceFlag } from './apiceFlag';

export async function handleSetVisibility(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  const visibility = payload['visibility'];
  if (visibility !== 'private' && visibility !== 'public') throw new ApiError('invalid-request');
  return await changeApiceFlag(ctx, payload, uid, {
    type: 'visibility',
    check: (viewer, apice) => {
      if (apice.isArchived) throw new ApiError('apice-archived');
      if (!canChangeVisibility(viewer, apice)) throw new ApiError('forbidden');
    },
    update: (apice) => (apice['visibility'] === visibility ? null : { visibility }),
    detail: (apice) => ({ from: apice['visibility'], to: visibility }),
  });
}
