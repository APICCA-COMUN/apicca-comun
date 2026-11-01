import { describe, expect, it } from 'vitest';
import {
  compareApices,
  emptyState,
  EXCERPT_LENGTH,
  apiceExcerpt,
  listQueryShape,
  matchesFilters,
  MAP_LIMIT,
  NO_FILTERS,
  PAGE_SIZE,
  type ListFilters,
} from './discovery';
import type { Axis, ApiceStatus } from './apice';

const apice = (axes: Axis[], status: ApiceStatus, seconds = 0) => ({
  axes,
  status,
  updatedAt: { seconds, nanoseconds: 0 },
});

describe('discovery · filtros', () => {
  const agua = apice(['agua'], 'idea');
  const aguaEnergia = apice(['agua', 'energía'], 'prototipo');
  const cobijo = apice(['cobijo'], 'en marcha');

  it('RF-21 (001): sin filtros muestra todos', () => {
    for (const a of [agua, aguaEnergia, cobijo]) expect(matchesFilters(a, NO_FILTERS)).toBe(true);
  });

  it('RF-21 (001): un eje elegido deja los ápices que lo conectan', () => {
    const filters: ListFilters = { axes: ['agua'], status: null };
    expect([agua, aguaEnergia, cobijo].filter((a) => matchesFilters(a, filters))).toEqual([agua, aguaEnergia]);
  });

  it('RF-21 (001): varios ejes elegidos dejan los que conectan alguno de ellos', () => {
    const filters: ListFilters = { axes: ['energía', 'cobijo'], status: null };
    expect([agua, aguaEnergia, cobijo].filter((a) => matchesFilters(a, filters))).toEqual([aguaEnergia, cobijo]);
  });

  it('RF-21 (001): solo estado deja los ápices en ese estado', () => {
    const filters: ListFilters = { axes: [], status: 'prototipo' };
    expect([agua, aguaEnergia, cobijo].filter((a) => matchesFilters(a, filters))).toEqual([aguaEnergia]);
  });

  it('RF-21 (001): ejes y estado combinados exigen ambos', () => {
    expect(matchesFilters(aguaEnergia, { axes: ['agua'], status: 'prototipo' })).toBe(true);
    expect(matchesFilters(aguaEnergia, { axes: ['agua'], status: 'idea' })).toBe(false);
    expect(matchesFilters(aguaEnergia, { axes: ['cobijo'], status: 'prototipo' })).toBe(false);
  });
});

describe('discovery · orden, extracto y página', () => {
  it('RF-21 (001): la lista va de la más reciente a la más antigua', () => {
    const items = [apice([], 'idea', 10), apice([], 'idea', 30), apice([], 'idea', 20)];
    expect([...items].sort(compareApices).map((a) => a.updatedAt.seconds)).toEqual([30, 20, 10]);
  });

  it('RF-21 (001): las tandas son de 24 y el extracto de 200', () => {
    expect(PAGE_SIZE).toBe(24);
    expect(EXCERPT_LENGTH).toBe(200);
  });

  it('RF-21 (001): un texto corto queda entero, con los espacios reducidos', () => {
    expect(apiceExcerpt('  Un   huerto\ncomún ')).toBe('Un huerto común');
  });

  it('RF-21 (001): un texto largo se corta en 200 caracteres exactos', () => {
    expect(Array.from(apiceExcerpt('a'.repeat(500)))).toHaveLength(200);
    expect(apiceExcerpt('a'.repeat(200))).toBe('a'.repeat(200));
  });

  it('RF-21 (001): el corte no parte un carácter de dos unidades ni separa una tilde de su letra', () => {
    expect(Array.from(apiceExcerpt('🌱'.repeat(300)))).toHaveLength(200);
    const decomposed = `${'a'.repeat(199)}é${'b'.repeat(10)}`; // la tilde cae justo en el límite
    expect(apiceExcerpt(decomposed)).toBe(`${'a'.repeat(199)}é`);
  });
});

describe('discovery · estados vacíos', () => {
  it('RF-21 (001): sin ápices visibles ni filtros es «sin ápices»', () => {
    expect(emptyState({ count: 0, filters: NO_FILTERS })).toBe('no-apices');
  });

  it('RF-21 (001): sin resultados con filtros es «sin resultados»', () => {
    expect(emptyState({ count: 0, filters: { axes: ['agua'], status: null } })).toBe('no-results');
    expect(emptyState({ count: 0, filters: { axes: [], status: 'idea' } })).toBe('no-results');
  });

  it('RF-21 (001): con ápices no hay estado vacío', () => {
    expect(emptyState({ count: 3, filters: NO_FILTERS })).toBeNull();
  });
});

describe('discovery · forma de la consulta', () => {
  const orderBy = { field: 'updatedAt', direction: 'desc' } as const;

  it('RF-21 (001): visitante: público y no archivado, con filtros opcionales', () => {
    const shape = listQueryShape({ audience: 'visitor', filters: { axes: ['agua', 'cobijo'], status: 'idea' } });
    expect(shape.conditions).toEqual([
      { field: 'visibility', op: '==', value: 'public' },
      { field: 'isArchived', op: '==', value: false },
      { field: 'axes', op: 'array-contains-any', value: ['agua', 'cobijo'] },
      { field: 'status', op: '==', value: 'idea' },
    ]);
    expect(shape.orderBy).toEqual(orderBy);
    expect(shape.limit).toBe(PAGE_SIZE);
  });

  it('RF-21 (001): inscrita: no archivado, sin condición de visibilidad', () => {
    expect(listQueryShape({ audience: 'member', filters: NO_FILTERS }).conditions).toEqual([
      { field: 'isArchived', op: '==', value: false },
    ]);
  });

  it('RF-21 (001): mapa: agrega la ubicación y el tope de 300', () => {
    const shape = listQueryShape({ audience: 'member', filters: NO_FILTERS, map: true });
    expect(shape.conditions).toContainEqual({ field: 'hasLocation', op: '==', value: true });
    expect(shape.limit).toBe(MAP_LIMIT);
    expect(MAP_LIMIT).toBe(300);
  });

  it('RF-21 (001): archivados de la autora: los suyos, sin filtros', () => {
    const shape = listQueryShape({ audience: 'archived-own', uid: 'u1', filters: { axes: ['agua'], status: 'idea' } });
    expect(shape.conditions).toEqual([
      { field: 'isArchived', op: '==', value: true },
      { field: 'authorUid', op: '==', value: 'u1' },
    ]);
  });

  it('RF-21 (001): archivados de la facilitadora: todos', () => {
    expect(listQueryShape({ audience: 'archived-all', filters: NO_FILTERS }).conditions).toEqual([
      { field: 'isArchived', op: '==', value: true },
    ]);
  });

  it('RF-11 (003) · 11.2, 11.3: «mis ápices» = los no archivados de la autora, sin filtros ni mapa (D-T12 (003))', () => {
    for (const map of [false, true]) {
      const shape = listQueryShape({ audience: 'mine', uid: 'u1', filters: { axes: ['agua'], status: 'idea' }, map });
      expect(shape).toEqual({
        collection: 'apices',
        conditions: [
          { field: 'authorUid', op: '==', value: 'u1' },
          { field: 'isArchived', op: '==', value: false },
        ],
        orderBy: { field: 'updatedAt', direction: 'desc' },
        limit: PAGE_SIZE,
      });
    }
  });

  it('RF-11 (003) · 11.2: «mis ápices» sin uid lanza, como archived-own (D-T12 (003))', () => {
    expect(() => listQueryShape({ audience: 'mine', filters: NO_FILTERS })).toThrow(/uid/);
  });
});
