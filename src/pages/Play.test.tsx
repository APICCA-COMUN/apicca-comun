// RF-11 (021), RF-12 (021), RF-14 (021), RF-15 (021), RF-10 (021), D-T21 (021) a D-T25 (021) · La página del mapa: el sitio
// comienza en el mapa, con sus controles encima y los paneles del ápice sobre él. Muchas pruebas vienen de Prototipado y
// de Mi tablero, que esta página reemplaza (RF-11 (021) sustituye RF-18 (003); RF-15 (021), RF-11 (003)).
// T-13 (024) · RF-3 (024): el recorrido de bienvenida mueve el mapa a lo que señala cada paso.
import fs from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrafts, DraftsContext, type Drafts } from '../app/drafts';
import { navigate } from '../app/router';
import { SessionProvider, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource, ListSource } from '../data/apices';
import type { CommonActionDetail, CommonActionSource, CommonActionSummary } from '../data/commonActions';
import { ApiClientError } from '../data/api';
import type { Location } from '../../shared/domain/location';
import type { NoticeSource } from '../data/constitution/notice';
import type { NoticesSource } from '../data/notices';
import { fakeClient } from '../testing/facilitationDoubles';
import { emptyListSource, fakeListSource, listed } from '../testing/listDoubles';
import { expectOnePrimary, primaryActions } from '../testing/expectActions';
import { Play } from './Play';

// El mapa es el lienzo propio (RF-4 (021)); aquí va el real, con un modo que falla para probar su límite.
const mapState = vi.hoisted(() => ({ fail: false }));
vi.mock('../map/GameMap', async (original) => {
  const real = await original<typeof import('../map/GameMap')>();
  return {
    GameMap: (props: Parameters<typeof real.GameMap>[0]) => {
      if (mapState.fail) throw new Error('mapa roto');
      return <real.GameMap {...props} />;
    },
  };
});

const VISITOR: SessionState = { status: 'visitor' };
const PERSON: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };

beforeEach(() => {
  mapState.fail = false;
  window.history.replaceState(null, '', '/');
});

const apiceSource: ApiceSource = {
  onApice(id, callback) {
    const n = Number(id.slice(1));
    const doc: ApiceDoc = { ...listed(n), version: 1, needs: '', offers: '', visibility: 'public', isArchived: false, authorUid: 'u-otra' };
    callback(Number.isNaN(n) ? null : doc);
    return () => {};
  },
};

const quietNotices: NoticeSource = { fetchNotice: async () => ({ count: 0, nextCloseAt: null }) };
const quietBell: NoticesSource = { fetchNotices: async () => ({ notices: [], seenAt: null }) };

/** Una Acción Común de prueba que une `apiceIds` (RF-18 (021)). */
const summary = (id: string, apiceIds: string[], extra: Partial<CommonActionSummary> = {}): CommonActionSummary => ({
  id,
  title: `Camino ${id}`,
  description: 'Una descripción larga.',
  axis: null,
  status: 'abierta',
  authorUid: 'u-otra',
  authorUsername: 'otra',
  apiceIds,
  participantUids: ['u-otra'],
  participantCount: 1,
  createdAt: 1,
  ...extra,
});

function fakeActions(items: CommonActionSummary[] = []) {
  const lists: Array<string | null> = [];
  const source: CommonActionSource = {
    list: async (uid) => {
      lists.push(uid);
      return items;
    },
    get: async (id) => {
      const found = items.find((item) => item.id === id);
      if (found === undefined) return null;
      const detail: CommonActionDetail = { ...found, participants: [{ uid: 'u-otra', username: 'otra' }], apices: [], hiddenApices: 0 };
      return detail;
    },
  };
  return { source, lists };
}

interface Options {
  source?: ListSource;
  noticeSource?: NoticeSource;
  drafts?: Drafts;
  actionSource?: CommonActionSource;
  handlers?: Record<string, (payload: unknown) => unknown>;
}

function setup(
  session: SessionState,
  { source = fakeListSource(3).source, noticeSource = quietNotices, drafts = createDrafts(), actionSource = fakeActions().source, handlers = {} }: Options = {},
) {
  const { client, calls } = fakeClient({ createApice: () => ({ id: 'a9' }), ...handlers });
  const result = render(
    <DraftsContext.Provider value={drafts}>
      <SessionProvider initial={session}>
        <Play source={source} apiceSource={apiceSource} actionSource={actionSource} client={client} noticeSource={noticeSource} noticesSource={quietBell} />
      </SessionProvider>
    </DraftsContext.Provider>,
  );
  return { ...result, drafts, calls };
}

const map = () => screen.findByRole('region', { name: 'Mapa de ápices' });
const counter = () => document.querySelector('.play__count')!;
const building = (n: number) => ({ name: `Ápice ${n}, Idea` });
const panel = () => screen.queryByRole('complementary');
const cleanupAndReset = () => {
  cleanup();
  window.history.replaceState(null, '', '/');
};

