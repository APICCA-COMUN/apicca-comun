// RF-15 (001), RF-16 (001) · Lectura común del payload y permiso sobre las referencias de un ápice.
import { canEdit, type ApiceAccessState } from '../../../shared/domain/access';
import type { Actor } from '../access';
import { ApiError } from '../errors';

/** Identificador opaco que viaja en el payload y entra en una ruta: sin separadores ni puntos relativos. */
export function readToken(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value === '' || value.length > 128 || value.includes('/') || value === '.' || value === '..') {
    throw new ApiError('invalid-request');
  }
  return value;
}

export const accessStateOf = (apice: Record<string, unknown>): ApiceAccessState => ({
  visibility: apice['visibility'] as ApiceAccessState['visibility'],
  isArchived: apice['isArchived'] === true,
  authorUid: apice['authorUid'] as string,
});

/** Subir o quitar referencias exige un ápice no archivado que la persona pueda editar (RF-15 (001), RF-16 (001)). */
export function assertCanChangeReferences(actor: Actor, apice: Record<string, unknown>): void {
  const state = accessStateOf(apice);
  if (state.isArchived) throw new ApiError('apice-archived');
  if (!canEdit({ uid: actor.uid, role: actor.role, status: actor.status }, state)) throw new ApiError('forbidden');
}

export const newId = (random: (bytes: number) => Uint8Array): string => Buffer.from(random(15)).toString('base64url');
