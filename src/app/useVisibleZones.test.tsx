// T-18 (024) · RF-12 (024) · 12.1 a 12.3, D-T16 (024): las zonas de los ápices que la persona ve, para abrir el selector de ubicación.
// Solo el centro de la zona (público), nunca el punto exacto, y solo de la primera tanda de la lista.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Location } from '../../shared/domain/location';
import type { ListSource } from '../data/apices';
import { listed } from '../testing/listDoubles';
import { useVisibleZones } from './useVisibleZones';

const zoneOf = (cell: string, lat: number, lng: number) => ({ cell, lat, lng });
const approximate = (lat: number, lng: number, cell = 'c1'): Location => ({ lat: lat + 0.01, lng: lng + 0.01, precision: 'approximate', zone: zoneOf(cell, lat, lng) });
const exact = (lat: number, lng: number, cell = 'c2'): Location => ({ lat, lng, precision: 'exact', zone: zoneOf(cell, lat + 0.5, lng + 0.5) });

describe('useVisibleZones', () => {
  it('RF-12 (024) · 12.1: da el centro de la zona de cada ápice de la primera tanda', async () => {
    const source: ListSource = {
      fetchPage: vi.fn(async () => ({ items: [listed(1, { location: approximate(4.6, -74.08) }), listed(2, { location: approximate(6.24, -75.58, 'c9') })], cursor: null })),
    };
    const { result } = renderHook(() => useVisibleZones({ source }));
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current).toEqual([
      { lat: 4.6, lng: -74.08 },
      { lat: 6.24, lng: -75.58 },
    ]);
  });

  it('RF-12 (024) · 12.1: pide solo la primera tanda, con la audiencia de las personas con cuenta y sin filtros', async () => {
    const fetchPage = vi.fn(async () => ({ items: [], cursor: { id: 'siguiente' } as never }));
    const source: ListSource = { fetchPage };
    renderHook(() => useVisibleZones({ source }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ audience: 'member', cursor: null, filters: { axes: [], status: null } }));
  });

  it('RF-12 (024) · 12.1, D-10 (024): el punto exacto de un ápice nunca llega; llega el centro de su zona', async () => {
    const source: ListSource = { fetchPage: async () => ({ items: [listed(1, { location: exact(4.6001, -74.0802) })], cursor: null }) };
    const { result } = renderHook(() => useVisibleZones({ source }));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current).toEqual([{ lat: 5.1001, lng: -73.5802 }]);
    expect(JSON.stringify(result.current)).not.toContain('4.6001');
  });

  it('RF-12 (024): los ápices sin zona o sin ubicación no cuentan', async () => {
    const source: ListSource = {
      fetchPage: async () => ({
        items: [listed(1), listed(2, { location: null }), listed(3, { location: { lat: 1, lng: 2, precision: 'approximate' } }), listed(4, { location: approximate(4.6, -74.08) })],
        cursor: null,
      }),
    };
    const { result } = renderHook(() => useVisibleZones({ source }));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current).toEqual([{ lat: 4.6, lng: -74.08 }]);
  });

  it('RF-12 (024): mientras se lee, o si la lectura falla, no hay zonas y el selector abre como hoy', async () => {
    const failing: ListSource = { fetchPage: vi.fn().mockRejectedValue(new Error('caída')) };
    const { result } = renderHook(() => useVisibleZones({ source: failing }));
    expect(result.current).toEqual([]);
    await waitFor(() => expect(failing.fetchPage).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('RF-12 (024): una lectura que falla de golpe, sin promesa, tampoco rompe el formulario', async () => {
    const throwing: ListSource = {
      fetchPage: vi.fn(() => {
        throw new Error('sin Firebase');
      }),
    };
    const { result } = renderHook(() => useVisibleZones({ source: throwing }));
    await waitFor(() => expect(throwing.fetchPage).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('RF-12 (024): desactivado, no lee nada', async () => {
    const fetchPage = vi.fn(async () => ({ items: [], cursor: null }));
    const source: ListSource = { fetchPage };
    const { result } = renderHook(() => useVisibleZones({ source, enabled: false }));
    await new Promise((done) => setTimeout(done, 20));
    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('RF-12 (024) · 12.1: el resultado conserva la misma identidad mientras no cambie la lectura', async () => {
    const source: ListSource = { fetchPage: async () => ({ items: [listed(1, { location: approximate(4.6, -74.08) })], cursor: null }) };
    const { result, rerender } = renderHook(() => useVisibleZones({ source }));
    await waitFor(() => expect(result.current).toHaveLength(1));
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });
});
