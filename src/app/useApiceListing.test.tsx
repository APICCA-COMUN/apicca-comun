// RF-6 (019), RF-7 (019) · 7.3, D-T17 (019): el listado de ápices sale de `ApiceList` a un hook que comparten el terreno,
// la lista y el mapa. Conserva las tandas de 24 por cursor de RF-21 (001) y los parches de RF-7 (005) · 7.8.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NO_FILTERS, PAGE_SIZE, type ListFilters } from '../../shared/domain/discovery';
import type { ListPage, ListSource } from '../data/apices';
import { emptyListSource, fakeListSource, listed } from '../testing/listDoubles';
import { useApiceListing } from './useApiceListing';

describe('useApiceListing · D-T17 (019)', () => {
  it('RF-7 (019) · 7.3: mientras carga dice «loading», sin ápices ni estado vacío', async () => {
    let resolve: (page: ListPage) => void = () => undefined;
    const source: ListSource = { fetchPage: vi.fn(() => new Promise<ListPage>((done) => (resolve = done))) };
    const { result } = renderHook(() => useApiceListing({ audience: 'visitor', filters: NO_FILTERS, source }));
    expect(result.current.status).toBe('loading');
    expect(result.current.items).toEqual([]);
    expect(result.current.empty).toBeNull();
    await act(async () => resolve({ items: [listed(1)], cursor: null }));
    expect(result.current.status).toBe('ready');
    expect(result.current.items.map((apice) => apice.id)).toEqual(['a1']);
  });

  it('RF-6 (019), RF-21 (001): trae la primera tanda de 24 y `loadMore` suma la siguiente con el cursor', async () => {
    const { source, requests } = fakeListSource(30);
    const { result } = renderHook(() => useApiceListing({ audience: 'visitor', filters: NO_FILTERS, source }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toHaveLength(PAGE_SIZE);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    expect(result.current.loadingMore).toBe(true);
    await waitFor(() => expect(result.current.items).toHaveLength(30));
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadingMore).toBe(false);
    expect(requests[1]!.cursor).not.toBeNull();
  });

  it('RF-19 (019), RF-21 (001): sin ápices ni filtros el estado vacío es «no-apices»; con filtros, «no-results»', async () => {
    const { source } = emptyListSource();
    const { result, rerender } = renderHook((filters: ListFilters) => useApiceListing({ audience: 'visitor', filters, source }), {
      initialProps: NO_FILTERS,
    });
    await waitFor(() => expect(result.current.empty).toBe('no-apices'));
    rerender({ axes: ['agua'], status: null });
    await waitFor(() => expect(result.current.empty).toBe('no-results'));
  });

  it('RF-21 (001): si la consulta falla dice «error» y `retry` vuelve a pedir', async () => {
    const source: ListSource = { fetchPage: vi.fn().mockRejectedValueOnce(new Error('caída')).mockResolvedValue({ items: [listed(1)], cursor: null }) };
    const { result } = renderHook(() => useApiceListing({ audience: 'visitor', filters: NO_FILTERS, source }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.empty).toBeNull();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toHaveLength(1);
  });

  it('RF-21 (001): al cambiar los filtros descarta lo que llegue de la consulta anterior', async () => {
    const pending: ((page: ListPage) => void)[] = [];
    const source: ListSource = { fetchPage: vi.fn(() => new Promise<ListPage>((done) => pending.push(done))) };
    const { result, rerender } = renderHook((filters: ListFilters) => useApiceListing({ audience: 'visitor', filters, source }), {
      initialProps: NO_FILTERS,
    });
    rerender({ axes: ['agua'], status: null });
    await act(async () => pending[1]!({ items: [listed(2)], cursor: null }));
    await act(async () => pending[0]!({ items: [listed(1)], cursor: null }));
    expect(result.current.items.map((apice) => apice.id)).toEqual(['a2']);
  });

  it('RF-7 (005) · 7.8: `patch` aplica lo guardado sin volver a consultar', async () => {
    const { source, fetchPage } = fakeListSource(2);
    const { result } = renderHook(() => useApiceListing({ audience: 'visitor', filters: NO_FILTERS, source }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.patch('a1', { name: 'Nombre nuevo' }));
    expect(result.current.items.find((apice) => apice.id === 'a1')!.name).toBe('Nombre nuevo');
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('RF-11 (003) · 11.2: pasa la audiencia y la cuenta a la fuente', async () => {
    const { source, requests } = emptyListSource();
    renderHook(() => useApiceListing({ audience: 'mine', uid: 'u-ana', filters: NO_FILTERS, source }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ audience: 'mine', uid: 'u-ana', cursor: null });
  });
});
