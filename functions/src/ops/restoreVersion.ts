// RF-12 (001), RF-9 (001) · Restaurar una versión anterior copiándola como versión nueva, con las reglas de edición y conflicto.
import { requireActor } from '../access';
import { saveVersion, type LocationChange, type StoredContent } from '../apiceStore';
import type { Location, Point } from '../../../shared/domain/location';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readId, readInteger } from './apiceInput';
import { checkEditable, toEditResult, type EditResult } from './editApice';

export async function handleRestoreVersion(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<EditResult> {
  const actor = await requireActor(ctx, uid);
  const id = readId(payload);
  const n = readInteger(payload, 'n');
  const baseVersion = readInteger(payload, 'baseVersion');
  const source = await ctx.db.doc(`apices/${id}/versions/${n}`).get(); // las versiones son inmutables
  if (!source.exists) throw new ApiError('invalid-request');
  // La versión copiada lleva su ubicación y su punto exacto (RF-9 (001)); las versiones son inmutables.
  const sourceLocation = (source.get('location') as Location | null | undefined) ?? null;
  let location: LocationChange = { mode: 'remove' };
  if (sourceLocation !== null) {
    const exact = await ctx.db.doc(`apices/${id}/versions/${n}/private/exact`).get();
    if (!exact.exists) throw new ApiError('invalid-request');
    const { lat, lng } = exact.data() as Point;
    location = { mode: 'set', point: { lat, lng }, precision: sourceLocation.precision };
  }
  const result = await saveVersion(ctx, id, {
    baseVersion,
    content: source.get('content') as StoredContent,
    location,
    saver: { uid: actor.uid, username: actor.username },
    kind: 'restore',
    restoredFromN: n,
    requireActiveUid: actor.uid,
    check: checkEditable(actor),
  });
  return toEditResult(result);
}
