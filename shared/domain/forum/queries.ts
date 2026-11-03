// Consultas del foro declaradas como `QueryShape` (RF-1 (009), RF-2 (009)): de aquí salen sus índices.
import type { Axis } from '../apice';
import type { QueryShape } from '../discovery';
import { FORUM_LIMITS } from './forum';

/** Los hilos no archivados, de la actividad más reciente a la más antigua, con filtro de eje opcional. */
export function threadsQuery(axis: Axis | null): QueryShape {
  return {
    collection: 'threads',
    conditions: [
      { field: 'isArchived', op: '==', value: false },
      ...(axis === null ? [] : [{ field: 'axis', op: '==' as const, value: axis }]),
    ],
    orderBy: { field: 'lastMessageAt', direction: 'desc' },
    limit: FORUM_LIMITS.pageSize,
  };
}

const visibleOnly = (includeArchived: boolean): QueryShape['conditions'] => (includeArchived ? [] : [{ field: 'isArchived', op: '==', value: false }]);

/**
 * El mensaje de apertura de un hilo: el primero por fecha (RF-1 (018) · 1.1, D-T2 (018)). Sin moderar se piden solo los visibles,
 * y esa forma necesita el índice compuesto `isArchived` + `createdAt` ascendente (RF-1 (017) · 1.2).
 */
export function openingMessageQuery({ includeArchived }: { includeArchived: boolean }): QueryShape {
  return {
    collection: 'messages',
    conditions: visibleOnly(includeArchived),
    orderBy: { field: 'createdAt', direction: 'asc' },
    limit: 1,
  };
}

/**
 * Los mensajes más recientes de un hilo, del último hacia atrás, una página (RF-1 (018) · 1.1, 1.3, D-T2 (018)). Sin moderar
 * necesita el índice `isArchived` + `createdAt` descendente.
 */
export function latestMessagesQuery({ includeArchived }: { includeArchived: boolean }): QueryShape {
  return {
    collection: 'messages',
    conditions: visibleOnly(includeArchived),
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: FORUM_LIMITS.messagePageSize,
  };
}

/** Las formas que piden índice compuesto: la lista (todos los temas y un eje) y la apertura y la página reciente de un hilo (D-T2 (018)). */
export function forumQueryShapes(): QueryShape[] {
  return [threadsQuery(null), threadsQuery('agua'), openingMessageQuery({ includeArchived: false }), latestMessagesQuery({ includeArchived: false })];
}
