// RF-14 (001) · Restaurar un ápice archivado: vuelve a mostrarse según su visibilidad (D-T19 (001)).
import { canArchive } from '../../../shared/domain/access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { changeApiceFlag } from './apiceFlag';

export function handleRestoreApice(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  return changeApiceFlag(ctx, payload, uid, {
    type: 'restore',
    check: (viewer, apice) => {
      if (!canArchive(viewer, apice)) throw new ApiError('forbidden');
    },
    update: (apice) => (apice['isArchived'] === true ? { isArchived: false, archive: null } : null),
    detail: () => ({}),
  });
}
