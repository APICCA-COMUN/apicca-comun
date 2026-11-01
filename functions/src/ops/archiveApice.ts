// RF-14 (001) · Archivar un ápice sin destruir contenido, versiones ni imagen (D-T19 (001)).
import { canArchive } from '../../../shared/domain/access';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { changeApiceFlag } from './apiceFlag';

export function handleArchiveApice(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> {
  return changeApiceFlag(ctx, payload, uid, {
    type: 'archive',
    check: (viewer, apice) => {
      if (!canArchive(viewer, apice)) throw new ApiError('forbidden');
    },
    update: (apice, actor, at) =>
      apice['isArchived'] === true ? null : { isArchived: true, archive: { byUsername: actor.username, at } },
    detail: () => ({}),
  });
}
