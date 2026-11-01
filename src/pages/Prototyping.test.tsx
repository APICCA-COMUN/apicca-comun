import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource, ListSource } from '../data/apices';
import { fakeClient } from '../testing/facilitationDoubles';
import { emptyListSource, fakeListSource, listed } from '../testing/listDoubles';
import { expectOnePrimary, primaryActions } from '../testing/expectActions';
import { Prototyping } from './Prototyping';

// Prototipado (RF-18 (003), D-T21 (003)): las pruebas de lista de la antigua Home, movidas con sus nombres.
// El mapa real carga Leaflet; aquí se simula con un botón por ápice con ubicación y un modo que falla.
const mapState = vi.hoisted(() => ({ fail: false }));
vi.mock('../components/ApiceMap', () => ({
  ApiceMap: ({
    apices,
    onSelect,
  }: {
    apices: { id: string; name: string; location: unknown }[];
    onSelect?: (id: string) => void;
  }) => {
    if (mapState.fail) throw new Error('mapa roto');
    return (
      <div aria-label="Mapa de ápices">
        {apices
          .filter((a) => a.location !== null)
          .map((a) => (
            <button key={a.id} type="button" onClick={() => onSelect?.(a.id)}>
              Marcador {a.name}
            </button>
          ))}
      </div>
    );
  },
}));

const person: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };

beforeEach(() => {
  mapState.fail = false;
  window.history.replaceState(null, '', '/prototipado');
});

const apiceSource: ApiceSource = {
  onApice(id, callback) {
    const doc: ApiceDoc = { ...listed(Number(id.slice(1))), version: 1, needs: '', offers: '', visibility: 'public', isArchived: false, authorUid: 'u-otra' };
    callback(doc);
    return () => {};
  },
};

/** Sin documento no hay edición rápida: la persona solo ve la ficha resumida. */
const noDocSource: ApiceSource = {
  onApice(_id, callback) {
    callback(null);
    return () => {};
  },
};

function setup(session: SessionState, source: ListSource, docs: ApiceSource = apiceSource) {
  const { client, calls } = fakeClient({ editApice: () => ({ ok: true, version: 2 }) });
  render(
    <SessionProvider initial={session}>
      <Prototyping source={source} apiceSource={docs} client={client} />
    </SessionProvider>,
  );
  return { calls };
}

