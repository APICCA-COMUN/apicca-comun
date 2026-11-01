// RF-10 (001), RF-9 (001) · Editar el contenido y el estado de un ápice con `baseVersion` (D-T5 (001)): versión nueva, conflicto o sin cambios.
import { canEdit } from '../../../shared/domain/access';
import { isNoopEdit } from '../../../shared/domain/versions';
import { requireActor, type Actor } from '../access';
import { saveVersion, type CurrentApice, type LocationChange, type SaveVersionResult, type StoredContent } from '../apiceStore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readContent, readId, readInteger, readLocationChange } from './apiceInput';

export type EditResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; current: { version: number; content: StoredContent } };

export const toEditResult = (result: SaveVersionResult): EditResult =>
  result.ok ? result : { ok: false, conflict: true, current: result.current };

/** Archivado y permisos, dentro de la transacción (RF-10 (001), RF-14 (001)). */
export const checkEditable =
  (actor: Actor) =>
  (current: CurrentApice): void => {
    if (current.isArchived) throw new ApiError('apice-archived');
    if (!canEdit({ uid: actor.uid, role: actor.role, status: actor.status }, current)) throw new ApiError('forbidden');
  };

/** Si el cambio de ubicación no cambia nada con la ubicación vigente (RF-9 (001)). */
export const isLocationNoop = (current: CurrentApice, change: LocationChange): boolean => {
  if (change.mode === 'keep') return true;
  if (change.mode === 'remove') return current.location === null;
  if (change.mode === 'precision') return current.location?.precision === change.precision;
  return false;
};

export async function handleEditApice(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<EditResult> {
  const actor = await requireActor(ctx, uid);
  const id = readId(payload);
  const baseVersion = readInteger(payload, 'baseVersion');
  const content = readContent(payload['content']);
  // La interfaz manda `location` junto a `content`; se admite también dentro de él.
  const location = readLocationChange(payload['location'] ?? (payload['content'] as Record<string, unknown>)['location']);
  const checkEdit = checkEditable(actor);
  const result = await saveVersion(ctx, id, {
    baseVersion,
    content,
    location,
    saver: { uid: actor.uid, username: actor.username },
    kind: 'edit',
    requireActiveUid: actor.uid,
    check: checkEdit,
    isNoop: (current) => isNoopEdit(current.content, content) && isLocationNoop(current, location),
  });
  return toEditResult(result);
}