describe('Play · el sitio comienza en el mapa', () => {
  it('RF-11 (021) · 11.1: en / muestra el mapa con los ápices que quien mira puede ver; el visitante pide la lista de visitante', async () => {
    const { source, requests } = fakeListSource(3);
    setup(VISITOR, { source });
    const region = await map();
    expect(await within(region).findByRole('button', building(1))).toBeTruthy();
    expect(requests[0]?.audience).toBe('visitor');
    expect(screen.getByRole('heading', { level: 1, name: 'Mapa de ápices' }).className).toBe('visually-hidden');
  });

  it('RF-11 (021) · 11.1, RF-21 (001): una persona inscrita pide la lista de inscritas', async () => {
    const { source, requests } = fakeListSource(3);
    setup(PERSON, { source });
    await map();
    expect(requests[0]?.audience).toBe('member');
  });

  it('RF-11 (021) · 11.2: el mapa va sin pie de sitio y la página no se desplaza', async () => {
    const { container } = setup(VISITOR);
    await map();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(container.querySelector('.play')).not.toBeNull();
  });

  it('RF-11 (021) · 11.1, D-T21 (021): en la vista de mapa pide tandas hasta tener todos los ápices', async () => {
    const { source, fetchPage } = fakeListSource(60);
    setup(VISITOR, { source });
    await map();
    await waitFor(() => expect(counter().textContent).toBe('60 ápices'));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('RF-2 (017), D-T21 (021): sin panel, el título del documento es el del mapa', async () => {
    setup(VISITOR);
    await map();
    await waitFor(() => expect(document.title).toMatch(/^Jugar/));
  });
});

describe('Play · controles sobre el mapa', () => {
  it('RF-12 (021) · 12.1: sobre el mapa van el logo, el contador, los filtros, el cambio de vista, el tema, la cuenta y «Menú»', async () => {
    setup(PERSON);
    await map();
    const hud = document.querySelector('.play__hud') as HTMLElement;
    within(hud).getByRole('link', { name: 'APICCA COMÚN, ir al inicio' });
    await waitFor(() => expect(counter().textContent).toBe('3 ápices'));
    within(hud).getByRole('form', { name: 'Filtros' });
    within(hud).getByRole('button', { name: 'Ver como lista' });
    within(hud).getByRole('button', { name: /^Cambiar a tema/ });
    within(hud).getByRole('link', { name: 'Lo mío, @ana, Persona inscrita' });
    within(hud).getByRole('button', { name: 'Menú' });
  });

  it('RF-12 (021) · 12.1, RF-12 (003) · 12.4: el contador dice «1 ápice» con un solo resultado y tiene rol de estado', async () => {
    setup(VISITOR, { source: fakeListSource(1).source });
    await waitFor(() => expect(counter().textContent).toBe('1 ápice'));
    expect(counter().getAttribute('role')).toBe('status');
  });

  it('RF-12 (021) · 12.2, RF-7 (019) · 7.3: mientras los ápices cargan, el contador dice «Cargando ápices…» y nada dice que no hay', async () => {
    const source: ListSource = { fetchPage: () => new Promise(() => {}) };
    setup(VISITOR, { source });
    expect(counter().textContent).toBe('Cargando ápices…');
    expect(screen.queryByText(/Aún no hay ápices/)).toBeNull();
  });

  it('RF-12 (021) · 12.3, RF-21 (001): elegir un filtro lo escribe en la dirección, consulta con él y el mapa muestra solo lo que lo cumple', async () => {
    const { source, requests } = fakeListSource(3, (request) => (request.filters.axes.includes('cobijo') ? [listed(7, { axes: ['cobijo'] })] : []));
    setup(VISITOR, { source });
    const region = await map();
    await within(region).findByRole('button', building(1));
    fireEvent.click(within(screen.getByRole('form', { name: 'Filtros' })).getByRole('button', { name: 'Cobijo' }));
    expect(window.location.search).toBe('?ejes=cobijo');
    await within(region).findByRole('button', building(7));
    expect(within(region).queryByRole('button', building(1))).toBeNull();
    expect(requests.at(-1)?.filters.axes).toEqual(['cobijo']);
  });

  it('RF-21 (001), RF-12 (021) · 12.3: recargar con filtros en la dirección los conserva', async () => {
    window.history.replaceState(null, '', '/?ejes=agua&estado=idea');
    const { source, requests } = fakeListSource(2);
    setup(VISITOR, { source });
    await map();
    expect(requests[0]?.filters).toEqual({ axes: ['agua'], status: 'idea' });
  });

  it('RF-12 (021) · 12.4, RF-21 (001): si los filtros no dejan ningún ápice, lo dice con los filtros a la vista, y «Quitar filtros» los limpia', async () => {
    window.history.replaceState(null, '', '/?ejes=agua');
    setup(VISITOR, { source: emptyListSource().source });
    expect(await screen.findByText('Ningún ápice cumple esos filtros.')).toBeTruthy();
    screen.getByRole('form', { name: 'Filtros' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar filtros' })[0]!);
    expect(window.location.search).toBe('');
  });

  it('RF-12 (021) · 12.5, RF-4 (012): con cuenta activa va la campana de avisos; sin sesión, no', async () => {
    const { unmount } = setup(PERSON);
    await map();
    expect(screen.getByRole('button', { name: /^Avisos/ })).toBeTruthy();
    unmount();
    setup(VISITOR);
    await map();
    expect(screen.queryByRole('button', { name: /^Avisos/ })).toBeNull();
  });

  it('RF-12 (021) · 12.1, RF-4 (003) · 4.2: con sesión, «Construir ápice» es la única acción azul y lleva a su panel', async () => {
    const { container } = setup(PERSON);
    await map();
    expectOnePrimary(container, 'Construir ápice');
    const build = screen.getByRole('link', { name: 'Construir ápice' });
    expect(build.getAttribute('href')).toBe('/apices/nuevo');
    expect(primaryActions(container)).toEqual([build]);
  });

  it('RF-12 (021) · 12.1, D-10 (021), RF-23 (021) · 23.1: sin sesión, «Unirme» (la acción azul) lleva a pedir la inscripción y «Construir ápice» abre el boceto', async () => {
    setup(VISITOR);
    await map();
    expect(screen.getByRole('link', { name: 'Construir ápice' }).getAttribute('href')).toBe('/boceto');
    expect(screen.getByRole('link', { name: 'Construir ápice' }).className).toContain('action-secondary');
    const join = screen.getByRole('link', { name: 'Unirme' });
    expect(join.getAttribute('href')).toBe('/solicitar');
    expect(join.className).toContain('action-primary');
  });

  it('RF-12 (021) · 12.1, D-T22 (021): por debajo de 1024 px, los filtros quedan tras «Filtros», que dice si están abiertos', async () => {
    setup(VISITOR);
    await map();
    const toggle = screen.getByRole('button', { name: 'Filtros' });
    const form = screen.getByRole('form', { name: 'Filtros' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(form.parentElement!.id);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Play · vistas', () => {
  it('RF-10 (021) · 10.1 a 10.3: «Ver como lista» cambia el mapa por la lista con ?vista=lista y conserva los filtros; «Ver en el mapa» vuelve', async () => {
    window.history.replaceState(null, '', '/?ejes=agua');
    setup(VISITOR);
    await map();
    fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    expect(window.location.search).toBe('?ejes=agua&vista=lista');
    expect(await screen.findByRole('heading', { name: 'Ápice 1' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Mapa de ápices' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en el mapa' }));
    expect(window.location.search).toBe('?ejes=agua');
    await map();
    expect(screen.queryByRole('heading', { name: 'Ápice 1' })).toBeNull();
  });

  it('RF-10 (021) · 10.3: recargar con ?vista=lista abre la lista; ?vista=mapa abre el mapa', async () => {
    window.history.replaceState(null, '', '/?vista=lista');
    const { unmount } = setup(VISITOR);
    expect(await screen.findByRole('heading', { name: 'Ápice 1' })).toBeTruthy();
    unmount();
    window.history.replaceState(null, '', '/?vista=mapa');
    setup(VISITOR);
    await map();
  });

  it('RF-10 (021) · 10.4, RF-9 (019) · 9.2: en la lista, la etapa y las necesidades se leen en texto', async () => {
    window.history.replaceState(null, '', '/?vista=lista');
    setup(VISITOR, { source: fakeListSource(1, () => [listed(1, { needs: 'Semillas' })]).source });
    const card = (await screen.findByRole('heading', { name: 'Ápice 1' })).closest('article')!;
    expect(card.textContent).toMatch(/Idea/);
    expect(card.textContent).toMatch(/necesidades/i);
  });

  it('RF-9 (021) · 9.1, 9.2: los ápices sin ubicación van en su terreno y se eligen como los demás', async () => {
    const items = [listed(1, { location: null }), listed(2)];
    setup(VISITOR, { source: fakeListSource(2, () => items).source });
    const region = await map();
    const unlocated = await within(region).findByRole('group', { name: 'Sin ubicación' });
    fireEvent.click(within(unlocated).getByRole('button', building(2)));
    expect(window.location.pathname).toBe('/apices/a2');
  });

  it('RF-4 (021) · 4.5, RNF-10 (001): si el mapa falla, se avisa y la lista sigue entera; los controles siguen en pie', async () => {
    mapState.fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup(VISITOR);
    expect((await screen.findByRole('alert')).textContent).toBe('El mapa no cargó. La lista sigue disponible.');
    expect(await screen.findByRole('heading', { name: 'Ápice 3' })).toBeTruthy();
    screen.getByRole('button', { name: 'Menú' });
  });

  it('RF-19 (019) · 19.1 a 19.3: sin ápices ni filtros, el terreno de partida con «Pide tu inscripción»; con sesión, «Propón el primer ápice»', async () => {
    const { unmount } = setup(VISITOR, { source: emptyListSource().source });
    expect(await screen.findByText('Aún no hay ápices en el terreno.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pide tu inscripción' }).getAttribute('href')).toBe('/solicitar');
    unmount();
    setup(PERSON, { source: emptyListSource().source });
    expect((await screen.findByRole('link', { name: 'Propón el primer ápice' })).getAttribute('href')).toBe('/apices/nuevo');
  });
});

describe('Play · paneles sobre el mapa', () => {
  it('RF-14 (021) · 14.1, 14.2, 14.5: elegir un edificio abre su panel en /apices/:id, con la consulta del mapa, sin salir del mapa', async () => {
    window.history.replaceState(null, '', '/?ejes=agua');
    setup(VISITOR);
    const region = await map();
    fireEvent.click(await within(region).findByRole('button', building(2)));
    expect(window.location.pathname + window.location.search).toBe('/apices/a2?ejes=agua');
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    within(aside).getByRole('heading', { level: 1, name: 'Ápice 2' });
    expect(screen.getByRole('region', { name: 'Mapa de ápices' })).toBe(region);
    expect(within(region).getByRole('button', building(2)).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('heading', { level: 1, name: 'Mapa de ápices' })).toBeNull();
  });

  it('RF-14 (021) · 14.6: abrir /apices/:id muestra el mapa con ese panel abierto', async () => {
    window.history.replaceState(null, '', '/apices/a3');
    setup(VISITOR);
    const region = await map();
    expect(await screen.findByRole('complementary', { name: 'Ápice' })).toBeTruthy();
    expect((await within(region).findByRole('button', { name: 'Ápice 3, Idea' })).getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-14 (021) · 14.8: «Cerrar» vuelve al mapa con su consulta y el foco al edificio que abrió el panel', async () => {
    window.history.replaceState(null, '', '/?estado=idea');
    setup(VISITOR);
    const region = await map();
    const opener = await within(region).findByRole('button', building(1));
    opener.focus();
    fireEvent.click(opener);
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    await waitFor(() => expect(document.activeElement).toBe(within(aside).getByRole('heading', { level: 1 })));
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    expect(window.location.pathname + window.location.search).toBe('/?estado=idea');
    expect(panel()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(region).getByRole('button', building(1))));
  });

  it('RF-14 (021) · 14.3, 14.5: con sesión, «Construir ápice» abre el formulario en su panel, sobre el mapa', async () => {
    setup(PERSON);
    await map();
    fireEvent.click(screen.getByRole('link', { name: 'Construir ápice' }));
    expect(window.location.pathname).toBe('/apices/nuevo');
    const aside = await screen.findByRole('complementary', { name: 'Construir ápice' });
    within(aside).getByRole('heading', { level: 1, name: 'Proponer un ápice' });
    within(aside).getByRole('button', { name: 'Crear ápice' });
    screen.getByRole('region', { name: 'Mapa de ápices' });
  });

  it('RF-14 (021) · 14.3, 14.6: abrir /apices/:id/editar muestra el mapa con el formulario de edición', async () => {
    window.history.replaceState(null, '', '/apices/a1/editar');
    setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Editar ápice' });
    within(aside).getByRole('button', { name: 'Guardar cambios' });
  });

  it('RF-14 (021) · 14.4: mientras se llena el formulario, el mapa muestra el edificio en construcción', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    setup(PERSON);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Construir ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    fireEvent.click(within(aside).getByRole('button', { name: 'Comunicación' }));
    const draft = await within(region).findByRole('button', { name: 'Biblioteca, Idea' });
    expect(draft.closest('[role="group"]')?.getAttribute('aria-label')).toBe('Sin ubicación');
    expect(draft.getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-14 (021) · 14.4: al editar, el edificio del mapa toma la etapa elegida en el formulario', async () => {
    window.history.replaceState(null, '', '/apices/a1/editar');
    setup(PERSON);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Editar ápice' });
    fireEvent.change(within(aside).getByLabelText('Etapa'), { target: { value: 'en marcha' } });
    expect(await within(region).findByRole('button', { name: 'Ápice 1, En marcha' })).toBeTruthy();
  });

  it('RF-14 (021) · 14.9: cerrar el formulario con cambios sin guardar pide confirmación; «Seguir editando» se queda y «Descartar cambios» cierra y borra el borrador', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    const { drafts } = setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Construir ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    expect(within(aside).getByRole('alert').textContent).toMatch('Tienes cambios sin guardar. ¿Quieres descartarlos?');
    expect(window.location.pathname).toBe('/apices/nuevo');
    fireEvent.click(within(aside).getByRole('button', { name: 'Seguir editando' }));
    expect(within(aside).queryByRole('alert')).toBeNull();
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(within(aside).getByRole('button', { name: 'Descartar cambios' }));
    expect(window.location.pathname).toBe('/');
    expect(drafts.get('apice:new')).toBeUndefined();
  });

  it('RF-14 (021) · 14.9: elegir otro edificio con cambios sin guardar también pide confirmación', async () => {
    window.history.replaceState(null, '', '/apices/a1/editar');
    setup(PERSON);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Editar ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Otro nombre' } });
    fireEvent.click(await within(region).findByRole('button', building(2)));
    expect(window.location.pathname).toBe('/apices/a1/editar');
    fireEvent.click(within(aside).getByRole('button', { name: 'Descartar cambios' }));
    expect(window.location.pathname).toBe('/apices/a2');
  });

  it('RF-14 (021) · 14.9: sin cambios, cerrar el formulario no pregunta', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Construir ápice' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    expect(window.location.pathname).toBe('/');
  });

  it('RF-14 (021) · 14.1: el panel sigue a la dirección: navegar a otra ficha cambia su contenido', async () => {
    window.history.replaceState(null, '', '/apices/a1');
    setup(VISITOR);
    await map();
    await screen.findByRole('heading', { level: 1, name: 'Ápice 1' });
    act(() => navigate('/apices/a2'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ápice 2' })).toBeTruthy();
  });
});

describe('Play · Lo mío', () => {
  it('RF-15 (021) · 15.1: con sesión, «Lo mío» pide los ápices propios y escribe ?mio=1; sin sesión no está', async () => {
    const { source, requests } = fakeListSource(3);
    const { unmount } = setup(PERSON, { source });
    await map();
    const mine = screen.getByRole('button', { name: 'Lo mío' });
    expect(mine.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(mine);
    expect(mine.getAttribute('aria-pressed')).toBe('true');
    expect(window.location.search).toBe('?mio=1');
    await waitFor(() => expect(requests.at(-1)).toMatchObject({ audience: 'mine', uid: 'u-ana' }));
    unmount();
    setup(VISITOR);
    await map();
    expect(screen.queryByRole('button', { name: 'Lo mío' })).toBeNull();
  });

  it('RF-15 (021) · 15.1, D-T25 (021): la entrada de la cuenta lleva a Lo mío sin salir del mapa, y Atrás lo quita', async () => {
    const { source, requests } = fakeListSource(3);
    setup(PERSON, { source });
    await map();
    const mine = screen.getByRole('button', { name: 'Lo mío' });
    fireEvent.click(screen.getByRole('link', { name: /^Lo mío, @/ }));
    expect(window.location.search).toBe('?mio=1');
    expect(mine.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(requests.at(-1)).toMatchObject({ audience: 'mine', uid: 'u-ana' }));
    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(mine.getAttribute('aria-pressed')).toBe('false'));
    await waitFor(() => expect(requests.at(-1)).toMatchObject({ audience: 'member' }));
  });

  it('RF-15 (021) · 15.1, D-T25 (021): con Lo mío, los filtros se aplican en el navegador', async () => {
    window.history.replaceState(null, '', '/?mio=1&ejes=cobijo');
    const items = [listed(1, { axes: ['cobijo'] }), listed(2, { axes: ['agua'] })];
    const { source, requests } = fakeListSource(2, () => items);
    setup(PERSON, { source });
    const region = await map();
    await within(region).findByRole('button', building(1));
    expect(within(region).queryByRole('button', building(2))).toBeNull();
    expect(requests[0]).toMatchObject({ audience: 'mine', uid: 'u-ana' });
  });

  it('RF-15 (021) · 15.1, RF-19 (019): sin ápices propios, el terreno de partida de Mi tablero', async () => {
    window.history.replaceState(null, '', '/?mio=1');
    setup(PERSON, { source: emptyListSource().source });
    expect(await screen.findByText('Todavía no tienes ápices en el terreno.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Propón tu primer ápice' }).getAttribute('href')).toBe('/apices/nuevo');
  });

  it('RF-15 (021) · 15.2, RF-15 (004) · 15.1: con cuenta activa, el mapa muestra el aviso de propuestas abiertas', async () => {
    const noticeSource: NoticeSource = { fetchNotice: vi.fn().mockResolvedValue({ count: 2, nextCloseAt: Date.parse('2026-10-20T12:00:00Z') }) };
    setup(PERSON, { noticeSource });
    expect(await screen.findByRole('status', { name: /aviso de propuestas abiertas/i })).toBeTruthy();
    expect(screen.getByText(/Hay 2 propuestas abiertas/i)).toBeTruthy();
  });

  it('RF-15 (021) · 15.2, RF-15 (004) · 15.1: si el aviso no se puede leer, el mapa sigue sin él; sin sesión no se pide', async () => {
    const fetchNotice = vi.fn().mockRejectedValue(new Error('sin red'));
    const { unmount } = setup(PERSON, { noticeSource: { fetchNotice } });
    await map();
    await waitFor(() => expect(fetchNotice).toHaveBeenCalled());
    expect(screen.queryByRole('status', { name: /aviso de propuestas abiertas/i })).toBeNull();
    unmount();
    const visitorFetch = vi.fn().mockResolvedValue({ count: 2, nextCloseAt: null });
    setup(VISITOR, { noticeSource: { fetchNotice: visitorFetch } });
    await map();
    expect(visitorFetch).not.toHaveBeenCalled();
  });

  it('RF-15 (004) · 15.1: el aviso de propuestas solo se importa en la página del mapa y en la de la constitución', () => {
    const pagesDir = path.resolve(__dirname);
    const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
    const allowed = new Set(['Play.tsx', 'ConstitutionPage.tsx']);
    for (const file of files) {
      if (allowed.has(file)) continue;
      expect(fs.readFileSync(path.join(pagesDir, file), 'utf-8').includes('AmendmentNotice'), file).toBe(false);
    }
  });

  it('RF-14 (021) · 14.8, D-T23 (021): cerrar un panel con teclado deja el foco en el mapa si quien lo abrió ya no está', async () => {
    window.history.replaceState(null, '', '/apices/a1');
    setup(VISITOR);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    await userEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(region.contains(document.activeElement)).toBe(true));
  });
  it('RF-10 (021) · 10.1, 10.3, RF-14 (021) · 14.8, RNF-1 (021): abrir una tarjeta de la lista conserva la lista y su consulta; «Cerrar» vuelve a la tarjeta', async () => {
    window.history.replaceState(null, '', '/?vista=lista&estado=idea');
    setup(VISITOR);
    const link = await screen.findByRole('link', { name: 'Ápice 2' });
    fireEvent.click(link);
    expect(window.location.pathname + window.location.search).toBe('/apices/a2?estado=idea&vista=lista');
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    await waitFor(() => expect(document.activeElement).toBe(within(aside).getByRole('heading', { level: 1 })));
    expect(screen.getByRole('link', { name: 'Ápice 2' })).toBe(link);
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    expect(window.location.pathname + window.location.search).toBe('/?estado=idea&vista=lista');
    await waitFor(() => expect(document.activeElement).toBe(link));
  });

  it('RF-14 (021) · 14.3, 14.5: «Editar» en la ficha abre el formulario en el mismo panel, con la consulta del mapa', async () => {
    window.history.replaceState(null, '', '/apices/a1?ejes=agua');
    setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    fireEvent.click(await within(aside).findByRole('link', { name: 'Editar' }));
    expect(window.location.pathname + window.location.search).toBe('/apices/a1/editar?ejes=agua');
    expect(await screen.findByRole('complementary', { name: 'Editar ápice' })).toBeTruthy();
  });

  it('RNF-1 (021), RF-14 (021) · 14.7: con el panel ampliado, el mapa tapado sale del orden del teclado', async () => {
    window.history.replaceState(null, '', '/apices/a1');
    setup(VISITOR);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    expect(region.closest('[inert]')).toBeNull();
    fireEvent.click(within(aside).getByRole('button', { name: 'Ampliar' }));
    expect(region.closest('[inert]')).not.toBeNull();
    fireEvent.click(within(aside).getByRole('button', { name: 'Reducir' }));
    expect(region.closest('[inert]')).toBeNull();
  });
});

describe('Play · caminos', () => {
  const ONE = () => fakeActions([summary('c1', ['a1', 'a2', 'a3'])]);
  const pathLabel = () => screen.findByRole('button', { name: 'Camino: Camino c1' });

  it('RF-18 (021) · 18.1, D-T33 (021): el mapa dibuja los caminos y el contador dice «n ápices · m caminos»', async () => {
    setup(VISITOR, { actionSource: ONE().source });
    await map();
    expect(await pathLabel()).toBeTruthy();
    await waitFor(() => expect(counter().textContent).toBe('3 ápices · 1 camino'));
  });

  it('RF-20 (021) · 20.1, 20.5: elegir un camino abre su panel en /acciones/:id, con la consulta del mapa', async () => {
    window.history.replaceState(null, '', '/?estado=idea');
    setup(VISITOR, { actionSource: ONE().source });
    await map();
    fireEvent.click(await pathLabel());
    expect(window.location.pathname + window.location.search).toBe('/acciones/c1?estado=idea');
    const aside = await screen.findByRole('complementary', { name: 'Camino' });
    expect(await within(aside).findByRole('heading', { level: 1, name: 'Camino c1' })).toBeTruthy();
    expect((await pathLabel()).getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-20 (021) · 20.5: /acciones abre la vista de lista con la sección «Caminos» antes que los ápices', async () => {
    window.history.replaceState(null, '', '/acciones');
    setup(VISITOR, { actionSource: ONE().source });
    const section = await screen.findByRole('region', { name: 'Caminos' });
    expect(within(section).getByRole('link', { name: 'Camino c1' }).getAttribute('href')).toBe('/acciones/c1');
    const apices = screen.getByRole('region', { name: 'Ápices' });
    expect(section.compareDocumentPosition(apices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-5 (010), D-T33 (021): sin caminos, la lista lo dice', async () => {
    window.history.replaceState(null, '', '/?vista=lista');
    setup(VISITOR);
    expect(await screen.findByText('Todavía no hay caminos.')).toBeTruthy();
  });

  it('RF-6 (010), D-T34 (021): con «Lo mío», pide solo los caminos en los que participa y, si no hay, lo dice', async () => {
    window.history.replaceState(null, '', '/?mio=1&vista=lista');
    const { source, lists } = fakeActions();
    setup(PERSON, { actionSource: source });
    expect(await screen.findByText('Todavía no participas en ningún camino.')).toBeTruthy();
    expect(lists).toContain('u-ana');
    expect(screen.getByRole('link', { name: 'Ver todos los caminos' }).getAttribute('href')).toBe('/acciones');
  });

  it('RF-19 (021) · 19.1, D-10 (021): sin sesión no hay «Trazar camino»; con sesión abre su panel', async () => {
    setup(VISITOR);
    await map();
    expect(screen.queryByRole('link', { name: 'Trazar camino' })).toBeNull();
    cleanupAndReset();
    setup(PERSON);
    await map();
    fireEvent.click(screen.getByRole('link', { name: 'Trazar camino' }));
    expect(window.location.pathname).toBe('/acciones/nueva');
    const aside = await screen.findByRole('complementary', { name: 'Trazar camino' });
    within(aside).getByText('Elige en el mapa los ápices que une este camino.');
  });

  it('RF-19 (021) · 19.1 a 19.3: mientras traza, elegir un edificio lo suma (o lo quita) y el panel dice cuántos faltan; con tres, el formulario', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    setup(PERSON);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Trazar camino' });
    expect(within(aside).getByRole('status').textContent).toBe('Faltan 3 ápices.');
    fireEvent.click(await within(region).findByRole('button', building(1)));
    expect(window.location.pathname).toBe('/acciones/nueva');
    fireEvent.click(within(region).getByRole('button', building(2)));
    expect(within(aside).getByRole('status').textContent).toBe('Falta 1 ápice.');
    fireEvent.click(within(region).getByRole('button', building(2)));
    expect(within(aside).getByRole('status').textContent).toBe('Faltan 2 ápices.');
    expect(within(aside).queryByRole('textbox', { name: 'Título' })).toBeNull();
    fireEvent.click(within(region).getByRole('button', building(3)));
    fireEvent.click(within(region).getByRole('button', building(2)));
    expect(within(aside).getByRole('status').textContent).toBe('Puedes proponerlo.');
    expect(within(within(aside).getByRole('list', { name: 'Ápices elegidos' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Ápice 1Quitar',
      'Ápice 3Quitar',
      'Ápice 2Quitar',
    ]);
    within(aside).getByRole('textbox', { name: 'Título' });
    expect(region.querySelector('polyline.game-map__path[data-draft="true"]')).not.toBeNull();
  });

  it('RF-19 (021) · 19.3, RF-1 (010): «Proponer» manda los ápices en orden y abre el panel del camino nuevo', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    const { calls } = setup(PERSON, { handlers: { proposeCommonAction: () => ({ id: 'c9' }) } });
    const region = await map();
    for (const n of [2, 1, 3]) fireEvent.click(await within(region).findByRole('button', building(n)));
    const aside = await screen.findByRole('complementary', { name: 'Trazar camino' });
    await userEvent.type(within(aside).getByRole('textbox', { name: 'Título' }), 'Agua lluvia');
    await userEvent.type(within(aside).getByRole('textbox', { name: 'Descripción' }), 'Juntemos el agua lluvia del barrio.');
    await userEvent.click(within(aside).getByRole('button', { name: 'Proponer' }));
    expect(calls).toContainEqual({
      op: 'proposeCommonAction',
      payload: { title: 'Agua lluvia', description: 'Juntemos el agua lluvia del barrio.', axis: null, apiceIds: ['a2', 'a1', 'a3'] },
    });
    await waitFor(() => expect(window.location.pathname).toBe('/acciones/c9'));
  });

  it('RF-19 (021) · 19.7: si el servidor rechaza, muestra el motivo y conserva lo elegido y lo escrito', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    setup(PERSON, {
      handlers: {
        proposeCommonAction: () => {
          throw new ApiClientError('action-limit');
        },
      },
    });
    const region = await map();
    for (const n of [1, 2, 3]) fireEvent.click(await within(region).findByRole('button', building(n)));
    const aside = await screen.findByRole('complementary', { name: 'Trazar camino' });
    await userEvent.type(within(aside).getByRole('textbox', { name: 'Título' }), 'Agua lluvia');
    await userEvent.type(within(aside).getByRole('textbox', { name: 'Descripción' }), 'Juntemos el agua lluvia del barrio.');
    await userEvent.click(within(aside).getByRole('button', { name: 'Proponer' }));
    expect((await within(aside).findByRole('alert')).textContent).toMatch(/20 caminos abiertos/);
    expect((within(aside).getByRole('textbox', { name: 'Título' }) as HTMLInputElement).value).toBe('Agua lluvia');
    expect(within(within(aside).getByRole('list', { name: 'Ápices elegidos' })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('RF-19 (021) · 19.4: pasar de diez avisa el máximo y no suma', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    setup(PERSON, { source: fakeListSource(11).source });
    const region = await map();
    for (let n = 1; n <= 11; n += 1) fireEvent.click(await within(region).findByRole('button', building(n)));
    const aside = await screen.findByRole('complementary', { name: 'Trazar camino' });
    expect(within(within(aside).getByRole('list', { name: 'Ápices elegidos' })).getAllByRole('listitem')).toHaveLength(10);
    expect(within(aside).getByRole('alert').textContent).toBe('Un camino une como máximo 10 ápices.');
  });

  it('RF-19 (021) · 19.6: «Cancelar» cierra sin guardar nada y el mapa vuelve a abrir fichas', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    const { calls } = setup(PERSON);
    const region = await map();
    fireEvent.click(await within(region).findByRole('button', building(1)));
    const aside = await screen.findByRole('complementary', { name: 'Trazar camino' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Cancelar' }));
    expect(window.location.pathname).toBe('/');
    expect(region.querySelector('polyline.game-map__path')).toBeNull();
    expect(calls.filter((call) => call.op === 'proposeCommonAction')).toHaveLength(0);
    fireEvent.click(within(region).getByRole('button', building(1)));
    expect(window.location.pathname).toBe('/apices/a1');
  });

  it('RF-19 (021) · 19.5, RNF-1 (021): en la vista de lista, cada tarjeta tiene la casilla «Sumar al camino»', async () => {
    window.history.replaceState(null, '', '/acciones/nueva?vista=lista');
    setup(PERSON);
    const boxes = await screen.findAllByRole('checkbox', { name: 'Sumar al camino' });
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[0]!);
    const aside = screen.getByRole('complementary', { name: 'Trazar camino' });
    expect(within(aside).getByRole('status').textContent).toBe('Faltan 2 ápices.');
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
  });
});


describe('Play · bienvenida', () => {
  const welcome = () => screen.queryByRole('region', { name: 'Bienvenida' });
  beforeEach(() => {
    window.localStorage.removeItem('apicca:bienvenida');
  });

  it('RF-21 (021) · 21.1, 21.2: la primera vez, el mapa muestra la invitación sin taparlo: los edificios siguen a la vista', async () => {
    setup(VISITOR);
    const region = await map();
    expect(await screen.findByRole('region', { name: 'Bienvenida' })).toBeTruthy();
    expect(within(region).getByRole('button', building(1))).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Bienvenida' }).closest('.play__board')).toBeNull();
  });

  it('RF-21 (021) · 21.3: tras «Cerrar» no vuelve a mostrarse en este navegador', async () => {
    setup(VISITOR);
    await map();
    fireEvent.click(within((await screen.findByRole('region', { name: 'Bienvenida' }))).getByRole('button', { name: 'Cerrar' }));
    expect(welcome()).toBeNull();
    cleanupAndReset();
    setup(VISITOR);
    await map();
    expect(welcome()).toBeNull();
  });

  it('RF-22 (021) · 22.1, 22.3: «Jugar» abre el recorrido; sin caminos tiene dos pasos', async () => {
    setup(PERSON);
    await map();
    fireEvent.click(within((await screen.findByRole('region', { name: 'Bienvenida' }))).getByRole('button', { name: 'Jugar' }));
    expect(welcome()!.textContent).toContain('Paso 1 de 2');
    expect(window.localStorage.getItem('apicca:bienvenida')).not.toBeNull();
  });

  it('RF-22 (021) · 22.1: con un camino a la vista, el recorrido tiene tres pasos', async () => {
    setup(VISITOR, { actionSource: fakeActions([summary('c1', ['a1', 'a2', 'a3'])]).source });
    await map();
    await screen.findByRole('button', { name: 'Camino: Camino c1' });
    fireEvent.click(within((await screen.findByRole('region', { name: 'Bienvenida' }))).getByRole('button', { name: 'Jugar' }));
    expect(welcome()!.textContent).toContain('Paso 1 de 3');
  });

  it('D-T37 (021): no se muestra con un panel abierto, en la vista de lista ni sobre el terreno de partida', async () => {
    window.history.replaceState(null, '', '/apices/a1');
    setup(VISITOR);
    await screen.findByRole('complementary');
    expect(welcome()).toBeNull();
    cleanupAndReset();
    window.history.replaceState(null, '', '/?vista=lista');
    setup(VISITOR);
    await screen.findByRole('region', { name: 'Ápices' });
    expect(welcome()).toBeNull();
    cleanupAndReset();
    setup(VISITOR, { source: emptyListSource().source });
    await screen.findByRole('region', { name: 'Terreno de partida' });
    expect(welcome()).toBeNull();
  });

  it('RF-21 (021) · 21.4: con ?bienvenida=1 vuelve a mostrarse aunque ya se haya visto, y la dirección queda limpia', async () => {
    window.localStorage.setItem('apicca:bienvenida', '1');
    window.history.replaceState(null, '', '/?bienvenida=1&estado=idea');
    setup(VISITOR);
    await map();
    expect(await screen.findByRole('region', { name: 'Bienvenida' })).toBeTruthy();
    expect(window.location.pathname + window.location.search).toBe('/?estado=idea');
  });
});

describe('Play · el recorrido mueve el mapa (RF-3 (024))', () => {
  const zone = (cell: string, lat: number, lng: number): Location => ({ lat, lng, precision: 'approximate', zone: { cell, lat, lng } });
  const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
  const MEDELLIN = zone('876619d92ffffff', 6.243305, -75.585547);
  const located = () => fakeListSource(3, () => [listed(1, { location: CENTRO }), listed(2, { location: CENTRO }), listed(3, { location: MEDELLIN })]).source;
  const level = () => screen.getByRole('region', { name: 'Mapa de ápices' }).getAttribute('data-level');
  const world = () => document.querySelector<HTMLElement>('.game-map__world')!.style.transform;
  const next = (name: string) => fireEvent.click(within(screen.getByRole('region', { name: 'Bienvenida' })).getByRole('button', { name }));
  beforeEach(() => {
    window.localStorage.removeItem('apicca:bienvenida');
  });
  /** Espera a que lleguen los caminos: el recorrido cuenta con ellos al abrirse. */
  const loaded = async (lists: unknown[]) => {
    await waitFor(() => expect(lists.length).toBeGreaterThan(0));
    await act(async () => {});
  };

  it('RF-3 (024) · 3.1: «Jugar» lleva el mapa a un ápice, con su edificio a la vista', async () => {
    setup(PERSON, { source: located() });
    await map();
    expect(level()).toBe('2');
    next('Jugar');
    await waitFor(() => expect(level()).toBe('0'));
    expect(document.querySelectorAll('.game-map button.game-map__building').length).toBeGreaterThan(0);
  });

  it('RF-3 (024) · 3.2: «Siguiente» lleva el mapa a un camino que se dibuja, con su rótulo a la vista', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a2'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Jugar');
    next('Siguiente');
    expect(await screen.findByRole('button', { name: 'Camino: Camino c1' })).toBeTruthy();
    expect(level()).toBe('0');
  });

  it('RF-3 (024) · 3.2: si el camino une ápices lejanos, el mapa se aleja hasta que caben', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a3'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Jugar');
    next('Siguiente');
    expect(Number(level())).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Camino: Camino c1' })).toBeTruthy();
  });

  it('RF-3 (024): el paso de construir no mueve el mapa', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a2'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Jugar');
    next('Siguiente');
    const before = world();
    next('Siguiente');
    expect(screen.getByRole('region', { name: 'Bienvenida' }).textContent).toContain('Paso 3 de 3');
    expect(world()).toBe(before);
  });

  it('RF-3 (024) · 3.2, RF-22 (021) · 22.3: un camino con un solo ápice a la vista no se dibuja y el recorrido omite ese paso', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a-oculto'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Jugar');
    expect(screen.getByRole('region', { name: 'Bienvenida' }).textContent).toContain('Paso 1 de 2');
  });

  it('RF-3 (024) · D-12 (024): si la tarjeta cruza el centro del mapa, el encuadre del paso reserva su área; si no, no cambia', async () => {
    const offsetY = () => Number(/translate\((-?\d+)px, (-?\d+)px\)/.exec(world())![2]);
    const rects = (card: { left: number; right: number; top: number }) => {
      const original = HTMLElement.prototype.getBoundingClientRect;
      const box = (left: number, top: number, right: number, bottom: number): DOMRect =>
        ({ left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top, toJSON: () => ({}) }) as DOMRect;
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('game-map')) return box(0, 0, 390, 559);
        if (this.classList.contains('welcome-card')) return box(card.left, card.top, card.right, 559 - 12);
        return original.call(this);
      });
    };
    const run = async () => {
      window.localStorage.removeItem('apicca:bienvenida');
      setup(PERSON, { source: located() });
      await map();
      next('Jugar');
      await waitFor(() => expect(level()).toBe('0'));
      return offsetY();
    };
    const free = await run();
    cleanupAndReset();
    rects({ left: 12, right: 310, top: 274 });
    const covered = await run();
    // El mapa mide 960 × 560 en jsdom, pero la reserva sale de lo medido con `getBoundingClientRect`: 559 − 274 = 285 px.
    expect(Math.abs(free - covered - 285 / 2)).toBeLessThanOrEqual(1);
    cleanupAndReset();
    vi.restoreAllMocks();
    rects({ left: 12, right: 120, top: 274 });
    // Una tarjeta que no llega al centro (195 ± 46 px) tapa lo mismo que nada: el encuadre no cambia.
    expect(await run()).toBe(free);
    vi.restoreAllMocks();
  });

  it('RF-3 (024): «Saltar el recorrido» quita la tarjeta y deja el mapa donde está', async () => {
    setup(PERSON, { source: located() });
    await map();
    next('Jugar');
    const before = world();
    next('Saltar el recorrido');
    expect(screen.queryByRole('region', { name: 'Bienvenida' })).toBeNull();
    expect(world()).toBe(before);
  });
});

