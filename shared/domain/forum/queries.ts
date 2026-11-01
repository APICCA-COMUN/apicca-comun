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

/**
 * Los mensajes de un hilo, del primero al último (RF-7 (009)). Sin moderar se piden solo los visibles, y esa forma
 * necesita el índice compuesto `isArchived` + `createdAt` (RF-1 (017) · 1.2, D-T1 (017)).
 */
export function messagesQuery({ includeArchived }: { includeArchived: boolean }): QueryShape {
  return {
    collection: 'messages',
    conditions: includeArchived ? [] : [{ field: 'isArchived', op: '==', value: false }],
    orderBy: { field: 'createdAt', direction: 'asc' },
  };
}

/** Las formas que piden índice compuesto: la lista (todos los temas y un eje) y los mensajes visibles de un hilo. */
export function forumQueryShapes(): QueryShape[] {
  return [threadsQuery(null), threadsQuery('agua'), messagesQuery({ includeArchived: false })];
}
