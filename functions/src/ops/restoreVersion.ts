// RF-2 (018), D-T6 (018), D-T7 (018): cobra una unidad del cupo diario de ediciones.
// RF-12 (001), RF-9 (001), RF-2 (016) · Restaurar una versión anterior copiándola como versión nueva, con las reglas de edición y conflicto.
import { canSetLocation } from '../../../shared/domain/access';
import { requireActor } from '../access';
import { saveVersion, type LocationChange, type StoredContent } from '../apiceStore';
import type { Location, Point } from '../../../shared/domain/location';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { takeDailySlot } from '../rateLimit';
import { readId, readInteger } from './apiceInput';
import { checkEditable, toEditResult, type EditResult } from './editApice';

const KEEP: LocationChange = { mode: 'keep' };

/** La ubicación de la versión `n`, o `keep` si fue purgada o perdió su punto exacto (RF-2 (016) · 2.2, RF-2 (016) · 2.3). */
async function locationOf(ctx: Ctx, id: string, n: number, source: DocumentSnapshot): Promise<LocationChange> {
  if (source.get('locationPurged') === true) return KEEP;
  const sourceLocation = (source.get('location') as Location | null | undefined) ?? null;
  if (sourceLocation === null) return { mode: 'remove' };
  const exact = await ctx.db.doc(`apices/${id}/versions/${n}/private/exact`).get();
  if (!exact.exists) return KEEP;
  const { lat, lng } = exact.data() as Point;
  return { mode: 'set', point: { lat, lng }, precision: sourceLocation.precision };
}

export async function handleRestoreVersion(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<EditResult> {
  const actor = await requireActor(ctx, uid);
  const id = readId(payload);
  const n = readInteger(payload, 'n');
  const baseVersion = readInteger(payload, 'baseVersion');
  const source = await ctx.db.doc(`apices/${id}/versions/${n}`).get(); // solo la purga (RF-2 (016) · 2.2) cambia una versión
  if (!source.exists) throw new ApiError('invalid-request');
  // La versión copiada lleva su ubicación y su punto exacto (RF-9 (001)), salvo que quien restaura no sea la autora ni
  // facilite (RF-2 (016) · 2.1) o que el punto ya no exista (RF-2 (016) · 2.3): entonces se conserva la ubicación vigente.
  const authorUid = (await ctx.db.doc(`apices/${id}`).get()).get('authorUid') as string | undefined; // no cambia nunca
  const mayRestoreLocation = canSetLocation(
    { uid: actor.uid, role: actor.role, status: actor.status },
    { visibility: 'public', isArchived: false, authorUid: authorUid ?? '' },
  );
  const location = mayRestoreLocation ? await locationOf(ctx, id, n, source) : KEEP;
  const result = await saveVersion(ctx, id, {
    baseVersion,
    content: source.get('content') as StoredContent,
    location,
    saver: { uid: actor.uid, username: actor.username },
    kind: 'restore',
    restoredFromN: n,
    requireActiveUid: actor.uid,
    check: checkEditable(actor, location),
    charge: (tx) => takeDailySlot(ctx, tx, 'edit', actor.uid),
  });
  return toEditResult(result);
}
