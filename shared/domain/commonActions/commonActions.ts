// Spec 010 · Acciones Comunes: límites, validadores, permisos y orden. Dominio puro, sin React, DOM ni Firebase
// (RNF-1 (010), D-T2 (010)). El servidor y la interfaz parten de aquí.
import type { AccountStatus, Role } from '../accounts';
import type { Axis } from '../apice';
import { countCodePoints, excessReason, isBlank, validateLength } from '../limits';
import type { ErrorCode } from '../messages';
import { textLinkErrors } from '../textFormat';

/** RF-1 (010) · 1.1, RF-4 (010) · 4.1, RF-5 (010) · 5.3, D-3 (010), D-4 (010), D-6 (010), D-T2 (010), D-T33 (021). */
export const COMMON_ACTION_LIMITS = {
  titleMin: 3,
  title: 80,
  descriptionMin: 10,
  description: 2000,
  apicesMin: 3,
  apicesMax: 10,
  openPerAuthor: 20,
  pageSize: 24,
  /** Caminos que pide el mapa; la lista los muestra de 24 en 24. */
  mapLimit: 100,
} as const;

/** Estados de una Acción Común (§4.1 (010)). */
export const COMMON_ACTION_STATUSES = ['abierta', 'cerrada', 'archivada'] as const;
export type CommonActionStatus = (typeof COMMON_ACTION_STATUSES)[number];

/** Lo que de una Acción Común importa para decidir quién puede qué. */
export interface CommonActionState {
  status: CommonActionStatus;
  authorUid: string;
  authorSuspended: boolean;
}

/** Quien mira o actúa; `null` es un visitante. */
export interface CommonActionViewer {
  uid: string;
  role: Role;
  status: AccountStatus;
}

/** El documento `commonActions/{id}` como lo escribe el servidor (D-T1 (010)). */
export interface CommonActionDoc extends CommonActionState {
  title: string;
  description: string;
  axis: Axis | null;
  authorUsername: string;
  apiceIds: string[];
  participantUids: string[];
  participantCount: number;
  isListed: boolean;
  version: number;
}

export interface ActionValidation {
  ok: boolean;
  reason?: string;
}

const EMPTY = 'Falta un texto obligatorio: no puede quedar vacío ni con solo espacios.';

function check(raw: string, limit: number, what: string, min: number): ActionValidation {
  if (isBlank(raw)) return { ok: false, reason: EMPTY };
  if (countCodePoints(raw.trim()) < min) return { ok: false, reason: `${what} necesita al menos ${min} caracteres.` };
  const length = validateLength(raw, limit);
  if (!length.ok) return { ok: false, reason: excessReason(what, length) };
  const links = textLinkErrors(raw);
  if (links.length > 0) return { ok: false, reason: links.join(' ') };
  return { ok: true };
}

/** RF-1 (010) · 1.1, 1.2: el título, de 3 a 80 caracteres. */
export const validateActionTitle = (title: string): ActionValidation =>
  check(title, COMMON_ACTION_LIMITS.title, 'El título', COMMON_ACTION_LIMITS.titleMin);

/** RF-1 (010) · 1.1, 1.2: la descripción, de 10 a 2000 caracteres, con el formato de texto de RF-7 (001) · 7.4. */
export const validateActionDescription = (text: string): ActionValidation =>
  check(text, COMMON_ACTION_LIMITS.description, 'La descripción', COMMON_ACTION_LIMITS.descriptionMin);

export type ApiceIdsValidation = { ok: true } | { ok: false; code: Extract<ErrorCode, 'action-apices-min' | 'action-apices-max'> };

/** RF-1 (010) · 1.3, RF-4 (010) · 4.1: de 3 a 10 ápices distintos (D-3 (010), D-6 (010)). */
export function validateActionApiceIds(ids: readonly string[]): ApiceIdsValidation {
  const distinct = new Set(ids);
  if (distinct.size > COMMON_ACTION_LIMITS.apicesMax) return { ok: false, code: 'action-apices-max' };
  if (distinct.size !== ids.length || distinct.size < COMMON_ACTION_LIMITS.apicesMin) return { ok: false, code: 'action-apices-min' };
  return { ok: true };
}

/** RF-19 (021) · 19.2: cuántos ápices faltan para el mínimo. */
export const missingForPath = (chosen: number): number => Math.max(0, COMMON_ACTION_LIMITS.apicesMin - chosen);

const isActive = (viewer: CommonActionViewer | null): viewer is CommonActionViewer => viewer !== null && viewer.status === 'active';

/** RF-2 (010) · 2.2, RF-7 (010) · 7.2: se suma una cuenta activa a una Acción Común abierta. */
export const canJoin = (viewer: CommonActionViewer | null, action: CommonActionState): boolean =>
  isActive(viewer) && action.status === 'abierta';

/** RF-3 (010) · 3.1: se retira quien participa, salvo la autora mientras siga abierta. */
export const canLeave = (viewer: CommonActionViewer | null, action: CommonActionState): boolean =>
  isActive(viewer) && action.status !== 'archivada' && !(action.authorUid === viewer.uid && action.status === 'abierta');

/** RF-7 (010): la autora edita, cierra y reabre la suya mientras no esté archivada. */
export const canManage = (viewer: CommonActionViewer | null, action: CommonActionState): boolean =>
  isActive(viewer) && action.status !== 'archivada' && action.authorUid === viewer.uid;

/** RF-7 (010) · 7.1: archiva la autora o un facilitador. */
export const canArchive = (viewer: CommonActionViewer | null, action: CommonActionState): boolean =>
  isActive(viewer) && action.status !== 'archivada' && (action.authorUid === viewer.uid || viewer.role === 'facilitator');

/** RF-8 (010), RF-9 (010), D-T1 (010): la ven todas las personas si no está archivada y su autora no está suspendida. */
export const isListed = (action: CommonActionState): boolean => action.status !== 'archivada' && !action.authorSuspended;

/** RF-5 (010): las abiertas primero y, dentro de cada estado, la más reciente primero. No altera la lista recibida. */
export function sortCommonActions<T extends { status: CommonActionStatus; createdAt: number }>(items: readonly T[]): T[] {
  const rank = (status: CommonActionStatus) => COMMON_ACTION_STATUSES.indexOf(status);
  return [...items].sort((a, b) => rank(a.status) - rank(b.status) || b.createdAt - a.createdAt);
}

/** RF-6 (010): «n caminos» con su plural. */
export const pathsLabel = (count: number): string => (count === 1 ? '1 Acción Común' : `${count} Acciones Comunes`);