describe('Play · boceto', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('RF-23 (021) · 23.1, 23.2, 23.4: sin sesión, «Construir ápice» abre el boceto; su edificio va al mapa como «Boceto», sin contar ni llamar al servidor', async () => {
    const { calls } = setup(VISITOR);
    await map();
    await waitFor(() => expect(counter().textContent).toBe('3 ápices'));
    fireEvent.click(screen.getByRole('link', { name: 'Construir ápice' }));
    expect(window.location.pathname).toBe('/boceto');
    const aside = await screen.findByRole('complementary', { name: 'Boceto' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Agua' }));
    const drawn = await within(await map()).findByRole('button', { name: 'Boceto, Idea' });
    expect(drawn.getAttribute('data-sketch')).toBe('true');
    expect(counter().textContent).toBe('3 ápices');
    expect(calls).toHaveLength(0);
    expect(JSON.parse(window.sessionStorage.getItem('apicca:boceto') ?? '{}')).toEqual({ axes: ['agua'], status: 'idea' });
  });

  it('RF-23 (021) · 23.2: al cerrar el panel, el boceto sale del mapa', async () => {
    window.sessionStorage.setItem('apicca:boceto', JSON.stringify({ axes: ['agua'], status: 'idea' }));
    window.history.replaceState(null, '', '/boceto');
    setup(VISITOR);
    expect(await within(await map()).findByRole('button', { name: 'Boceto, Idea' })).toBeTruthy();
    fireEvent.click(within(await screen.findByRole('complementary', { name: 'Boceto' })).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Boceto, Idea' })).toBeNull());
  });

  it('D-T39 (021): con sesión, /boceto lleva a «Construir ápice»', async () => {
    window.history.replaceState(null, '', '/boceto');
    setup(PERSON);
    await waitFor(() => expect(window.location.pathname).toBe('/apices/nuevo'));
  });
});

describe('Play · mapa de partida', () => {
  it('RF-24 (021) · 24.1, 24.2, 24.3: sin ápices ni filtros, el terreno de partida con los cinco ejes, una frase y una sola invitación: unirse sin sesión', async () => {
    const { container } = setup(VISITOR, { source: emptyListSource().source });
    const terrain = await screen.findByRole('region', { name: 'Terreno de partida' });
    expect(terrain.querySelectorAll('.starting-terrain__base')).toHaveLength(5);
    expect(terrain.querySelectorAll('p')).toHaveLength(1);
    expect(within(terrain).getByRole('link').getAttribute('href')).toBe('/solicitar');
    expectOnePrimary(container, 'Pide tu inscripción');
    expect(screen.queryByRole('region', { name: 'Mapa de ápices' })).toBeNull();
  });

  it('RF-24 (021) · 24.2: con sesión, la invitación es construir', async () => {
    const { container } = setup(PERSON, { source: emptyListSource().source });
    const terrain = await screen.findByRole('region', { name: 'Terreno de partida' });
    expect(within(terrain).getByRole('link').getAttribute('href')).toBe('/apices/nuevo');
    expectOnePrimary(container, 'Propón el primer ápice');
  });
});
