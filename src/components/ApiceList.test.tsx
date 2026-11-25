import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { NO_FILTERS, type EmptyState } from '../../shared/domain/discovery';
import { useApiceListing, type ApiceListingRequest } from '../app/useApiceListing';
import { emptyListSource, fakeListSource, listed } from '../testing/listDoubles';
import { ApiceList, ApiceRows } from './ApiceList';
import { vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';

/** La lista con su listado, como la usan las páginas (D-T17 (019)). */
function Listed({ empty, titulo, ...request }: ApiceListingRequest & { empty(state: EmptyState): ReactNode; titulo?: boolean }) {
  return <ApiceList listing={useApiceListing(request)} empty={empty} titulo={titulo === true} />;
}

describe('ApiceList', () => {
  it('RF-21 (001): muestra la primera tanda de 24 y «Cargar más» trae la siguiente con el cursor', async () => {
    const { source, requests } = fakeListSource(30);
    render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(24));
    expect(requests[0]?.cursor ?? null).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(30));
    expect(requests[1]?.cursor).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('RF-21 (001): con una sola tanda no hay botón', async () => {
    const { source } = fakeListSource(5);
    render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(5));
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('RF-21 (001): elegir un ápice de la lista abre su ficha', async () => {
    const { source } = fakeListSource(3);
    render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    const card = (await screen.findAllByRole('article'))[1];
    await userEvent.click(within(card as HTMLElement).getByRole('link', { name: 'Ápice 2' }));
    expect(window.location.pathname).toBe('/apices/a2');
  });

  it('RF-21 (001): sin ápices llama a `empty` con el estado vacío', async () => {
    const { source } = emptyListSource();
    render(
      <Listed audience="member" filters={NO_FILTERS} source={source} empty={(state) => <p>vacío: {state}</p>} />,
    );
    expect(await screen.findByText('vacío: no-apices')).toBeTruthy();
  });

  it('RF-21 (001): con filtros activos y sin resultados el estado es «no-results»', async () => {
    const { source } = emptyListSource();
    render(
      <Listed
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
    render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => <p>vacío</p>} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('vacío')).toBeTruthy();
  });
});

describe('ApiceList · bloques (002)', () => {
  it('RF-6 (002) · 6.1: cada fila es un dato con filete suave, no una tarjeta, y «Cargar más» es una acción secundaria', async () => {
    const { source } = fakeListSource(30);
    const { container } = render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(24));
    for (const card of screen.getAllByRole('article')) expect(card.classList.contains('c-dato') && !card.classList.contains('block')).toBe(true);
    const more = screen.getByRole('button', { name: 'Cargar más' });
    expect(more.classList.contains('action-secondary')).toBe(true);
    expectBlocks(container);
  });

  it('RF-6 (002) · 6.3: el error de carga es un bloque y «Reintentar» una acción secundaria', async () => {
    const source = { fetchPage: async () => Promise.reject(new Error('x')) } as unknown as ApiceListingRequest['source'];
    const { container } = render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    expect((await screen.findByRole('button', { name: 'Reintentar' })).classList.contains('action-secondary')).toBe(true);
    expectBlocks(container);
  });
});

describe('ApiceList · D-T17 (019)', () => {
  it('RF-7 (019) · 7.3: mientras carga no dice que no hay ápices', () => {
    const source = { fetchPage: () => new Promise<never>(() => undefined) };
    const { container } = render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => <p>vacío</p>} />);
    expect(container.textContent).toBe('');
  });
});

describe('ApiceList · privado (024)', () => {
  it('RF-7 (024) · 7.1, 7.2: la lista pone la etiqueta «privado» solo en las tarjetas de ápices privados', async () => {
    const { source } = fakeListSource(3, () => [
      listed(1, { visibility: 'private' }),
      listed(2, { visibility: 'public' }),
      listed(3),
    ]);
    render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    const cards = await screen.findAllByRole('article');
    expect(cards.length).toBe(3);
    expect(cards[0]?.querySelector('[data-condition="visibility"]')?.textContent).toBe('privado');
    expect(cards[1]?.querySelector('[data-condition="visibility"]')).toBeNull();
    expect(cards[2]?.querySelector('[data-condition="visibility"]')).toBeNull();
  });
});

describe('ApiceList · línea de sección («E3 · Celda»)', () => {
  it('con `titulo` abre con la línea «Ápices» y la cuenta; sin él, no', async () => {
    const { source } = fakeListSource(5);
    const { unmount } = render(<Listed audience="visitor" filters={NO_FILTERS} source={source} titulo empty={() => null} />);
    const region = await screen.findByRole('region', { name: 'Ápices' });
    const heading = within(region).getByRole('heading', { level: 2, name: 'Ápices' });
    expect(heading.closest('.c-seccion')!.textContent).toBe('Ápices5');
    unmount();
    render(<Listed audience="visitor" filters={NO_FILTERS} source={source} empty={() => null} />);
    await screen.findAllByRole('article');
    expect(screen.queryByRole('heading', { level: 2, name: 'Ápices' })).toBeNull();
  });
});

describe('ApiceRows · «E3 · Celda»', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => listed(i + 1));

  it('sin límite dibuja todas las filas; sin Ápices no dibuja nada', () => {
    const { container, unmount } = render(<ApiceRows apices={rows(15)} />);
    expect(within(screen.getByRole('list', { name: 'Ápices' })).getAllByRole('listitem')).toHaveLength(15);
    expect(container.querySelector('.apice-row__mas')).toBeNull();
    unmount();
    expect(render(<ApiceRows apices={[]} />).container.textContent).toBe('');
  });

  it('con más Ápices que el límite, dibuja los primeros y una última fila «N Ápices más» que lleva a la lista', async () => {
    const onMore = vi.fn();
    render(<ApiceRows apices={rows(15)} limit={12} onMore={onMore} />);
    const items = within(screen.getByRole('list', { name: 'Ápices' })).getAllByRole('listitem');
    expect(items).toHaveLength(13);
    expect(screen.queryByRole('link', { name: /Ápice 13/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '3 Ápices más' }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('con uno solo de resto dice «1 Ápice más»; con el límite justo, no hay resumen', () => {
    const { unmount } = render(<ApiceRows apices={rows(13)} limit={12} onMore={() => {}} />);
    screen.getByRole('button', { name: '1 Ápice más' });
    unmount();
    render(<ApiceRows apices={rows(12)} limit={12} onMore={() => {}} />);
    expect(screen.queryByRole('button', { name: /más/ })).toBeNull();
  });

  it('el Ápice abierto se dibuja aunque caiga después del corte, y las filas fuera del filtro se atenúan sin quitarse', () => {
    const { container } = render(<ApiceRows apices={rows(15)} limit={12} onMore={() => {}} currentId="a14" dimmed={new Set(['a1'])} />);
    expect(screen.getByRole('link', { name: /Ápice 14/ }).getAttribute('aria-current')).toBe('true');
    screen.getByRole('button', { name: '2 Ápices más' });
    expect(container.querySelectorAll('.c-fila-off')).toHaveLength(1);
    expect(container.querySelector('.c-fila-off')!.getAttribute('href')).toBe('/apices/a1');
  });
});
