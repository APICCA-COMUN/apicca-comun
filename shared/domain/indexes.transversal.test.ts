// T-7.6: prueba transversal de índices. Recorre TODAS las consultas posibles de la lista y del mapa
// (cada quién mira × cada subconjunto de ejes × cada estado × mapa) contra `firestore.indexes.json`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APICE_STATUSES, AXES, type Axis } from './apice';
import { listQueryShape, type ListAudience } from './discovery';
import { indexForShape, missingIndexes, requiredIndexes, type IndexFile } from './indexes';

const AUDIENCES: ListAudience[] = ['visitor', 'member', 'archived-own', 'archived-all'];

const committed = JSON.parse(readFileSync(new URL('../../firestore.indexes.json', import.meta.url), 'utf8')) as IndexFile;

/** Los 2^n subconjuntos de ejes, desde ninguno hasta todos. */
const axisSubsets = (): Axis[][] =>
  Array.from({ length: 2 ** AXES.length }, (_, mask) => AXES.filter((_axis, bit) => (mask >> bit) & 1));

describe('índices: cobertura de todas las consultas', () => {
  it('D-T17 (001): cada consulta posible de la lista y del mapa tiene su índice declarado', () => {
    let combos = 0;
    for (const audience of AUDIENCES) {
      for (const axes of axisSubsets()) {
        for (const status of [null, ...APICE_STATUSES]) {
          for (const map of [false, true]) {
            const shape = listQueryShape({ audience, filters: { axes, status }, uid: 'u1', map });
            const label = `${audience} ejes=[${axes.join(',')}] estado=${status ?? '-'} mapa=${map}`;
            expect(missingIndexes(committed, [indexForShape(shape)]), label).toEqual([]);
            combos += 1;
          }
        }
      }
    }
    expect(combos).toBe(AUDIENCES.length * 2 ** AXES.length * (APICE_STATUSES.length + 1) * 2);
  });

  it('D-T17 (001): las consultas del mapa piden `hasLocation` y su índice existe', () => {
    for (const audience of ['visitor', 'member'] as const) {
      const shape = listQueryShape({ audience, filters: { axes: [], status: null }, map: true });
      const index = indexForShape(shape);
      expect(index.fields.map((field) => field.fieldPath)).toContain('hasLocation');
      expect(missingIndexes(committed, [index])).toEqual([]);
    }
  });

  it('D-T17 (001): quitar cualquier índice del archivo, uno a uno, hace fallar la comprobación', () => {
    const required = requiredIndexes();
    expect(committed.indexes.length).toBeGreaterThan(0);
    committed.indexes.forEach((removed, position) => {
      const trimmed: IndexFile = { ...committed, indexes: committed.indexes.filter((_index, at) => at !== position) };
      expect(missingIndexes(trimmed, required), JSON.stringify(removed)).toEqual([removed]);
    });
  });
});
