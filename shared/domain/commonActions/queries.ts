// Consultas de las Acciones Comunes declaradas como `QueryShape` (RF-5 (010), RF-6 (010), D-T5 (010)): de aquí salen sus índices.
import type { QueryShape } from '../discovery';
import { COMMON_ACTION_LIMITS } from './commonActions';

/** Las listadas, de la más reciente a la más antigua; con `uid`, solo aquellas en las que esa persona participa. */
export function commonActionsQuery(uid: string | null): QueryShape {
  return {
    collection: 'commonActions',
    conditions: [
      { field: 'isListed', op: '==', value: true },
      ...(uid === null ? [] : [{ field: 'participantUids', op: 'array-contains' as const, value: uid }]),
    ],
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: COMMON_ACTION_LIMITS.mapLimit,
  };
}

/** Las formas que piden índice compuesto: la lista y «Lo mío». */
export const commonActionQueryShapes = (): QueryShape[] => [commonActionsQuery(null), commonActionsQuery('uid')];
