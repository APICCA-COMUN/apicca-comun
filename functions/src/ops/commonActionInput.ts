// RF-1 (010) · 1.1 a 1.4, RF-4 (010) · 4.1, D-T3 (010) · Lectura común de los datos de una Acción Común que llegan en el
// payload, y lectura en la transacción de la Acción Común y de los ápices que enlaza.
import type { DocumentReference, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { canView, type ApiceAccessState } from '../../../shared/domain/access';
import { AXES, type Axis } from '../../../shared/domain/apice';
import {
  validateActionApiceIds,
  validateActionDescription,
  validateActionTitle,
  type ActionValidation,
  type CommonActionDoc,
  type CommonActionViewer,
} from '../../../shared/domain/commonActions';
import type { Ctx } from '../context';
import { ApiError } from '../errors';
import { readSafeId } from '../ids';
import { ConstitutionTextError } from './constitutionInput';

function read(raw: unknown, check: (text: string) => ActionValidation): string {
  if (typeof raw !== 'string') throw new ApiError('invalid-request');
  const checked = check(raw);
  if (checked.ok) return raw.trim();
  if (raw.trim().length === 0) throw new ApiError('text-empty');
  const tooLong = checked.reason?.includes('admite hasta') === true;
  throw new ConstitutionTextError(tooLong ? 'text-too-long' : 'invalid-request', checked.reason ?? '');
}

export const readActionTitle = (raw: unknown): string => read(raw, validateActionTitle);
export const readActionDescription = (raw: unknown): string => read(raw, validateActionDescription);

/** RF-1 (010) · 1.4: el eje es opcional; ausente o `null` es «sin eje». */
export function readOptionalAxis(raw: unknown): Axis | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new ApiError('invalid-request');
  if (!(AXES as readonly string[]).includes(raw)) throw new ApiError('axis-unknown');
  return raw as Axis;
}

/** RF-1 (010) · 1.3, RF-4 (010) · 4.1: de 3 a 10 ids distintos. */
export function readApiceIds(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length > 64) throw new ApiError('invalid-request');
  const ids = raw.map((_, index) => readSafeId(raw as unknown as Record<string, unknown>, String(index)));
  const checked = validateActionApiceIds(ids);
  if (!checked.ok) throw new ApiError(checked.code);
  return ids;
}

export const readActionId = (payload: Record<string, unknown>): string => readSafeId(payload, 'actionId');

export const actionRef = (ctx: Ctx, id: string): DocumentReference => ctx.db.doc(`commonActions/${id}`);

/** Lee la Acción Común en la transacción; si no existe, `action-not-found`. */
export async function readAction(tx: Transaction, ref: DocumentReference): Promise<{ snap: DocumentSnapshot; data: CommonActionDoc }> {
  const snap = await tx.get(ref);
  if (!snap.exists) throw new ApiError('action-not-found');
  return { snap, data: snap.data() as CommonActionDoc };
}

/** RF-1 (010) · 1.3, RF-4 (010): todos los ápices existen y quien enlaza puede verlos (RF-13 (001)). */
export async function checkVisibleApices(ctx: Ctx, tx: Transaction, viewer: CommonActionViewer, ids: readonly string[]): Promise<void> {
  const snaps = await tx.getAll(...ids.map((id) => ctx.db.doc(`apices/${id}`)));
  for (const snap of snaps) {
    if (!snap.exists || !canView(viewer, snap.data() as ApiceAccessState)) throw new ApiError('action-apices-min');
  }
}

/** Lo que se guarda en `versions/{n}` (RF-7 (010) · 7.3). */
export const versionOf = (data: Pick<CommonActionDoc, 'title' | 'description' | 'axis' | 'apiceIds'>, editedBy: string, editedAt: Date) => ({
  title: data.title,
  description: data.description,
  axis: data.axis,
  apiceIds: data.apiceIds,
  editedBy,
  editedAt,
});
