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

/** Las dos formas de la lista: todos los temas y un eje. */
export function forumQueryShapes(): QueryShape[] {
  return [threadsQuery(null), threadsQuery('agua')];
}
