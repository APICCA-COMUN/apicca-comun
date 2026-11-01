// Permisos entre cuentas (RF-5 (001)).
import type { AccountStatus, Role } from './accounts';
import type { Visibility } from './apice';
import type { ErrorCode } from './messages';

export interface Actor {
  uid: string;
  role: Role;
}

export type Permission = { ok: true } | { ok: false; code: ErrorCode };

/** Solo un facilitador suspende, y nunca a otro facilitador ni a sí mismo. */
export function canSuspend(actor: Actor, target: Actor): Permission {
  if (actor.role !== 'facilitator') return { ok: false, code: 'forbidden' };
  if (actor.uid === target.uid) return { ok: false, code: 'cannot-suspend-self' };
  if (target.role === 'facilitator') return { ok: false, code: 'cannot-suspend-facilitator' };
  return { ok: true };
}

// Quién ve y edita un ápice (RF-10 (001), RF-12 (001), RF-13 (001), RF-14 (001), RF-22 (001), D-T18 (001)).
// Es la única definición: la UI, las ops y las pruebas de reglas parten de aquí, y la tabla
// `APICE_ACCESS_TABLE` se ejecuta contra el dominio y contra las reglas del emulador.

/** Quien mira: `null` es un visitante sin sesión. */
export interface ApiceViewer {
  uid: string;
  role: Role;
  status: AccountStatus;
}

/** Lo que de un ápice importa para decidir el acceso. */
export interface ApiceAccessState {
  visibility: Visibility;
  isArchived: boolean;
  authorUid: string;
}

const isActive = (viewer: ApiceViewer | null): viewer is ApiceViewer => viewer !== null && viewer.status === 'active';

/** Público y no archivado: cualquiera, incluso quien tiene la cuenta suspendida. Si no, solo cuentas activas. */
export function canView(viewer: ApiceViewer | null, apice: ApiceAccessState): boolean {
  if (apice.visibility === 'public' && !apice.isArchived) return true;
  if (!isActive(viewer)) return false;
  if (!apice.isArchived) return true;
  return apice.authorUid === viewer.uid || viewer.role === 'facilitator';
}

/** Cualquier cuenta activa edita un ápice no archivado; la autoría no importa (RF-10 (001), RF-22 (001)). */
export function canEdit(viewer: ApiceViewer | null, apice: ApiceAccessState): boolean {
  return isActive(viewer) && !apice.isArchived && canView(viewer, apice);
}

/** Versiones y eventos: nunca los visitantes ni las cuentas suspendidas (RF-12 (001)). */
export function canSeeHistory(viewer: ApiceViewer | null, apice: ApiceAccessState): boolean {
  return isActive(viewer) && canView(viewer, apice);
}

/** La imagen de una referencia: quien ve el ápice; si está quitada o retirada, solo un facilitador activo (RF-1 (007), RF-2 (007)). */
export function canReadReference(viewer: ApiceViewer | null, apice: ApiceAccessState, isRemoved: boolean): boolean {
  if (!canView(viewer, apice)) return false;
  return !isRemoved || (isActive(viewer) && viewer.role === 'facilitator');
}

const isAuthorOrFacilitator = (viewer: ApiceViewer, apice: ApiceAccessState): boolean =>
  viewer.role === 'facilitator' || apice.authorUid === viewer.uid;

/** Autora o facilitadora activas, y solo mientras el ápice no está archivado (RF-13 (001), RF-14 (001)). */
export function canChangeVisibility(viewer: ApiceViewer | null, apice: ApiceAccessState): boolean {
  return isActive(viewer) && !apice.isArchived && isAuthorOrFacilitator(viewer, apice);
}

/** Archivar y restaurar: autora o facilitadora activas, en cualquier estado del ápice (RF-14 (001)). */
export function canArchive(viewer: ApiceViewer | null, apice: ApiceAccessState): boolean {
  return isActive(viewer) && isAuthorOrFacilitator(viewer, apice);
}

export type ApiceActorName =
  | 'visitor'
  | 'suspended'
  | 'member'
  | 'author'
  | 'suspendedAuthor'
  | 'facilitator'
  | 'suspendedFacilitator';

export type ApiceStateName = 'public' | 'private' | 'archived-public' | 'archived-private';