describe('Prototyping', () => {
  it('RF-12 (003) · 12.4, RF-9 (008) · 9.2: con filtros aplicados un role=status dice «N ápices»', async () => {
    window.history.replaceState(null, '', '/prototipado?ejes=agua');
    const { source } = fakeListSource(3);
    setup(person, source);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('3 ápices'));
  });

  it('RF-12 (003) · 12.4, RF-9 (008) · 9.2: con un solo resultado dice «1 ápice»', async () => {
    window.history.replaceState(null, '', '/prototipado?ejes=agua');
    const { source } = fakeListSource(1);
    setup(person, source);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 ápice'));
  });

  it('RF-8 (005) · 8.3: sin filtros también hay contador, junto al título', async () => {
    const { source } = fakeListSource(3);
    setup(person, source);
    await screen.findAllByRole('article');
    const status = screen.getByRole('status');
    await waitFor(() => expect(status.textContent).toBe('3 ápices'));
    expect(status.closest('.lot')).toBeNull();
  });

  it('RF-8 (005) · 8.3, RF-9 (008) · 9.2: el contador va a la derecha del título, con un ícono decorativo', async () => {
    const { source } = fakeListSource(3);
    setup(person, source);
    await screen.findAllByRole('article');
    const status = screen.getByRole('status');
    const title = status.closest('.prototyping__head')!;
    expect(title.firstElementChild!.tagName).toBe('H1');
    expect(title.lastElementChild).toBe(status.parentElement);
    expect(status.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('RF-7 (005) · 7.12, RF-8 (005) · 8.5: el panel está siempre a la vista con el primer ápice, junto al lote', async () => {
    const { source } = fakeListSource(3);
    setup({ status: 'visitor' }, source);
    await screen.findAllByRole('article');
    await waitFor(() => expect(within(screen.getByRole('complementary', { name: 'Ápice elegido' })).getByRole('heading', { name: 'Ápice 1' })).toBeTruthy());
    const panel = screen.getByRole('complementary', { name: 'Ápice elegido' });
    expect(panel.closest('.apice-lot-section--always')).not.toBeNull();
  });

  it('RF-21 (001): con ápices muestra la lista y los filtros', async () => {
    const { source } = fakeListSource(3);
    setup({ status: 'visitor' }, source);
    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Agua' })).toBeTruthy();
  });

  it('RF-21 (001): el visitante pide la lista de visitante y la inscrita la de inscritas', async () => {
    const visitor = fakeListSource(1);
    setup({ status: 'visitor' }, visitor.source);
    await screen.findAllByRole('article');
    expect(visitor.requests[0]?.audience).toBe('visitor');
  });

  it('RF-21 (001): una persona inscrita pide la lista de inscritas', async () => {
    const member = fakeListSource(1);
    setup(person, member.source);
    await screen.findAllByRole('article');
    expect(member.requests[0]?.audience).toBe('member');
  });

  it('RF-21 (001): sin ápices, la persona inscrita ve «Crear el primero»', async () => {
    setup(person, emptyListSource().source);
    expect(await screen.findByRole('link', { name: 'Crear el primero' })).toBeTruthy();
  });

  it('RF-21 (001): sin ápices, el visitante no ve «Crear el primero»', async () => {
    setup({ status: 'visitor' }, emptyListSource().source);
    expect(await screen.findByText(/Todavía no hay ápices/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Crear el primero' })).toBeNull();
  });

  it('RF-21 (001): elegir un filtro lo escribe en la URL y consulta con él', async () => {
    const { source, requests } = fakeListSource(3);
    setup(person, source);
    await screen.findAllByRole('article');
    await userEvent.click(within(screen.getByRole('form', { name: 'Filtros' })).getByRole('button', { name: 'Agua' }));
    expect(window.location.search).toContain('ejes=agua');
    await waitFor(() => expect(requests.at(-1)?.filters.axes).toEqual(['agua']));
  });

  it('RF-21 (001): recargar con filtros en la URL los conserva', async () => {
    window.history.replaceState(null, '', '/prototipado?ejes=agua,energ%C3%ADa&estado=idea');
    const { source, requests } = fakeListSource(3);
    setup(person, source);
    await screen.findAllByRole('article');
    expect(requests[0]?.filters).toEqual({ axes: ['agua', 'energía'], status: 'idea' });
    expect(within(screen.getByRole('form', { name: 'Filtros' })).getByRole('button', { name: 'Agua' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('combobox', { name: 'Estado' }) as HTMLSelectElement).value).toBe('idea');
  });

  it('RF-21 (001): sin resultados con filtros dice que no hay y «Quitar filtros» los limpia', async () => {
    window.history.replaceState(null, '', '/prototipado?estado=idea');
    const { source, requests } = emptyListSource();
    setup(person, source);
    expect(await screen.findByText(/Ningún ápice cumple/)).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Quitar filtros' })[0] as HTMLElement);
    expect(window.location.search).toBe('');
    await waitFor(() => expect(requests.at(-1)?.filters).toEqual({ axes: [], status: null }));
  });

  it('RF-21 (001): una persona inscrita ve el enlace a «Archivados» y un visitante no', async () => {
    setup(person, fakeListSource(1).source);
    expect((await screen.findByRole('link', { name: 'Archivados' })).getAttribute('href')).toBe('/archivados');
  });

  it('RF-21 (001): el visitante no ve el enlace a «Archivados»', async () => {
    setup({ status: 'visitor' }, fakeListSource(1).source);
    await screen.findAllByRole('article');
    expect(screen.queryByRole('link', { name: 'Archivados' })).toBeNull();
  });

  it('RF-21 (001): el mapa muestra solo los ápices con ubicación y la lista los trae todos', async () => {
    const withPoint = listed(1, { location: { lat: 4.6, lng: -74.1, precision: 'approximate' } });
    const { source } = fakeListSource(2, () => [withPoint, listed(2)]);
    setup({ status: 'visitor' }, source);
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(await screen.findByRole('button', { name: 'Marcador Ápice 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Marcador Ápice 2' })).toBeNull();
  });

  it('RF-21 (001): elegir un ápice en el mapa abre su ficha', async () => {
    const withPoint = listed(1, { location: { lat: 4.6, lng: -74.1, precision: 'exact' } });
    const { source } = fakeListSource(1, () => [withPoint]);
    setup(person, source);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcador Ápice 1' }));
    expect(window.location.pathname).toBe('/apices/a1');
  });

  it('RF-21 (001): si el mapa falla, la lista sigue entera y se avisa', async () => {
    mapState.fail = true;
    const { source } = fakeListSource(3);
    setup(person, source);
    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(await screen.findByText(/El mapa no cargó/)).toBeTruthy();
  });
});

describe('Prototyping · RF-18 (003)', () => {
  it('RF-18 (003) · 18.1, RF-9 (008) · 9.1: el h1 «Prototipado de ápices» va antes del contenido, sin lote envolvente', async () => {
    setup(person, fakeListSource(1).source);
    await screen.findAllByRole('article');
    const heading = screen.getByRole('heading', { level: 1, name: 'Prototipado de ápices' });
    const lot = document.querySelector('.prototyping') as HTMLElement;
    expect(lot).not.toBeNull();
    expect(document.querySelector('.lot')).toBeNull();
    expect(lot.contains(heading)).toBe(true);
    expect(lot.querySelector('.apice-lot-section')!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(lot.querySelector('article')).not.toBeNull();
    expect(lot.querySelector('[aria-label="Mapa de ápices"]')).not.toBeNull();
  });

  it('RF-18 (003) · 18.2: con sesión, «Nuevo ápice» es la única acción azul y lleva a la creación', async () => {
    setup(person, fakeListSource(1).source, noDocSource);
    await screen.findAllByRole('article');
    expectOnePrimary(document.body, 'Nuevo ápice');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).getAttribute('href')).toBe('/apices/nuevo');
  });

  it('RF-18 (003) · 18.3: sin sesión no hay botón azul ni «Nuevo ápice»', async () => {
    setup({ status: 'visitor' }, fakeListSource(1).source);
    await screen.findAllByRole('article');
    expect(primaryActions(document.body)).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Nuevo ápice' })).toBeNull();
  });

  it('RF-18 (003) · 18.4, RF-4 (003) · 4.9: con la lista vacía, «Crear el primero» es secundario y no hay azul extra', async () => {
    setup(person, emptyListSource().source);
    const link = await screen.findByRole('link', { name: 'Crear el primero' });
    expect(link.classList.contains('action-secondary')).toBe(true);
    expect(link.classList.contains('action-primary')).toBe(false);
    expectOnePrimary(document.body, 'Nuevo ápice');
  });

  it('RF-18 (003) · 18.5, RF-17 (003) · 17.2: el enlace «Archivados» sigue siendo un enlace normal', async () => {
    setup(person, fakeListSource(1).source);
    await screen.findAllByRole('article');
    expect(screen.getByRole('link', { name: 'Archivados' }).className).toBe('');
  });
});

describe('Prototyping · sin ápices', () => {
  it('RF-6 (005) · 6.12, RF-7 (005) · 7.13: sin ápices muestra el lote vacío con los filtros y el panel con aviso', async () => {
    setup(person, emptyListSource().source);
    await screen.findByRole('link', { name: 'Crear el primero' });
    expect(document.querySelector('.apice-lot-section__lot--empty')).not.toBeNull();
    expect(screen.getByRole('form', { name: 'Filtros' }).closest('.apice-lot-section__toolbar--floating')).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Ápice elegido' }).textContent).toContain('Aún no hay ápices para mostrar.');
  });
});

describe('Prototyping · RF-8 (005)', () => {
  it('RF-8 (005) · 8.1: el lote ilustrado va encima del mapa y de la lista', async () => {
    setup(person, fakeListSource(3).source);
    await screen.findByRole('button', { name: 'Ápice 1' });
    const building = screen.getByRole('button', { name: 'Ápice 1' });
    const map = screen.getByLabelText('Mapa de ápices');
    const list = screen.getByRole('region', { name: 'Ápices' });
    expect(building.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(building.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-8 (005) · 8.2: los filtros flotan sobre el borde del lote', async () => {
    setup(person, fakeListSource(3).source);
    await screen.findByRole('button', { name: 'Ápice 1' });
    expect(screen.getByRole('form', { name: 'Filtros' }).closest('.apice-lot-section__toolbar--floating')).not.toBeNull();
  });

  it('RF-8 (005) · 8.4, RF-7 (005) · 7.11: con la edición rápida a la vista, «Guardar cambios» es la acción azul', async () => {
    setup(person, fakeListSource(3).source);
    await screen.findByRole('button', { name: 'Ápice 1' });
    await screen.findByRole('button', { name: 'Guardar cambios' });
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 2' }));
    await screen.findByRole('button', { name: 'Guardar cambios' });
    expectOnePrimary(document.body, 'Guardar cambios');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).classList.contains('action-secondary')).toBe(true);
  });

  it('RF-7 (005) · 7.8: al guardar en el panel, la fila de la lista y el edificio muestran el nombre nuevo', async () => {
    const { calls } = setup(person, fakeListSource(3).source);
    await screen.findByRole('button', { name: 'Ápice 1' });
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 2' }));
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Huerta nueva' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const list = screen.getByRole('region', { name: 'Ápices' });
    expect(await within(list).findByRole('link', { name: 'Huerta nueva' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Huerta nueva' }).getAttribute('aria-pressed')).toBe('true');
    expect(calls).toHaveLength(1);
  });

  it('RF-12 (005) · 12.2: elegir en el mapa o en la lista sigue abriendo la ficha, y en el lote abre el panel', async () => {
    const withPoint = listed(1, { location: { lat: 4.6, lng: -74.1, precision: 'approximate' } });
    setup({ status: 'visitor' }, fakeListSource(2, () => [withPoint, listed(2)]).source);
    await screen.findByRole('button', { name: 'Ápice 1' });
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 2' }));
    expect(window.location.pathname).toBe('/prototipado');
    expect(screen.getByRole('complementary', { name: 'Ápice elegido' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Marcador Ápice 1' }));
    expect(window.location.pathname).toBe('/apices/a1');
  });
});
