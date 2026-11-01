// Consultas declaradas de la constitución (T-2.2 (004), D-T14 (004)).
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../limits';
import {
  CLOSED_PAGE_SIZE,
  closedAmendmentsQuery,
  DOCUMENTS_PAGE_SIZE,
  documentsQuery,
  dueAmendmentsQuery,
  openAmendmentsQuery,
} from './queries';

describe('constitución · consultas declaradas', () => {
  it('RF-7 (004) · 7.1: las abiertas, completas, de la que cierra antes a la que cierra después', () => {
    expect(openAmendmentsQuery()).toEqual({
      collection: 'amendments',
      conditions: [{ field: 'isOpen', op: '==', value: true }],
      orderBy: { field: 'closesAt', direction: 'asc' },
      limit: LIMITS.openAmendments,
    });
  });

  it('RF-7 (004) · 7.2: las cerradas, de la más reciente a la más antigua, de 20 en 20', () => {
    expect(CLOSED_PAGE_SIZE).toBe(20);
    expect(closedAmendmentsQuery()).toEqual({
      collection: 'amendments',
      conditions: [{ field: 'isOpen', op: '==', value: false }],
      orderBy: { field: 'closedAt', direction: 'desc' },
      limit: 20,
    });
  });

  it('RF-12 (004) · 12.2: las vencidas son las abiertas con cierre en o antes de ahora, sin tope', () => {
    const shape = dueAmendmentsQuery(1_000);
    expect(shape).toEqual({
      collection: 'amendments',
      conditions: [
        { field: 'isOpen', op: '==', value: true },
        { field: 'closesAt', op: '<=', value: 1_000 },
      ],
      orderBy: { field: 'closesAt', direction: 'asc' },
    });
    expect(shape.limit).toBeUndefined();
  });

  it('RF-5 (004) · 5.1: los documentos no archivados, de 20 en 20, del más reciente al más antiguo', () => {
    expect(DOCUMENTS_PAGE_SIZE).toBe(20);
    expect(documentsQuery({ archived: false })).toEqual({
      collection: 'constitutionDocuments',
      conditions: [{ field: 'isArchived', op: '==', value: false }],
      orderBy: { field: 'updatedAt', direction: 'desc' },
      limit: 20,
    });
  });

  it('RF-5 (004) · 5.7: los archivados se piden aparte, con la misma forma', () => {
    expect(documentsQuery({ archived: true }).conditions).toEqual([{ field: 'isArchived', op: '==', value: true }]);
  });
});
