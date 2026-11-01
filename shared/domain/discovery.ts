// Descubrimiento: filtros, orden, extracto y forma de las consultas de la lista y el mapa
// (RF-21 (001), D-T17 (001)). De `listQueryShape` salen las consultas del cliente y los índices.
import type { ApiceStatus, Axis } from './apice';
import { compareTimestampsDescending, type TimestampLike } from './order';

/** Ápices por tanda de la lista. */
export const PAGE_SIZE = 24;
/** Tope de ápices que pide el mapa; si hay más, el sitio avisa y la lista sigue completa. */
export const MAP_LIMIT = 300;
/** Caracteres de la descripción que muestra la tarjeta. */
export const EXCERPT_LENGTH = 200;

export interface ListFilters {
  /** Vacío = sin filtro de ejes; con ejes, basta que el ápice conecte alguno. */
  axes: Axis[];
  status: ApiceStatus | null;
}

export const NO_FILTERS: ListFilters = { axes: [], status: null };

/** Lo mínimo de un ápice que necesitan los filtros y el orden. */
export interface ApiceSummary {
  axes: readonly Axis[];
  status: ApiceStatus;
  updatedAt: TimestampLike;
}

export function hasActiveFilters(filters: ListFilters): boolean {
  return filters.axes.length > 0 || filters.status !== null;
}

/** Alguno de los ejes elegidos y el estado elegido; cada filtro vacío no restringe. */
export function matchesFilters(apice: Pick<ApiceSummary, 'axes' | 'status'>, filters: ListFilters): boolean {
  if (filters.axes.length > 0 && !filters.axes.some((axis) => apice.axes.includes(axis))) return false;
  return filters.status === null || apice.status === filters.status;
}

/** De la más reciente a la más antigua. */
export function compareApices(a: Pick<ApiceSummary, 'updatedAt'>, b: Pick<ApiceSummary, 'updatedAt'>): number {
  return compareTimestampsDescending(a.updatedAt, b.updatedAt);
}

/**
 * Primeros `EXCERPT_LENGTH` puntos de código de la descripción, con los espacios y saltos reducidos
 * a uno. Si el corte cae antes de una marca combinante (una tilde suelta), la marca se conserva con su letra.
 */
export function apiceExcerpt(description: string): string {
  const points = Array.from(description.replace(/\s+/g, ' ').trim());
  if (points.length <= EXCERPT_LENGTH) return points.join('');
  let end = EXCERPT_LENGTH;
  while (end < points.length && /^\p{M}$/u.test(points[end] ?? '')) end += 1;
  return points.slice(0, end).join('');
}

export type EmptyState = 'no-apices' | 'no-results';

/** `null` si hay algo que mostrar; con filtros activos y nada, «sin resultados»; sin filtros, «sin ápices». */
export function emptyState(input: { count: number; filters: ListFilters }): EmptyState | null {
  if (input.count > 0) return null;
  return hasActiveFilters(input.filters) ? 'no-results' : 'no-apices';
}

/**
 * Quién mira: la lista general (visitante o inscrita), una vista «Archivados» (propios o todos) o
 * «mis ápices» de Mi tablero (`mine`, RF-11 (003), D-T12 (003)).
 */
export type ListAudience = 'visitor' | 'member' | 'archived-own' | 'archived-all' | 'mine';

/** Una condición de la consulta. El rango (`<=`) cubre las propuestas vencidas (D-T14 (004)). */
export interface QueryCondition {
  field: string;
  op: '==' | 'array-contains-any' | '<=';
  value: string | boolean | number | string[];
}

/** Una consulta declarada: de ella salen la del cliente o del servidor y su índice (D-T14 (004)). */
export interface QueryShape {
  collection: string;
  conditions: QueryCondition[];
  orderBy: { field: string; direction: 'asc' | 'desc' };
  /** Sin tope, la consulta trae todo lo que cumple (por ejemplo, las vencidas que cierra el servidor). */
  limit?: number;
}

/** La lista y el mapa de ápices siempre llevan tope. */
export type ListQueryShape = QueryShape & { limit: number };

export interface QueryInput {
  audience: ListAudience;
  filters: ListFilters;
  /** Obligatorio con `archived-own` y `mine`. */
  uid?: string;
  /** El mapa pide solo ápices con ubicación y con su propio tope. */
  map?: boolean;
}

/** Plan §5.3: condiciones fijas por quién mira, más las opcionales (solo en la lista general). */
export function listQueryShape(input: QueryInput): ListQueryShape {
  // «Mis ápices» (D-T12 (003)): los no archivados de la autora, sin filtros ni mapa, con el tope de la lista.
  if (input.audience === 'mine') {
    if (input.uid === undefined) throw new Error('mine requiere uid');
    return {
      collection: 'apices',
      conditions: [
        { field: 'authorUid', op: '==', value: input.uid },
        { field: 'isArchived', op: '==', value: false },
      ],
      orderBy: { field: 'updatedAt', direction: 'desc' },
      limit: PAGE_SIZE,
    };
  }
  const conditions: QueryCondition[] = [];
  if (input.audience === 'archived-own' || input.audience === 'archived-all') {
    conditions.push({ field: 'isArchived', op: '==', value: true });
    if (input.audience === 'archived-own') {
      if (input.uid === undefined) throw new Error('archived-own requiere uid');
      conditions.push({ field: 'authorUid', op: '==', value: input.uid });
    }
  } else {
    if (input.audience === 'visitor') conditions.push({ field: 'visibility', op: '==', value: 'public' });
    conditions.push({ field: 'isArchived', op: '==', value: false });
    if (input.filters.axes.length > 0) {
      conditions.push({ field: 'axes', op: 'array-contains-any', value: [...input.filters.axes] });
    }
    if (input.filters.status !== null) conditions.push({ field: 'status', op: '==', value: input.filters.status });
    if (input.map === true) conditions.push({ field: 'hasLocation', op: '==', value: true });
  }
  return {
    collection: 'apices',
    conditions,
    orderBy: { field: 'updatedAt', direction: 'desc' },
    limit: input.map === true ? MAP_LIMIT : PAGE_SIZE,
  };
}
