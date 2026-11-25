import { describe, expect, it } from 'vitest';
import { NO_FILTERS } from '../../shared/domain/discovery';
import { filtersFromSearch, filtersToSearch, splitFilters } from './listFilters';

describe('filtros en la URL', () => {
  it('RF-21 (001): ida y vuelta de ejes y estado', () => {
    const filters = { axes: ['agua' as const, 'energía' as const], status: 'prototipo' as const };
    const search = filtersToSearch(filters);
    expect(search.startsWith('?')).toBe(true);
    expect(filtersFromSearch(search)).toEqual(filters);
  });

  it('RF-21 (001): sin filtros no hay query y una query vacía es sin filtros', () => {
    expect(filtersToSearch(NO_FILTERS)).toBe('');
    expect(filtersFromSearch('')).toEqual(NO_FILTERS);
  });

  it('RF-21 (001): valores inválidos o repetidos se ignoran', () => {
    expect(filtersFromSearch('?ejes=agua,agua,luna&estado=roto')).toEqual({ axes: ['agua'], status: null });
  });
});

describe('filtros del mapa y de la lista', () => {
  const filters = { axes: ['agua' as const], status: 'idea' as const };

  it('en el mapa los filtros se apagan en el cliente y no van a la consulta', () => {
    expect(splitFilters(filters, 'mapa')).toEqual({ server: NO_FILTERS, dim: filters });
  });

  it('en la lista los filtros van a la consulta y nada se apaga', () => {
    expect(splitFilters(filters, 'lista')).toEqual({ server: filters, dim: NO_FILTERS });
  });
});
