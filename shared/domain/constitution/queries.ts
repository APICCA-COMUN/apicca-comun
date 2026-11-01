// Consultas de la constitución declaradas como `QueryShape` (D-T14 (004), plan §5.8): de aquí salen las del
// cliente, la del cierre en el servidor y sus índices (`requiredIndexes`). RF-5 (004) · 5.1, RF-7 (004) · 7.1, 7.2.
import type { QueryShape } from '../discovery';
import { LIMITS } from '../limits';

/** Propuestas cerradas por tanda (RF-7 (004) · 7.2). */
export const CLOSED_PAGE_SIZE = 20;
/** Documentos por tanda (RF-5 (004) · 5.1). */
export const DOCUMENTS_PAGE_SIZE = 20;

/** Las abiertas, completas: nunca hay más de `openAmendments` a la vez (D-12 (004)). */
export function openAmendmentsQuery(): QueryShape {
  return {
    collection: 'amendments',
    conditions: [{ field: 'isOpen', op: '==', value: true }],
    orderBy: { field: 'closesAt', direction: 'asc' },
    limit: LIMITS.openAmendments,
  };
}

/** Las cerradas, de la más reciente a la más antigua. */
export function closedAmendmentsQuery(): QueryShape {
  return {
    collection: 'amendments',
    conditions: [{ field: 'isOpen', op: '==', value: false }],
    orderBy: { field: 'closedAt', direction: 'desc' },
    limit: CLOSED_PAGE_SIZE,
  };
}

/**
 * Las vencidas a `now` (milisegundos), sin tope: el servidor las cierra todas (RF-12 (004), D-T5 (004)). Quien
 * ejecuta la consulta convierte `now` al tipo de fecha de `closesAt`.
 */
export function dueAmendmentsQuery(now: number): QueryShape {
  return {
    collection: 'amendments',
    conditions: [
      { field: 'isOpen', op: '==', value: true },
      { field: 'closesAt', op: '<=', value: now },
    ],
    orderBy: { field: 'closesAt', direction: 'asc' },
  };
}

/** Los documentos no archivados o, aparte, los archivados (RF-5 (004) · 5.1, 5.7). */
export function documentsQuery(input: { archived: boolean }): QueryShape {
  return {
    collection: 'constitutionDocuments',
    conditions: [{ field: 'isArchived', op: '==', value: input.archived }],
    orderBy: { field: 'updatedAt', direction: 'desc' },
    limit: DOCUMENTS_PAGE_SIZE,
  };
}

/** Todas las formas, para sacar sus índices. */
export function constitutionQueryShapes(): QueryShape[] {
  return [
    openAmendmentsQuery(),
    closedAmendmentsQuery(),
    dueAmendmentsQuery(0),
    documentsQuery({ archived: false }),
    documentsQuery({ archived: true }),
  ];
}
