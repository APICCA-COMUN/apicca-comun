// Índices compuestos de Firestore derivados de `listQueryShape` (RF-21 (001), D-T17 (001)).
// El archivo `firestore.indexes.json` se genera con `npm run gen-indexes`; nunca se edita a mano.
import { APICE_STATUSES, AXES } from './apice';
import { constitutionQueryShapes } from './constitution/queries';
import { forumQueryShapes } from './forum/queries';
import { listQueryShape, type ListAudience, type QueryShape } from './discovery';

export interface IndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}

export interface IndexDef {
  collectionGroup: string;
  queryScope: 'COLLECTION';
  fields: IndexField[];
}

export interface FieldOverride {
  collectionGroup: string;
  fieldPath: string;
  ttl: true;
  indexes: never[];
}

export interface IndexFile {
  indexes: IndexDef[];
  fieldOverrides: FieldOverride[];
}

/** Colecciones cuyos documentos caducan solos por `expiresAt` (RNF-7 (001), plan §4.4). */
export const TTL_COLLECTIONS = [
  'proposals',
  'rateLimits',
  'generationDays',
  'enrollmentRequests', // RF-8 (016) · 8.3, D-T12 (016)
  'uploadReservations', // RF-7 (016) · 7.3, D-T9 (016)
] as const;

/** Política TTL de Firestore sin índices de campo único: nadie consulta por `expiresAt`. */
export const ttlOverrides = (): FieldOverride[] =>
  TTL_COLLECTIONS.map((collectionGroup) => ({ collectionGroup, fieldPath: 'expiresAt', ttl: true, indexes: [] }));

const AUDIENCES: readonly ListAudience[] = ['visitor', 'member', 'archived-own', 'archived-all', 'mine'];

/**
 * Igualdades (en orden alfabético), luego el arreglo, los rangos sobre otro campo y por último el orden de la
 * consulta. La colección sale de la forma (D-T14 (004)).
 */
export function indexForShape(shape: QueryShape): IndexDef {
  const equalities = shape.conditions
    .filter((condition) => condition.op === '==')
    .map((condition) => condition.field)
    .sort();
  const arrays = shape.conditions.filter((condition) => condition.op === 'array-contains-any');
  const ranges = [
    ...new Set(
      shape.conditions
        .filter((condition) => condition.op === '<=' && condition.field !== shape.orderBy.field)
        .map((condition) => condition.field),
    ),
  ];
  return {
    collectionGroup: shape.collection,
    queryScope: 'COLLECTION',
    fields: [
      ...equalities.map((fieldPath): IndexField => ({ fieldPath, order: 'ASCENDING' })),
      ...arrays.map((condition): IndexField => ({ fieldPath: condition.field, arrayConfig: 'CONTAINS' })),
      ...ranges.map((fieldPath): IndexField => ({ fieldPath, order: 'ASCENDING' })),
      { fieldPath: shape.orderBy.field, order: shape.orderBy.direction === 'desc' ? 'DESCENDING' : 'ASCENDING' },
    ],
  };
}

const keyOf = (index: IndexDef): string => JSON.stringify(index);

/** Todos los índices distintos que piden la lista, el mapa y la constitución, en orden estable. */
export function requiredIndexes(): IndexDef[] {
  const found = new Map<string, IndexDef>();
  const axisChoices = [[], [AXES[0]], [...AXES]];
  for (const audience of AUDIENCES) {
    for (const axes of axisChoices) {
      for (const status of [null, ...APICE_STATUSES]) {
        for (const map of [false, true]) {
          const shape = listQueryShape({ audience, filters: { axes, status }, uid: 'uid', map });
          const index = indexForShape(shape);
          found.set(keyOf(index), index);
        }
      }
    }
  }
  // Las consultas de la constitución (D-T14 (004)).
  for (const shape of constitutionQueryShapes()) {
    const index = indexForShape(shape);
    found.set(keyOf(index), index);
  }
  // Las consultas del foro (RF-1 (009), RF-2 (009)).
  for (const shape of forumQueryShapes()) {
    const index = indexForShape(shape);
    found.set(keyOf(index), index);
  }
  return [...found.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

/** Los índices requeridos que el archivo no declara. */
export function missingIndexes(file: IndexFile, required: readonly IndexDef[]): IndexDef[] {
  const declared = new Set(file.indexes.map(keyOf));
  return required.filter((index) => !declared.has(keyOf(index)));
}

export function serializeIndexes(indexes: readonly IndexDef[]): string {
  const file: IndexFile = { indexes: [...indexes], fieldOverrides: ttlOverrides() };
  return `${JSON.stringify(file, null, 2)}\n`;
}
