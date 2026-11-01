import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NO_FILTERS } from '../../shared/domain/discovery';
import { emptyListSource, fakeListSource } from '../testing/listDoubles';
import { ApiceList } from './ApiceList';
import { expectBlocks } from '../testing/expectBlocks';

describe('ApiceList', () => {
  it('RF-21 (001): muestra la primera tanda de 24 y «Cargar más» trae la siguiente con el cursor', async () => {
    const { source, requests } = fakeListSource(30);
    render(<ApiceList audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(24));
    expect(requests[0]?.cursor ?? null).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(30));
    expect(requests[1]?.cursor).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('RF-21 (001): con una sola tanda no hay botón', async () => {
    const { source } = fakeListSource(5);
    render(<ApiceList audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(5));
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('RF-21 (001): elegir un ápice de la lista abre su ficha', async () => {
    const { source } = fakeListSource(3);
    render(<ApiceList audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    const card = (await screen.findAllByRole('article'))[1];
    await userEvent.click(within(card as HTMLElement).getByRole('link', { name: 'Ápice 2' }));
    expect(window.location.pathname).toBe('/apices/a2');
  });

  it('RF-21 (001): sin ápices llama a `empty` con el estado vacío', async () => {
    const { source } = emptyListSource();
    render(
      <ApiceList audience="member" filters={NO_FILTERS} source={source} empty={(state) => <p>vacío: {state}</p>} />,
    );
    expect(await screen.findByText('vacío: no-apices')).toBeTruthy();
  });

  it('RF-21 (001): con filtros activos y sin resultados el estado es «no-results»', async () => {
    const { source } = emptyListSource();
    render(
      <ApiceList
        audience="member"
        filters={{ axes: ['agua'], status: null }}
        source={source}
        empty={(state) => <p>vacío: {state}</p>}
      />,
    );
    expect(await screen.findByText('vacío: no-results')).toBeTruthy();
  });

  it('RF-21 (001): si la consulta falla lo dice y permite reintentar', async () => {
    let calls = 0;
    const source = {
      fetchPage: async () => {
        calls += 1;
        if (calls === 1) throw new Error('sin red');
        return { items: [], cursor: null };
      },
    };
    render(<ApiceList audience="visitor" filters={NO_FILTERS} source={source} empty={() => <p>vacío</p>} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('vacío')).toBeTruthy();
  });
});

describe('ApiceList · bloques (002)', () => {
  it('RF-6 (002) · 6.1: cada tarjeta es un bloque y «Cargar más» es una acción secundaria', async () => {
    const { source } = fakeListSource(30);
    const { container } = render(<ApiceList audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(24));
    for (const card of screen.getAllByRole('article')) expect(card.classList.contains('block')).toBe(true);
    const more = screen.getByRole('button', { name: 'Cargar más' });
    expect(more.classList.contains('action-secondary')).toBe(true);
    expectBlocks(container);
  });

  it('RF-6 (002) · 6.3: el error de carga es un bloque y «Reintentar» una acción secundaria', async () => {
    const source = { fetchPage: async () => Promise.reject(new Error('x')) } as unknown as Parameters<typeof ApiceList>[0]['source'];
    const { container } = render(<ApiceList audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    expect((await screen.findByRole('button', { name: 'Reintentar' })).classList.contains('action-secondary')).toBe(true);
    expectBlocks(container);
  });

  it('RF-7 (005) · 7.8, D-T5 (005): los cambios locales se aplican a la fila y a lo que se avisa con onItems', async () => {
    const { source } = fakeListSource(3);
    const onItems = vi.fn();
    const patches = { a2: { name: 'Renombrado', status: 'en marcha' as const } };
    render(<ApiceList audience="visitor" filters={NO_FILTERS} source={source} patches={patches} onItems={onItems} empty={() => null} />);
    expect(await screen.findByRole('link', { name: 'Renombrado' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ápice 2' })).toBeNull();
    await waitFor(() => expect(onItems.mock.lastCall?.[0]?.[1]).toMatchObject({ id: 'a2', name: 'Renombrado', status: 'en marcha' }));
    expect(source.fetchPage).toHaveBeenCalledTimes(1);
  });
});
