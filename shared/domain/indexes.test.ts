// T-3.8: los índices de `firestore.indexes.json` salen de `listQueryShape` (D-T17 (001)).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APICE_STATUSES, AXES } from './apice';
import { listQueryShape, NO_FILTERS, type ListAudience, type ListFilters } from './discovery';
import { constitutionQueryShapes } from './constitution/queries';
import type { QueryShape } from './discovery';
import {
  indexForShape,
  missingIndexes,
  requiredIndexes,
  serializeIndexes,
  TTL_COLLECTIONS,
  type IndexDef,
  type IndexField,
  type IndexFile,
} from './indexes';
const AUDIENCES: ListAudience[] = ['visitor', 'member', 'archived-own', 'archived-all'];
const AXIS_CHOICES: Array<ListFilters['axes']> = [[], ...AXES.map((axis) => [axis]), [...AXES]];
const STATUS_CHOICES: ListFilters['status'][] = [null, ...APICE_STATUSES];

const committed = JSON.parse(
  readFileSync(new URL('../../firestore.indexes.json', import.meta.url), 'utf8'),
) as IndexFile;

describe('índices del descubrimiento', () => {
  it('RF-21 (001): cada combinación de quién mira × ejes × estado × mapa tiene su índice en el archivo', () => {
    let combos = 0;
    for (const audience of AUDIENCES) {
      for (const axes of AXIS_CHOICES) {
        for (const status of STATUS_CHOICES) {
          for (const map of [false, true]) {
            const shape = listQueryShape({ audience, filters: { axes, status }, uid: 'u1', map });
            expect(missingIndexes(committed, [indexForShape(shape)]), JSON.stringify(shape.conditions)).toEqual([]);
            combos += 1;
          }
        }
      }
    }
    expect(combos).toBe(4 * AXIS_CHOICES.length * (APICE_STATUSES.length + 1) * 2);
  });

  it('RF-21 (001): el archivo es exactamente el que se genera (ni sobran ni faltan índices)', () => {
    expect(committed).toEqual(JSON.parse(serializeIndexes(requiredIndexes())));
  });

  it('RF-21 (001): quitar un índice del archivo hace que la comprobación lo señale', () => {
    const trimmed: IndexFile = { ...committed, indexes: committed.indexes.slice(1) };
    const missing = missingIndexes(trimmed, requiredIndexes());
    expect(missing).toEqual([committed.indexes[0]]);
  });

  it('RF-21 (001): cada índice termina en updatedAt descendente y usa igualdades antes del arreglo', () => {
    const shape = listQueryShape({ audience: 'visitor', filters: { axes: ['agua'], status: 'idea' } });
    expect(indexForShape(shape)).toEqual({
      collectionGroup: 'apices',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'isArchived', order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'visibility', order: 'ASCENDING' },
        { fieldPath: 'axes', arrayConfig: 'CONTAINS' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' },
      ],
    });
  });

  it('RF-21 (001): dos formas con los mismos campos comparten índice, sea cual sea la cantidad de ejes', () => {
    const one = indexForShape(listQueryShape({ audience: 'member', filters: { axes: ['agua'], status: null } }));
    const all = indexForShape(listQueryShape({ audience: 'member', filters: { axes: [...AXES], status: null } }));
    expect(one).toEqual(all);
    expect(indexForShape(listQueryShape({ audience: 'member', filters: NO_FILTERS }))).not.toEqual(one);
  });

  it('RF-19 (001): el archivo declara la política TTL sobre expiresAt de propuestas, límites y días de generación', () => {
    expect([...TTL_COLLECTIONS].sort()).toEqual(['generationDays', 'proposals', 'rateLimits']);
    expect(committed.fieldOverrides).toEqual(
      TTL_COLLECTIONS.map((collectionGroup) => ({ collectionGroup, fieldPath: 'expiresAt', ttl: true, indexes: [] })),
    );
  });

  it('RF-11 (003) · 11.2: la forma de «mis ápices» está cubierta por un índice declarado (D-T12 (003))', () => {
    const shape = listQueryShape({ audience: 'mine', uid: 'u1', filters: NO_FILTERS });
    expect(missingIndexes(committed, [indexForShape(shape)])).toEqual([]);
  });

  it('RF-21 (001), D-T14 (004): la forma lleva su colección, y la lista de ápices sigue siendo de apices', () => {
    expect(listQueryShape({ audience: 'member', filters: NO_FILTERS }).collection).toBe('apices');
    expect(listQueryShape({ audience: 'mine', uid: 'u1', filters: NO_FILTERS }).collection).toBe('apices');
  });

  it('D-T14 (004): el índice toma la colección de la forma y respeta el orden ascendente', () => {
    const shape: QueryShape = {
      collection: 'amendments',
      conditions: [{ field: 'isOpen', op: '==', value: true }],
      orderBy: { field: 'closesAt', direction: 'asc' },
      limit: 100,
    };
    expect(indexForShape(shape)).toEqual({
      collectionGroup: 'amendments',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'isOpen', order: 'ASCENDING' },
        { fieldPath: 'closesAt', order: 'ASCENDING' },
      ],
    });
  });

  it('D-T14 (004): un rango sobre el campo del orden no agrega campos; uno sobre otro campo va antes del orden', () => {
    const due: QueryShape = {
      collection: 'amendments',
      conditions: [
        { field: 'isOpen', op: '==', value: true },
        { field: 'closesAt', op: '<=', value: 0 },
      ],
      orderBy: { field: 'closesAt', direction: 'asc' },
    };
    expect(indexForShape(due).fields).toEqual([
      { fieldPath: 'isOpen', order: 'ASCENDING' },
      { fieldPath: 'closesAt', order: 'ASCENDING' },
    ]);
    const other: QueryShape = {
      ...due,
      orderBy: { field: 'updatedAt', direction: 'desc' },
    };
    expect(indexForShape(other).fields).toEqual([
      { fieldPath: 'isOpen', order: 'ASCENDING' },
      { fieldPath: 'closesAt', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ]);
  });

  it('RF-7 (004) · 7.1, 7.2, RF-5 (004) · 5.1: el archivo cubre las tres consultas compuestas de la constitución (D-T14 (004))', () => {
    const expected: IndexDef[] = (
      [
        {
          collectionGroup: 'amendments',
          fields: [
            ['isOpen', 'ASCENDING'],
            ['closesAt', 'ASCENDING'],
          ],
        },
        {
          collectionGroup: 'amendments',
          fields: [
            ['isOpen', 'ASCENDING'],
            ['closedAt', 'DESCENDING'],
          ],
        },
        {
          collectionGroup: 'constitutionDocuments',
          fields: [
            ['isArchived', 'ASCENDING'],
            ['updatedAt', 'DESCENDING'],
          ],
        },
      ] as {
        collectionGroup: string;
        fields: [string, NonNullable<IndexField['order']>][];
      }[]
    ).map(({ collectionGroup, fields }) => ({
      collectionGroup,
      queryScope: 'COLLECTION' as const,
      fields: fields.map(([fieldPath, order]) => ({ fieldPath, order })),
    }));
    expect(missingIndexes(committed, expected)).toEqual([]);
    for (const shape of constitutionQueryShapes()) {
      expect(missingIndexes(committed, [indexForShape(shape)]), shape.collection).toEqual([]);
    }
  });
});
