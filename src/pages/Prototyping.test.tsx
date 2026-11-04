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

/** Abre Prototipado en la vista de lista (RF-6 (019) · 6.2), con más parámetros si los hay. */
function asList(query = '') {
  window.history.replaceState(null, '', `/prototipado?vista=lista${query}`);
}

/** Abre el mapa con «Ver en el mapa» (RF-10 (019) · 10.5, D-T25 (019)) y lo devuelve. */
async function openMap() {
  await userEvent.click(await screen.findByRole('button', { name: 'Ver en el mapa' }));
  return screen.findByLabelText('Mapa de ápices');
}

/** El edificio del lote de un ápice de prueba, con su etapa en el nombre (D-T19 (019)). */
const building = (n: number) => ({ name: `Ápice ${n}, Idea` });

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

  it('RF-8 (005) · 8.3, RF-7 (019) · 7.1: sin filtros también hay contador, en la franja y fuera del lote', async () => {
    const { source } = fakeListSource(3);
    setup(person, source);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('3 ápices'));
    const status = screen.getByRole('status');
    expect(status.closest('.apice-lot-section__strip')).not.toBeNull();
    expect(status.closest('.lot, .apice-lot')).toBeNull();
  });

  it('RF-9 (008) · 9.2, RF-7 (019) · 7.1: el contador lleva un ícono decorativo y va en la franja, no en la fila del título', async () => {
    const { source } = fakeListSource(3);
    setup(person, source);
    await screen.findByRole('button', building(1));
    const status = screen.getByRole('status');
    expect(document.querySelector('.prototyping__head')!.firstElementChild!.tagName).toBe('H1');
    expect(status.closest('.prototyping__head')).toBeNull();
    expect(status.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('RF-7 (005) · 7.12, RF-8 (005) · 8.5: el panel está siempre a la vista con el primer ápice, junto al lote', async () => {
    const { source } = fakeListSource(3);
    setup({ status: 'visitor' }, source);
    await waitFor(() => expect(within(screen.getByRole('complementary', { name: 'Ápice elegido' })).getByRole('heading', { name: 'Ápice 1' })).toBeTruthy());
    const panel = screen.getByRole('complementary', { name: 'Ápice elegido' });
    expect(panel.closest('.apice-lot-section--always')).not.toBeNull();
  });

  it('RF-21 (001), RF-6 (019) · 6.2: con ápices, la vista de lista muestra la lista y los filtros', async () => {
    asList();
    const { source } = fakeListSource(3);
    setup({ status: 'visitor' }, source);
    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Agua' })).toBeTruthy();
  });

  it('RF-21 (001): el visitante pide la lista de visitante y la inscrita la de inscritas', async () => {
    const visitor = fakeListSource(1);
    setup({ status: 'visitor' }, visitor.source);
    await screen.findByRole('button', building(1));
    expect(visitor.requests[0]?.audience).toBe('visitor');
  });

  it('RF-21 (001): una persona inscrita pide la lista de inscritas', async () => {
    const member = fakeListSource(1);
    setup(person, member.source);
    await screen.findByRole('button', building(1));
    expect(member.requests[0]?.audience).toBe('member');
  });

  it('RF-21 (001): elegir un filtro lo escribe en la URL y consulta con él', async () => {
    const { source, requests } = fakeListSource(3);
    setup(person, source);
    await screen.findByRole('button', building(1));
    await userEvent.click(within(screen.getByRole('form', { name: 'Filtros' })).getByRole('button', { name: 'Agua' }));
    expect(window.location.search).toContain('ejes=agua');
    await waitFor(() => expect(requests.at(-1)?.filters.axes).toEqual(['agua']));
  });

  it('RF-21 (001): recargar con filtros en la URL los conserva', async () => {
    window.history.replaceState(null, '', '/prototipado?ejes=agua,energ%C3%ADa&estado=idea');
    const { source, requests } = fakeListSource(3);
    setup(person, source);
    await screen.findByRole('button', building(1));
    expect(requests[0]?.filters).toEqual({ axes: ['agua', 'energía'], status: 'idea' });
    expect(within(screen.getByRole('form', { name: 'Filtros' })).getByRole('button', { name: 'Agua' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('combobox', { name: 'Etapa' }) as HTMLSelectElement).value).toBe('idea');
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
    await screen.findByRole('button', building(1));
    expect(screen.queryByRole('link', { name: 'Archivados' })).toBeNull();
  });

  it('RF-21 (001): el mapa muestra solo los ápices con ubicación y la lista los trae todos', async () => {
    asList();
    const withPoint = listed(1, { location: { lat: 4.6, lng: -74.1, precision: 'approximate' } });
    const { source } = fakeListSource(2, () => [withPoint, listed(2)]);
    setup({ status: 'visitor' }, source);
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    await openMap();
    expect(await screen.findByRole('button', { name: 'Marcador Ápice 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Marcador Ápice 2' })).toBeNull();
  });

  it('RF-21 (001): elegir un ápice en el mapa abre su ficha', async () => {
    const withPoint = listed(1, { location: { lat: 4.6, lng: -74.1, precision: 'exact' } });
    const { source } = fakeListSource(1, () => [withPoint]);
    setup(person, source);
    await openMap();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcador Ápice 1' }));
    expect(window.location.pathname).toBe('/apices/a1');
  });

  it('RF-21 (001): si el mapa falla, la lista sigue entera y se avisa', async () => {
    asList();
    mapState.fail = true;
    const { source } = fakeListSource(3);
    setup(person, source);
    expect(await screen.findAllByRole('article')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Ver en el mapa' }));
    expect(await screen.findByText(/El mapa no cargó/)).toBeTruthy();
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });
});

describe('Prototyping · RF-18 (003)', () => {
  it('RF-18 (003) · 18.1, RF-9 (008) · 9.1: el h1 «Prototipado de ápices» va antes del contenido, sin lote envolvente', async () => {
    setup(person, fakeListSource(1).source);
    await screen.findByRole('button', building(1));
    const heading = screen.getByRole('heading', { level: 1, name: 'Prototipado de ápices' });
    const lot = document.querySelector('.prototyping') as HTMLElement;
    expect(lot).not.toBeNull();
    expect(document.querySelector('.lot')).toBeNull();
    expect(lot.contains(heading)).toBe(true);
    expect(lot.querySelector('.apice-lot-section')!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(lot.querySelector('.apice-lot')).not.toBeNull();
    await openMap();
    expect(lot.querySelector('[aria-label="Mapa de ápices"]')).not.toBeNull();
  });

  it('RF-18 (003) · 18.2: con sesión, «Nuevo ápice» es la única acción azul y lleva a la creación', async () => {
    setup(person, fakeListSource(1).source, noDocSource);
    await screen.findByRole('button', building(1));
    expectOnePrimary(document.body, 'Nuevo ápice');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).getAttribute('href')).toBe('/apices/nuevo');
  });

  it('RF-18 (003) · 18.3: sin sesión no hay botón azul ni «Nuevo ápice»', async () => {
    setup({ status: 'visitor' }, fakeListSource(1).source);
    await screen.findByRole('button', building(1));
    expect(primaryActions(document.body)).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Nuevo ápice' })).toBeNull();
  });

  it('RF-18 (003) · 18.5, RF-17 (003) · 17.2: el enlace «Archivados» sigue siendo un enlace normal', async () => {
    setup(person, fakeListSource(1).source);
    await screen.findByRole('button', building(1));
    expect(screen.getByRole('link', { name: 'Archivados' }).className).toBe('');
  });
});

describe('Prototyping · RF-8 (005)', () => {
  it('RF-8 (005) · 8.1, RF-6 (019) · 6.3: el lote ilustrado va encima del mapa, y la lista no está a la vez', async () => {
    setup(person, fakeListSource(3).source);
    const first = await screen.findByRole('button', building(1));
    const map = await openMap();
    expect(first.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Ápices' })).toBeNull();
  });

  it('RF-7 (019) · 7.1: los filtros van en la franja, antes del lote y fuera de él', async () => {
    setup(person, fakeListSource(3).source);
    const first = await screen.findByRole('button', building(1));
    const filters = screen.getByRole('form', { name: 'Filtros' });
    expect(filters.closest('.apice-lot-section__strip')).not.toBeNull();
    expect(filters.closest('.apice-lot-section')).toBeNull();
    expect(filters.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-8 (005) · 8.4, RF-7 (005) · 7.11: con la edición rápida a la vista, «Guardar cambios» es la acción azul', async () => {
    setup(person, fakeListSource(3).source);
    await screen.findByRole('button', building(1));
    await screen.findByRole('button', { name: 'Guardar cambios' });
    await userEvent.click(screen.getByRole('button', building(2)));
    await screen.findByRole('button', { name: 'Guardar cambios' });
    expectOnePrimary(document.body, 'Guardar cambios');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).classList.contains('action-secondary')).toBe(true);
  });

  it('RF-7 (005) · 7.8: al guardar en el panel, la fila de la lista y el edificio muestran el nombre nuevo', async () => {
    const { calls } = setup(person, fakeListSource(3).source);
    await screen.findByRole('button', building(1));
    await userEvent.click(screen.getByRole('button', building(2)));
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Huerta nueva' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect((await screen.findByRole('button', { name: 'Huerta nueva, Idea' })).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    const list = await screen.findByRole('region', { name: 'Ápices' });
    expect(within(list).getByRole('link', { name: 'Huerta nueva' })).toBeTruthy();
    expect(calls).toHaveLength(1);
  });

  it('RF-12 (005) · 12.2: elegir en el mapa o en la lista sigue abriendo la ficha, y en el lote abre el panel', async () => {
    const withPoint = listed(1, { location: { lat: 4.6, lng: -74.1, precision: 'approximate' } });
    setup({ status: 'visitor' }, fakeListSource(2, () => [withPoint, listed(2)]).source);
    await screen.findByRole('button', building(1));
    await userEvent.click(screen.getByRole('button', building(2)));
    expect(window.location.pathname).toBe('/prototipado');
    expect(screen.getByRole('complementary', { name: 'Ápice elegido' })).toBeTruthy();
    await openMap();
    await userEvent.click(screen.getByRole('button', { name: 'Marcador Ápice 1' }));
    expect(window.location.pathname).toBe('/apices/a1');
  });

  it('RF-2 (017): la página fija su propio título de documento', async () => {
    setup(person, emptyListSource().source);
    await screen.findByRole('heading', { level: 1, name: 'Prototipado de ápices' });
    expect(document.title).toBe('Prototipado · APICCA COMÚN');
  });
});

describe('Prototyping · terreno (019)', () => {
  const lot = () => document.querySelector('.apice-lot');
  const list = () => screen.queryByRole('region', { name: 'Ápices' });

  it('RF-6 (019) · 6.1, 6.3, D-T20 (019): el terreno es la vista principal y la lista no se muestra a la vez', async () => {
    const { source } = fakeListSource(3);
    setup(person, source);
    await waitFor(() => expect(lot()).not.toBeNull());
    expect(list()).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver como lista' })).toBeTruthy();
  });

  it('RF-6 (019) · 6.2, 6.3, D-T20 (019): «Ver como lista» muestra la lista con ?vista=lista y conserva los filtros; «Ver como terreno» vuelve', async () => {
    window.history.replaceState(null, '', '/prototipado?ejes=agua');
    const { source } = fakeListSource(3);
    setup(person, source);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver como lista' }));
    await waitFor(() => expect(list()).not.toBeNull());
    expect(lot()).toBeNull();
    const params = new URLSearchParams(window.location.search);
    expect(params.get('vista')).toBe('lista');
    expect(params.get('ejes')).toBe('agua');
    expect(within(list()!).getAllByRole('article')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Ver como terreno' }));
    await waitFor(() => expect(lot()).not.toBeNull());
    expect(list()).toBeNull();
    expect(new URLSearchParams(window.location.search).get('vista')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('ejes')).toBe('agua');
  });

  it('RF-6 (019) · 6.2: recargar con ?vista=lista abre la lista; elegir un filtro no cambia la vista', async () => {
    window.history.replaceState(null, '', '/prototipado?vista=lista');
    const { source } = fakeListSource(3);
    setup(person, source);
    await waitFor(() => expect(list()).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Agua' }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('ejes')).toBe('agua'));
    expect(new URLSearchParams(window.location.search).get('vista')).toBe('lista');
  });

  it('RF-7 (019) · 7.1, D-T20 (019): los filtros, el contador y el control de vista van en una franja fuera del terreno', async () => {
    const { source } = fakeListSource(3);
    setup(person, source);
    await waitFor(() => expect(lot()).not.toBeNull());
    const strip = document.querySelector('.apice-lot-section__strip')!;
    expect(strip).not.toBeNull();
    expect(within(strip as HTMLElement).getByRole('form', { name: 'Filtros' })).toBeTruthy();
    expect(strip.querySelector('.filters-count')).not.toBeNull();
    expect(within(strip as HTMLElement).getByRole('button', { name: 'Ver como lista' })).toBeTruthy();
    expect(strip.contains(lot())).toBe(false);
    expect(lot()!.contains(strip)).toBe(false);
  });

  it('RF-7 (019) · 7.3: mientras carga, el contador dice «Cargando ápices…» y nada dice que no hay ápices', async () => {
    setup(person, { fetchPage: () => new Promise<never>(() => undefined) });
    expect((await screen.findByRole('status')).textContent).toBe('Cargando ápices…');
    expect(document.body.textContent).not.toMatch(/no hay ápices/i);
  });

  it('RF-19 (019) · 19.1, 19.3, 19.4, D-T22 (019): sin ápices ni filtros, solo el terreno de partida, sin filtros, mapa, lista ni lote', async () => {
    setup({ status: 'visitor' }, emptyListSource().source);
    const terrain = await screen.findByRole('region', { name: 'Terreno de partida' });
    expect(terrain.querySelectorAll('.starting-terrain__base')).toHaveLength(5);
    expect(screen.getAllByText(/no hay ápices|no tienes ápices/i)).toHaveLength(1);
    expect(screen.getByText('Aún no hay ápices en el terreno.')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Filtros' })).toBeNull();
    expect(screen.queryByLabelText('Mapa de ápices')).toBeNull();
    expect(list()).toBeNull();
    expect(lot()).toBeNull();
    expect(screen.queryByRole('button', { name: /Ver como/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver en el mapa' })).toBeNull();
  });

  it('RF-19 (019) · 19.2, D-T22 (019): sin sesión, la invitación es «Pide tu inscripción»', async () => {
    setup({ status: 'visitor' }, emptyListSource().source);
    const action = await screen.findByRole('link', { name: 'Pide tu inscripción' });
    expect(action.getAttribute('href')).toBe('/solicitar');
    expectOnePrimary(document.body, 'Pide tu inscripción');
  });

  it('RF-19 (019) · 19.2, D-T22 (019): con sesión, la invitación es «Propón el primer ápice» y «Nuevo ápice» pasa a secundario', async () => {
    setup(person, emptyListSource().source);
    const action = await screen.findByRole('link', { name: 'Propón el primer ápice' });
    expect(action.getAttribute('href')).toBe('/apices/nuevo');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).classList.contains('action-secondary')).toBe(true);
    expect(primaryActions(document.body)).toEqual([action]);
  });

  it('RF-19 (019), RF-21 (001): con filtros y sin resultados no hay terreno de partida y los filtros siguen a la vista', async () => {
    window.history.replaceState(null, '', '/prototipado?ejes=agua');
    setup(person, emptyListSource().source);
    expect(await screen.findByText('Ningún ápice cumple esos filtros.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Terreno de partida' })).toBeNull();
    expect(screen.getByRole('form', { name: 'Filtros' })).toBeTruthy();
  });
});

describe('Prototyping · RF-10 (019)', () => {
  it('RF-10 (019) · 10.5, D-T25 (019): el mapa no está hasta que se pide con «Ver en el mapa», que va en la franja con aria-expanded y aria-controls', async () => {
    setup({ status: 'visitor' }, fakeListSource(2).source);
    await screen.findByRole('button', building(1));
    expect(screen.queryByLabelText('Mapa de ápices')).toBeNull();
    const strip = document.querySelector('.apice-lot-section__strip') as HTMLElement;
    const toggle = within(strip).getByRole('button', { name: 'Ver en el mapa' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const target = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(target).not.toBeNull();
    await userEvent.click(toggle);
    const map = await screen.findByLabelText('Mapa de ápices');
    expect(target!.contains(map)).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Ocultar el mapa');
    await userEvent.click(toggle);
    expect(screen.queryByLabelText('Mapa de ápices')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toBe('Ver en el mapa');
  });

  it('RF-10 (019) · 10.1, 10.5: con el mapa abierto, el terreno va antes que el mapa', async () => {
    setup({ status: 'visitor' }, fakeListSource(2).source);
    const first = await screen.findByRole('button', building(1));
    const map = await openMap();
    expect(first.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-10 (019) · 10.5, RF-18 (003) · 18.3: el control es secundario; sin sesión, ni abierto ni cerrado hay botón azul', async () => {
    setup({ status: 'visitor' }, fakeListSource(2).source);
    const toggle = await screen.findByRole('button', { name: 'Ver en el mapa' });
    expect(toggle.classList.contains('action-secondary')).toBe(true);
    expectOnePrimary(document.body, null);
    await userEvent.click(toggle);
    await screen.findByLabelText('Mapa de ápices');
    expectOnePrimary(document.body, null);
  });
});

describe('Prototyping · RF-8 (019) · 8.3', () => {
  it('RF-8 (019) · 8.3, D-T26 (019): con 560 px o más, el lote de Prototipado va en zigzag, con caminos', async () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
    try {
      setup({ status: 'visitor' }, fakeListSource(3).source);
      await screen.findByRole('button', building(1));
      await waitFor(() => expect(document.querySelector('.apice-lot--trail')).not.toBeNull());
      expect(document.querySelectorAll('.apice-lot__roads line').length).toBeGreaterThan(0);
    } finally {
      if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
    }
  });
});