/** Cada actor de la tabla: su uid es su nombre, y `isAuthor` dice si escribió el ápice. */
export const APICE_ACTORS: Record<ApiceActorName, { viewer: ApiceViewer | null; isAuthor: boolean }> = {
  visitor: { viewer: null, isAuthor: false },
  suspended: { viewer: { uid: 'suspended', role: 'member', status: 'suspended' }, isAuthor: false },
  member: { viewer: { uid: 'member', role: 'member', status: 'active' }, isAuthor: false },
  author: { viewer: { uid: 'author', role: 'member', status: 'active' }, isAuthor: true },
  suspendedAuthor: { viewer: { uid: 'suspendedAuthor', role: 'member', status: 'suspended' }, isAuthor: true },
  facilitator: { viewer: { uid: 'facilitator', role: 'facilitator', status: 'active' }, isAuthor: false },
  suspendedFacilitator: {
    viewer: { uid: 'suspendedFacilitator', role: 'facilitator', status: 'suspended' },
    isAuthor: false,
  },
};

export const APICE_STATES: Record<ApiceStateName, { visibility: Visibility; isArchived: boolean }> = {
  public: { visibility: 'public', isArchived: false },
  private: { visibility: 'private', isArchived: false },
  'archived-public': { visibility: 'public', isArchived: true },
  'archived-private': { visibility: 'private', isArchived: true },
};

/** El ápice de un estado visto desde un actor: su autor es el actor si `isAuthor`, si no, otra persona. */
export function apiceFor(state: ApiceStateName, actor: ApiceActorName): ApiceAccessState {
  const { viewer, isAuthor } = APICE_ACTORS[actor];
  return { ...APICE_STATES[state], authorUid: isAuthor && viewer !== null ? viewer.uid : 'otra-persona' };
}

export interface ApiceAccessRow {
  actor: ApiceActorName;
  state: ApiceStateName;
  view: boolean;
  edit: boolean;
  history: boolean;
  visibility: boolean;
  archive: boolean;
}

const row = (
  actor: ApiceActorName,
  state: ApiceStateName,
  [view, edit, history, visibility, archive]: readonly [boolean, boolean, boolean, boolean, boolean],
): ApiceAccessRow => ({ actor, state, view, edit, history, visibility, archive });

const T = true;
const F = false;

/** Verdad de referencia, escrita a mano y sin llamar a las funciones de arriba: (ver, editar, historial, visibilidad, archivar o restaurar). */
export const APICE_ACCESS_TABLE: readonly ApiceAccessRow[] = [
  row('visitor', 'public', [T, F, F, F, F]),
  row('visitor', 'private', [F, F, F, F, F]),
  row('visitor', 'archived-public', [F, F, F, F, F]),
  row('visitor', 'archived-private', [F, F, F, F, F]),
  row('suspended', 'public', [T, F, F, F, F]),
  row('suspended', 'private', [F, F, F, F, F]),
  row('suspended', 'archived-public', [F, F, F, F, F]),
  row('suspended', 'archived-private', [F, F, F, F, F]),
  row('member', 'public', [T, T, T, F, F]),
  row('member', 'private', [T, T, T, F, F]),
  row('member', 'archived-public', [F, F, F, F, F]),
  row('member', 'archived-private', [F, F, F, F, F]),
  row('author', 'public', [T, T, T, T, T]),
  row('author', 'private', [T, T, T, T, T]),
  row('author', 'archived-public', [T, F, T, F, T]),
  row('author', 'archived-private', [T, F, T, F, T]),
  row('suspendedAuthor', 'public', [T, F, F, F, F]),
  row('suspendedAuthor', 'private', [F, F, F, F, F]),
  row('suspendedAuthor', 'archived-public', [F, F, F, F, F]),
  row('suspendedAuthor', 'archived-private', [F, F, F, F, F]),
  row('facilitator', 'public', [T, T, T, T, T]),
  row('facilitator', 'private', [T, T, T, T, T]),
  row('facilitator', 'archived-public', [T, F, T, F, T]),
  row('facilitator', 'archived-private', [T, F, T, F, T]),
  row('suspendedFacilitator', 'public', [T, F, F, F, F]),
  row('suspendedFacilitator', 'private', [F, F, F, F, F]),
  row('suspendedFacilitator', 'archived-public', [F, F, F, F, F]),
  row('suspendedFacilitator', 'archived-private', [F, F, F, F, F]),
];
