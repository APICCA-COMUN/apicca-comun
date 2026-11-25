// RF-11 (021), RF-12 (021), RF-14 (021), RF-15 (021), RF-10 (021), D-T21 (021) a D-T25 (021) · La página del mapa: el sitio
// comienza en el mapa, con la cabecera arriba y, a la derecha, un panel con sus controles; los paneles del ápice, de
// «Prototipar un Ápice» y de «Conectar» ocupan el lugar de ese panel (composición P1 del sistema «APICCA · Mapa»). Muchas pruebas vienen de Prototipado y
// de Mi tablero, que esta página reemplaza (RF-11 (021) sustituye RF-18 (003); RF-15 (021), RF-11 (003)).
// T-13 (024) · RF-3 (024): el recorrido de bienvenida mueve el mapa a lo que señala cada paso.
// «E3 · Celda»: la columna de Inicio lleva las filas de Ápices y la leyenda-control (al pie del mapa) es el filtro: en el mapa
// atenúa, en la lista consulta; una línea de llamada une la celda grande con el mapa cuando hay 900 px o más.
import fs from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { Play, rowsThatFit } from './Play';

// El mapa es el lienzo propio (RF-4 (021)); aquí va el real, con un modo que falla para probar su límite.
const mapState = vi.hoisted(() => ({
  fail: false,
  /** Dónde dice el mapa que cae lo elegido (`onAnchor`); `null`, en ningún lugar visible. */
  anchor: null as { x: number; y: number } | null,
  /** Las últimas propiedades que la página le dio al mapa. */
  props: null as { level?: number; onLevelChange?: (level: 0 | 1 | 2) => void; dimmedIds?: ReadonlySet<string>; hideZoomControls?: boolean } | null,
}));
vi.mock('../map/GameMap', async (original) => {
  const real = await original<typeof import('../map/GameMap')>();
  return {
    GameMap: (props: Parameters<typeof real.GameMap>[0]) => {
      if (mapState.fail) throw new Error('mapa roto');
      mapState.props = props;
      // El mapa real no mide en jsdom: la prueba le dice dónde cae lo elegido (y el mapa real no avisa).
      useEffect(() => {
        props.onAnchor?.(mapState.anchor);
      });
      const { onAnchor: _unused, ...rest } = props;
      return <real.GameMap {...rest} />;
    },
  };
});

const VISITOR: SessionState = { status: 'visitor' };
const PERSON: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };

const realMatchMedia = window.matchMedia;
const realRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  mapState.fail = false;
  mapState.anchor = null;
  mapState.props = null;
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
  Element.prototype.getBoundingClientRect = realRect;
});

/** Con `true`, la ventana mide 900 px o más (columna y mapa lado a lado); con `false`, es un teléfono. */
function viewport(wide: boolean) {
  window.matchMedia = ((consulta: string) => ({
    matches: wide && consulta.includes('900px'),
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

/** Donde jsdom no sabe medir: el contenedor, la columna y su celda grande (o su Arco) tienen un lugar fijo. */
function layout() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList.contains('play__body')) return rect(0, 60, 1200, 740);
    if (this.classList.contains('play__panel')) return rect(24, 60, 344, 740);
    if (this.classList.contains('celda-grande') || this.classList.contains('pieza-arco')) return rect(40, 200, 280, 280);
    return realRect.call(this);
  };
}

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
  title: `Acción ${id}`,
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
      const detail: CommonActionDetail = { ...found, participants: [{ uid: 'u-otra', username: 'otra' }], apices: found.apiceIds.map((apiceId) => ({ id: apiceId, name: `Ápice ${apiceId}`, status: 'prototipo' as const })), hiddenApices: 0 };
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
const building = (n: number, axis = 'agua') => ({ name: `Ápice ${n}, ${axis}, Idea` });
/** El panel abierto: la región complementaria que no es el panel de Inicio. */
const panel = () => screen.queryAllByRole('complementary').find((element) => element.getAttribute('aria-label') !== 'Inicio') ?? null;
const home = () => screen.getByRole('complementary', { name: 'Inicio' });
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
    const aside = home();
    within(aside).getByRole('heading', { level: 1, name: 'API para crear y conectar Acciones Comunes' });
    within(aside).getByText('Apoyo mutuo, commoning y economías recíprocas no monetarias.');
    expect(screen.queryByRole('heading', { level: 1, name: 'Mapa de ápices' })).toBeNull();
  });

  it('RF-11 (021) · 11.1, RF-21 (001): una persona inscrita pide la lista de inscritas', async () => {
    const { source, requests } = fakeListSource(3);
    setup(PERSON, { source });
    await map();
    expect(requests[0]?.audience).toBe('member');
  });

  it('RF-11 (021) · 11.2: el mapa va sin pie de sitio, con la cabecera arriba y el panel a su lado', async () => {
    const { container } = setup(VISITOR);
    const region = await map();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    const body = container.querySelector('.play__body')!;
    expect(container.querySelector('.play > .site-header')).not.toBeNull();
    expect(body.querySelector('.play__stage')!.contains(region)).toBe(true);
    expect(body.querySelector('.play__panel')!.contains(home())).toBe(true);
  });

  it('E3 · Celda: la columna lleva la línea «Ápices» con sus filas y, abajo, el título, la entradilla y las acciones, en ese orden; la leyenda va con el mapa', async () => {
    setup(PERSON);
    await map();
    const aside = home();
    const names = [
      within(aside).getByRole('list', { name: 'Ápices' }),
      within(aside).getByRole('button', { name: 'Ver como lista' }),
      within(aside).getByRole('heading', { level: 1 }),
      within(aside).getByRole('link', { name: 'Prototipar un Ápice' }),
      within(aside).getByRole('link', { name: 'Conectar' }),
    ];
    names.slice(1).forEach((element, index) => {
      expect(names[index]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING, `posición ${index + 1}`).toBeTruthy();
    });
    expect(within(names[0]!).getAllByRole('listitem')).toHaveLength(3);
    // La leyenda-control reemplaza a los filtros, a las Etapas y a los Ejes de la columna: está con el mapa, no en ella.
    const legend = screen.getByRole('group', { name: 'Filtrar por eje' }).closest('.play__legend')! as HTMLElement;
    expect(legend.closest('.play__stage')).not.toBeNull();
    expect(aside.contains(legend)).toBe(false);
    within(legend).getByRole('group', { name: 'Etapa' });
    within(legend).getByRole('group', { name: 'Nivel' });
    expect(screen.queryByRole('form', { name: 'Filtros' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Filtros' })).toBeNull();
  });

  it('E3 · Celda: más de 12 Ápices se resumen en una última fila «N Ápices más» que lleva a la lista', async () => {
    setup(VISITOR, { source: fakeListSource(15).source });
    await map();
    const rows = await within(home()).findByRole('list', { name: 'Ápices' });
    await waitFor(() => expect(within(rows).getAllByRole('listitem')).toHaveLength(13));
    expect(within(rows).queryByRole('link', { name: /Ápice 13/ })).toBeNull();
    fireEvent.click(within(rows).getByRole('button', { name: '3 Ápices más' }));
    expect(window.location.search).toBe('?vista=lista');
    expect(await screen.findByRole('heading', { name: 'Ápice 13' })).toBeTruthy();
  });

  it('P1: elegir una fila de la lista abre la ficha en el mismo panel, y «Cerrar» devuelve el panel de Inicio', async () => {
    setup(VISITOR);
    await map();
    fireEvent.click(within(home()).getByRole('link', { name: 'Ápice 2' }));
    expect(window.location.pathname).toBe('/apices/a2');
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    within(aside).getByRole('heading', { level: 1, name: 'Ápice 2' });
    expect(screen.queryByRole('complementary', { name: 'Inicio' })).toBeNull();
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    expect(window.location.pathname).toBe('/');
    home();
  });

  it('RF-11 (021) · 11.1, D-T21 (021): en la vista de mapa pide tandas hasta tener todos los ápices', async () => {
    const { source, fetchPage } = fakeListSource(60);
    setup(VISITOR, { source });
    await map();
    await waitFor(() => expect(counter().textContent).toBe('60 Ápices'));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('RF-2 (017), D-T21 (021): sin panel, el título del documento es el del mapa', async () => {
    setup(VISITOR);
    await map();
    await waitFor(() => expect(document.title).toMatch(/^Ápices/));
  });
});

describe('Play · controles sobre el mapa', () => {
  it('RF-12 (021) · 12.1: la cabecera lleva el logo, el tema, la cuenta y «Menú»; la columna, la cuenta y el cambio de vista; el mapa, la leyenda', async () => {
    setup(PERSON);
    await map();
    const header = screen.getByRole('banner');
    within(header).getByRole('link', { name: 'APICCA COMÚN, ir al inicio' });
    within(header).getByRole('button', { name: /^Cambiar a tema/ });
    within(header).getByRole('link', { name: 'Lo mío, @ana, Persona inscrita' });
    within(header).getByRole('button', { name: 'Menú' });
    await waitFor(() => expect(counter().textContent).toBe('3 Ápices'));
    const aside = home();
    within(aside).getByRole('button', { name: 'Ver como lista' });
    expect(aside.contains(counter())).toBe(true);
    screen.getByRole('group', { name: 'Filtrar por eje' });
    expect(document.querySelector('.play__hud')).toBeNull();
  });

  it('RF-12 (021) · 12.1, RF-12 (003) · 12.4: el contador dice «1 Ápice» con un solo resultado y es una región viva, sin recuadro (metadato)', async () => {
    setup(VISITOR, { source: fakeListSource(1).source });
    await waitFor(() => expect(counter().textContent).toBe('1 Ápice'));
    expect(counter().getAttribute('aria-live')).toBe('polite');
    expect(counter().classList.contains('block')).toBe(false);
  });

  it('RF-12 (021) · 12.2, RF-7 (019) · 7.3: mientras los ápices cargan, el contador dice «Cargando ápices…» y nada dice que no hay', async () => {
    const source: ListSource = { fetchPage: () => new Promise(() => {}) };
    setup(VISITOR, { source });
    expect(counter().textContent).toBe('Cargando Ápices…');
    expect(screen.queryByText(/Aún no hay ápices/)).toBeNull();
  });

  it('RF-12 (021) · 12.3, RF-21 (001): en el mapa, elegir un eje en la leyenda lo escribe en la dirección y atenúa lo que no lo cumple, sin consultar ni quitar nada', async () => {
    const items = [listed(1, { axes: ['agua'] }), listed(2, { axes: ['cobijo'] })];
    const { source, requests } = fakeListSource(2, () => items);
    setup(VISITOR, { source });
    const region = await map();
    await within(region).findByRole('button', building(1));
    const cobijo = screen.getByRole('button', { name: 'Cobijo' });
    expect(cobijo.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(cobijo);
    expect(window.location.search).toBe('?ejes=cobijo');
    expect(cobijo.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(within(region).getByRole('button', building(1)).getAttribute('data-off')).toBe('true'));
    expect(within(region).getByRole('button', building(2, 'cobijo')).hasAttribute('data-off')).toBe(false);
    // Atenuar no quita: el Ápice y su fila siguen, y la consulta no llevó el filtro.
    expect(requests.every((request) => request.filters.axes.length === 0)).toBe(true);
    expect(mapState.props?.dimmedIds?.has('a1')).toBe(true);
    // La fila fuera del filtro se apaga y lo dice.
    const row = document.querySelector('.apice-row__link[href="/apices/a1"]')!;
    expect(row.classList.contains('c-fila-off')).toBe(true);
    expect(row.closest('li')!.querySelector('.apice-row__description')!.textContent).toContain('fuera del filtro');
    expect(document.querySelector('.apice-row__link[href="/apices/a2"]')!.classList.contains('c-fila-off')).toBe(false);
  });

  it('RF-12 (021) · 12.3: la Etapa de la leyenda se elige y se quita al tocarla de nuevo', async () => {
    setup(VISITOR);
    await map();
    const idea = screen.getByRole('button', { name: 'Etapa Idea' });
    fireEvent.click(idea);
    expect(window.location.search).toBe('?estado=idea');
    expect(idea.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(idea);
    expect(window.location.search).toBe('');
  });

  it('RF-21 (001), RF-12 (021) · 12.3: en la lista, los filtros de la leyenda van al servidor y el nivel del mapa no se dibuja', async () => {
    window.history.replaceState(null, '', '/?vista=lista');
    const { source, requests } = fakeListSource(3, (request) => (request.filters.axes.includes('cobijo') ? [listed(7, { axes: ['cobijo'] })] : []));
    setup(VISITOR, { source });
    await screen.findByRole('heading', { name: 'Ápice 1' });
    expect(screen.queryByRole('group', { name: 'Nivel' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cobijo' }));
    expect(window.location.search).toBe('?ejes=cobijo&vista=lista');
    expect(await screen.findByRole('heading', { name: 'Ápice 7' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ápice 1' })).toBeNull();
    expect(requests.at(-1)?.filters.axes).toEqual(['cobijo']);
  });

  it('RF-21 (001), RF-12 (021) · 12.3: recargar con filtros en la dirección los conserva (encendidos en la leyenda y atenuando en el mapa)', async () => {
    window.history.replaceState(null, '', '/?ejes=agua&estado=idea');
    const { source, requests } = fakeListSource(2);
    setup(VISITOR, { source });
    await map();
    expect(requests[0]?.filters).toEqual({ axes: [], status: null });
    expect(screen.getByRole('button', { name: 'Agua' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Etapa Idea' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-21 (001), RF-12 (021) · 12.3: recargar en la lista con filtros los manda al servidor', async () => {
    window.history.replaceState(null, '', '/?ejes=agua&estado=idea&vista=lista');
    const { source, requests } = fakeListSource(2);
    setup(VISITOR, { source });
    await screen.findByRole('heading', { name: 'Ápice 1' });
    expect(requests[0]?.filters).toEqual({ axes: ['agua'], status: 'idea' });
  });

  it('RF-12 (021) · 12.4, RF-21 (001): si los filtros no dejan ningún ápice (lista), lo dice y «Quitar filtros» los limpia', async () => {
    window.history.replaceState(null, '', '/?ejes=agua&vista=lista');
    setup(VISITOR, { source: emptyListSource().source });
    expect(await screen.findByText('Ningún ápice cumple esos filtros.')).toBeTruthy();
    screen.getByRole('group', { name: 'Filtrar por eje' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar filtros' })[0]!);
    expect(window.location.search).toBe('?vista=lista');
  });

  it('RF-12 (021) · 12.4: con filtros activos la leyenda ofrece «Quitar filtros», y sin ellos, no', async () => {
    setup(VISITOR);
    await map();
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Agua' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(window.location.search).toBe('');
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
  });

  it('E3 · Celda: el nivel del mapa lo elige la leyenda (controlado), parte del que el mapa dice y los controles de zoom propios se esconden', async () => {
    setup(VISITOR);
    await map();
    expect(mapState.props?.hideZoomControls).toBe(true);
    // Hasta que se elige uno, el mapa manda: no se le pasa `level`.
    expect(mapState.props?.level).toBeUndefined();
    const cercano = screen.getByRole('button', { name: 'Nivel 0, el más cercano' });
    const lejano = screen.getByRole('button', { name: 'Nivel 2, el más alejado' });
    fireEvent.click(lejano);
    await waitFor(() => expect(mapState.props?.level).toBe(2));
    expect(lejano.getAttribute('aria-pressed')).toBe('true');
    expect(cercano.getAttribute('aria-pressed')).toBe('false');
    // Si el mapa avisa de otro nivel (rueda o teclado), la leyenda lo sigue.
    act(() => mapState.props?.onLevelChange?.(0));
    await waitFor(() => expect(mapState.props?.level).toBe(0));
    expect(cercano.getAttribute('aria-pressed')).toBe('true');
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

  it('RF-12 (021) · 12.1, RF-4 (003) · 4.2: con sesión, «Prototipar un Ápice» es la única acción azul y lleva a su panel', async () => {
    const { container } = setup(PERSON);
    await map();
    expectOnePrimary(container, 'Prototipar un Ápice');
    const build = screen.getByRole('link', { name: 'Prototipar un Ápice' });
    expect(build.getAttribute('href')).toBe('/apices/nuevo');
    expect(primaryActions(container)).toEqual([build]);
  });

  it('RF-12 (021) · 12.1, D-10 (021), RF-23 (021) · 23.1: sin sesión, «Prototipar un Ápice» (la acción principal) abre el boceto y «Unirme» lleva a pedir la inscripción', async () => {
    const { container } = setup(VISITOR);
    await map();
    expect(screen.getByRole('link', { name: 'Prototipar un Ápice' }).getAttribute('href')).toBe('/boceto');
    expect(screen.getByRole('link', { name: 'Prototipar un Ápice' }).className).toContain('action-primary');
    const join = within(home()).getByRole('link', { name: 'Unirme' });
    expect(join.getAttribute('href')).toBe('/solicitar');
    expect(join.className).toContain('c-enlace');
    expect(primaryActions(container)).not.toContain(join);
    expect(primaryActions(container).map((element) => element.textContent)).toContain('Prototipar un Ápice');
    expect(screen.getAllByRole('link', { name: 'Prototipar un Ápice' })[0]!.querySelector('svg.icono--avanzar')).not.toBeNull();
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
  it('RF-14 (021) · 14.1, 14.2, 14.5: elegir un Ápice en el mapa abre su panel en /apices/:id, con la consulta del mapa, sin salir del mapa', async () => {
    window.history.replaceState(null, '', '/?ejes=agua');
    setup(VISITOR);
    const region = await map();
    fireEvent.click(await within(region).findByRole('button', building(2)));
    expect(window.location.pathname + window.location.search).toBe('/apices/a2?ejes=agua');
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    within(aside).getByRole('heading', { level: 1, name: 'Ápice 2' });
    expect(screen.getByRole('region', { name: 'Mapa de ápices' })).toBe(region);
    expect(within(region).getByRole('button', building(2)).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('complementary', { name: 'Inicio' })).toBeNull();
  });

  it('RF-14 (021) · 14.6: abrir /apices/:id muestra el mapa con ese panel abierto', async () => {
    window.history.replaceState(null, '', '/apices/a3');
    setup(VISITOR);
    const region = await map();
    expect(await screen.findByRole('complementary', { name: 'Ápice' })).toBeTruthy();
    expect((await within(region).findByRole('button', { name: 'Ápice 3, agua, Idea' })).getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-14 (021) · 14.8: «Cerrar» vuelve al mapa con su consulta y el foco al Ápice que abrió el panel', async () => {
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

  it('RF-14 (021) · 14.3, 14.5: con sesión, «Prototipar un Ápice» abre el formulario en su panel, junto al mapa', async () => {
    setup(PERSON);
    await map();
    fireEvent.click(screen.getByRole('link', { name: 'Prototipar un Ápice' }));
    expect(window.location.pathname).toBe('/apices/nuevo');
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    within(aside).getByRole('heading', { level: 1, name: 'Proponer un ápice' });
    expect(aside.querySelector('.game-panel__bar .c-rot')!.textContent).toBe('Ápice');
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

  it('RF-14 (021) · 14.4: mientras se llena el formulario, el mapa muestra el Ápice tal como quedará', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    setup(PERSON);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    fireEvent.click(within(aside).getByRole('button', { name: 'Comunicación' }));
    const draft = await within(region).findByRole('button', { name: 'Biblioteca, comunicación, Idea' });
    expect(draft.closest('[role="group"]')?.getAttribute('aria-label')).toBe('Sin ubicación');
    expect(draft.getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-14 (021) · 14.4: al editar, el Ápice del mapa toma la etapa elegida en el formulario', async () => {
    window.history.replaceState(null, '', '/apices/a1/editar');
    setup(PERSON);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Editar ápice' });
    fireEvent.change(within(aside).getByLabelText('Etapa'), { target: { value: 'en marcha' } });
    expect(await within(region).findByRole('button', { name: 'Ápice 1, agua, En marcha' })).toBeTruthy();
  });

  it('RF-14 (021) · 14.9: cerrar el formulario con cambios sin guardar pide confirmación; «Seguir editando» se queda y «Descartar cambios» cierra y borra el borrador', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    const { drafts } = setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
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

  it('RF-14 (021) · 14.9: elegir otro Ápice con cambios sin guardar también pide confirmación', async () => {
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
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    expect(window.location.pathname).toBe('/');
  });

  it('RF-14 (021) · 14.9: con cambios sin guardar, un navigate hacia fuera del mapa pregunta y no navega; «Seguir editando» se queda', async () => {
    window.history.replaceState(null, '', '/apices/a1/editar');
    const { drafts } = setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Editar ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Otro nombre' } });
    act(() => navigate('/foro'));
    expect(window.location.pathname).toBe('/apices/a1/editar');
    expect(within(aside).getByRole('alert').textContent).toMatch('Tienes cambios sin guardar. ¿Quieres descartarlos?');
    fireEvent.click(within(aside).getByRole('button', { name: 'Seguir editando' }));
    expect(within(aside).queryByRole('alert')).toBeNull();
    expect(window.location.pathname).toBe('/apices/a1/editar');
    expect(drafts.get('apice:a1')).toBeDefined();
  });

  it('RF-14 (021) · 14.9: con cambios sin guardar, un navigate hacia fuera y «Descartar cambios» navega con sus opciones y borra el borrador', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    const { drafts } = setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    act(() => navigate('/foro?x=1'));
    expect(window.location.pathname).toBe('/apices/nuevo');
    fireEvent.click(within(aside).getByRole('button', { name: 'Descartar cambios' }));
    expect(window.location.pathname).toBe('/foro');
    expect(window.location.search).toBe('?x=1');
    expect(drafts.get('apice:new')).toBeUndefined();
  });

  it('RF-14 (021) · 14.9: con cambios sin guardar, un enlace de la cabecera también pregunta antes de salir', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    fireEvent.click(screen.getByRole('link', { name: 'Foro' }));
    expect(window.location.pathname).toBe('/apices/nuevo');
    expect(within(aside).getByRole('alert')).toBeTruthy();
    fireEvent.click(within(aside).getByRole('button', { name: 'Descartar cambios' }));
    expect(window.location.pathname).toBe('/foro');
  });

  it('RF-14 (021) · 14.9: sin cambios, un navigate hacia fuera no pregunta', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    setup(PERSON);
    await map();
    await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    act(() => navigate('/foro'));
    expect(window.location.pathname).toBe('/foro');
    expect(screen.queryByText('Tienes cambios sin guardar. ¿Quieres descartarlos?')).toBeNull();
  });

  it('RF-14 (021) · 14.9: con cambios sin guardar, cambiar solo la consulta (filtros, vista) no pregunta', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    act(() => navigate('/apices/nuevo?mio=1', { replace: true, keepFocus: true }));
    expect(window.location.search).toBe('?mio=1');
    expect(within(aside).queryByRole('alert')).toBeNull();
  });

  it('RF-14 (021) · 14.9: al salir del panel el guardián se suelta y navigate vuelve a ser libre', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    const { unmount } = setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    unmount();
    act(() => navigate('/foro'));
    expect(window.location.pathname).toBe('/foro');
  });

  it('RF-14 (021) · 14.9: beforeunload avisa solo mientras hay cambios sin guardar', async () => {
    window.history.replaceState(null, '', '/apices/nuevo');
    const { drafts } = setup(PERSON);
    await map();
    const aside = await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    fireEvent.change(within(aside).getByLabelText('Nombre'), { target: { value: 'Biblioteca' } });
    expect(unload()).toBe(true);
    act(() => drafts.clear('apice:new'));
    expect(unload()).toBe(false);
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

  it('RF-15 (021) · 15.1, D-T25 (021): con Lo mío, en el mapa los filtros atenúan y en la lista se aplican en el navegador', async () => {
    window.history.replaceState(null, '', '/?mio=1&ejes=cobijo');
    const items = [listed(1, { axes: ['cobijo'] }), listed(2, { axes: ['agua'] })];
    const { source, requests } = fakeListSource(2, () => items);
    const { unmount } = setup(PERSON, { source });
    const region = await map();
    await within(region).findByRole('button', building(1, 'cobijo'));
    expect(within(region).getByRole('button', building(2)).getAttribute('data-off')).toBe('true');
    expect(requests[0]).toMatchObject({ audience: 'mine', uid: 'u-ana' });
    unmount();
    window.history.replaceState(null, '', '/?mio=1&ejes=cobijo&vista=lista');
    setup(PERSON, { source });
    expect(await screen.findByRole('heading', { name: 'Ápice 1' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ápice 2' })).toBeNull();
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

  it('RF-14 (021) · 14.7: el panel abierto ocupa el lugar del de Inicio, ya no se amplía y el mapa sigue a la vista y fuera de `inert`', async () => {
    window.history.replaceState(null, '', '/apices/a1');
    setup(VISITOR);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Ápice' });
    expect(aside.closest('.play__panel')).not.toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Inicio' })).toBeNull();
    expect(within(aside).queryByRole('button', { name: /Ampliar|Reducir/ })).toBeNull();
    expect(region.closest('[inert]')).toBeNull();
  });
});

describe('Play · Acciones Comunes', () => {
  const ONE = () => fakeActions([summary('c1', ['a1', 'a2', 'a3'])]);
  const pathLabel = () => screen.findByRole('button', { name: /: Acción c1$/ });

  it('RF-18 (021) · 18.1, D-T33 (021): el mapa dibuja las Acciones Comunes y el contador dice «n Ápices · m Acciones Comunes»', async () => {
    setup(VISITOR, { actionSource: ONE().source });
    await map();
    expect(await pathLabel()).toBeTruthy();
    await waitFor(() => expect(counter().textContent).toBe('3 Ápices · 1 Acción Común'));
  });

  it('RF-20 (021) · 20.1, 20.5: elegir una Acción Común abre su panel en /acciones/:id, con la consulta del mapa', async () => {
    window.history.replaceState(null, '', '/?estado=idea');
    setup(VISITOR, { actionSource: ONE().source });
    await map();
    fireEvent.click(await pathLabel());
    expect(window.location.pathname + window.location.search).toBe('/acciones/c1?estado=idea');
    const aside = await screen.findByRole('complementary', { name: 'Acción Común' });
    expect(await within(aside).findByRole('heading', { level: 1, name: 'Acción c1' })).toBeTruthy();
    expect((await pathLabel()).getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-20 (021) · 20.5: /acciones abre la vista de lista con la sección «Acciones Comunes» antes que los Ápices', async () => {
    window.history.replaceState(null, '', '/acciones');
    setup(VISITOR, { actionSource: ONE().source });
    const section = await screen.findByRole('region', { name: 'Acciones Comunes' });
    expect(within(section).getByRole('link', { name: 'Acción c1' }).getAttribute('href')).toBe('/acciones/c1');
    const apices = screen.getByRole('region', { name: 'Ápices' });
    expect(section.compareDocumentPosition(apices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-5 (010), D-T33 (021): sin Acciones Comunes, la lista lo dice', async () => {
    window.history.replaceState(null, '', '/?vista=lista');
    setup(VISITOR);
    expect(await screen.findByText('Todavía no hay Acciones Comunes.')).toBeTruthy();
  });

  it('RF-6 (010), D-T34 (021): con «Lo mío», pide solo las Acciones Comunes en las que participa y, si no hay, lo dice', async () => {
    window.history.replaceState(null, '', '/?mio=1&vista=lista');
    const { source, lists } = fakeActions();
    setup(PERSON, { actionSource: source });
    expect(await screen.findByText('Todavía no participas en ninguna Acción Común.')).toBeTruthy();
    expect(lists).toContain('u-ana');
    expect(screen.getByRole('link', { name: 'Ver todas las Acciones Comunes' }).getAttribute('href')).toBe('/acciones');
  });

  it('RF-19 (021) · 19.1, D-10 (021): sin sesión no hay «Conectar»; con sesión abre su panel', async () => {
    setup(VISITOR);
    await map();
    expect(screen.queryByRole('link', { name: 'Conectar' })).toBeNull();
    cleanupAndReset();
    setup(PERSON);
    await map();
    fireEvent.click(screen.getByRole('link', { name: 'Conectar' }));
    expect(window.location.pathname).toBe('/acciones/nueva');
    const aside = await screen.findByRole('complementary', { name: 'Conectar' });
    within(aside).getByText('Elige en el mapa los Ápices que conecta esta Acción Común.');
    // La línea de sección dice el tipo y el h1, la tarea: no repiten el mismo texto.
    expect(aside.querySelector('.game-panel__bar .c-rot')!.textContent).toBe('Acción Común');
    within(aside).getByRole('heading', { level: 1, name: 'Conectar' });
  });

  it('RF-19 (021) · 19.1 a 19.3: mientras conecta, elegir un Ápice lo suma (o lo quita) y el panel dice cuántos faltan; con tres, el formulario', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    setup(PERSON);
    const region = await map();
    const aside = await screen.findByRole('complementary', { name: 'Conectar' });
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
    expect(within(aside).getByRole('status').textContent).toBe('Puedes proponerla.');
    expect(within(within(aside).getByRole('list', { name: 'Ápices elegidos' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Ápice 1Quitar',
      'Ápice 3Quitar',
      'Ápice 2Quitar',
    ]);
    within(aside).getByRole('textbox', { name: 'Título' });
    expect(region.querySelector('.game-map__ground [data-draft="true"]')).not.toBeNull();
  });

  it('RF-19 (021) · 19.3, RF-1 (010): «Proponer» manda los ápices en orden y abre el panel de la Acción Común nueva', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    const { calls } = setup(PERSON, { handlers: { proposeCommonAction: () => ({ id: 'c9' }) } });
    const region = await map();
    for (const n of [2, 1, 3]) fireEvent.click(await within(region).findByRole('button', building(n)));
    const aside = await screen.findByRole('complementary', { name: 'Conectar' });
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
    const aside = await screen.findByRole('complementary', { name: 'Conectar' });
    await userEvent.type(within(aside).getByRole('textbox', { name: 'Título' }), 'Agua lluvia');
    await userEvent.type(within(aside).getByRole('textbox', { name: 'Descripción' }), 'Juntemos el agua lluvia del barrio.');
    await userEvent.click(within(aside).getByRole('button', { name: 'Proponer' }));
    expect((await within(aside).findByRole('alert')).textContent).toMatch(/20 Acciones Comunes abiertas/);
    expect((within(aside).getByRole('textbox', { name: 'Título' }) as HTMLInputElement).value).toBe('Agua lluvia');
    expect(within(within(aside).getByRole('list', { name: 'Ápices elegidos' })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('RF-19 (021) · 19.4: pasar de diez avisa el máximo y no suma', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    setup(PERSON, { source: fakeListSource(11).source });
    const region = await map();
    for (let n = 1; n <= 11; n += 1) fireEvent.click(await within(region).findByRole('button', building(n)));
    const aside = await screen.findByRole('complementary', { name: 'Conectar' });
    expect(within(within(aside).getByRole('list', { name: 'Ápices elegidos' })).getAllByRole('listitem')).toHaveLength(10);
    expect(within(aside).getByRole('alert').textContent).toBe('Una Acción Común une como máximo 10 ápices.');
  });

  it('RF-19 (021) · 19.6: «Cancelar» cierra sin guardar nada y el mapa vuelve a abrir fichas', async () => {
    window.history.replaceState(null, '', '/acciones/nueva');
    const { calls } = setup(PERSON);
    const region = await map();
    fireEvent.click(await within(region).findByRole('button', building(1)));
    const aside = await screen.findByRole('complementary', { name: 'Conectar' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Cancelar' }));
    expect(window.location.pathname).toBe('/');
    expect(region.querySelector('.game-map__ground [data-draft="true"]')).toBeNull();
    expect(calls.filter((call) => call.op === 'proposeCommonAction')).toHaveLength(0);
    fireEvent.click(within(region).getByRole('button', building(1)));
    expect(window.location.pathname).toBe('/apices/a1');
  });

  it('RF-19 (021) · 19.5, RNF-1 (021): en la vista de lista, cada tarjeta tiene la casilla «Sumar a la Acción Común»', async () => {
    window.history.replaceState(null, '', '/acciones/nueva?vista=lista');
    setup(PERSON);
    const boxes = await screen.findAllByRole('checkbox', { name: 'Sumar a la Acción Común' });
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[0]!);
    const aside = screen.getByRole('complementary', { name: 'Conectar' });
    expect(within(aside).getByRole('status').textContent).toBe('Faltan 2 ápices.');
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
  });
});


describe('Play · bienvenida', () => {
  const welcome = () => screen.queryByRole('region', { name: 'Bienvenida' });
  beforeEach(() => {
    window.localStorage.removeItem('apicca:bienvenida');
  });

  it('RF-21 (021) · 21.1, 21.2: la primera vez, el panel muestra la invitación sin taparlo: los Ápices siguen a la vista en el mapa', async () => {
    setup(VISITOR);
    const region = await map();
    expect(await screen.findByRole('region', { name: 'Bienvenida' })).toBeTruthy();
    expect(within(region).getByRole('button', building(1))).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Bienvenida' }).closest('.play__panel')).not.toBeNull();
    expect(region.contains(screen.getByRole('region', { name: 'Bienvenida' }))).toBe(false);
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

  it('RF-22 (021) · 22.1, 22.3: «Ver el recorrido» abre el recorrido; sin Acciones Comunes tiene dos pasos', async () => {
    setup(PERSON);
    await map();
    fireEvent.click(within((await screen.findByRole('region', { name: 'Bienvenida' }))).getByRole('button', { name: 'Ver el recorrido' }));
    expect(welcome()!.textContent).toContain('Paso 1 de 2');
    expect(window.localStorage.getItem('apicca:bienvenida')).not.toBeNull();
  });

  it('RF-22 (021) · 22.1: con una Acción Común a la vista, el recorrido tiene tres pasos', async () => {
    setup(VISITOR, { actionSource: fakeActions([summary('c1', ['a1', 'a2', 'a3'])]).source });
    await map();
    await screen.findByRole('button', { name: /: Acción c1$/ });
    fireEvent.click(within((await screen.findByRole('region', { name: 'Bienvenida' }))).getByRole('button', { name: 'Ver el recorrido' }));
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
  /** Espera a que lleguen las Acciones Comunes: el recorrido cuenta con ellos al abrirse. */
  const loaded = async (lists: unknown[]) => {
    await waitFor(() => expect(lists.length).toBeGreaterThan(0));
    await act(async () => {});
  };

  it('RF-3 (024) · 3.1: «Ver el recorrido» lleva el mapa a un Ápice, con su superficie a la vista', async () => {
    setup(PERSON, { source: located() });
    await map();
    expect(level()).toBe('2');
    next('Ver el recorrido');
    await waitFor(() => expect(level()).toBe('0'));
    expect(document.querySelectorAll('.game-map button.game-map__apice').length).toBeGreaterThan(0);
  });

  it('RF-3 (024) · 3.2: «Siguiente» lleva el mapa a una Acción Común que se dibuja, con su rótulo a la vista', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a2'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Ver el recorrido');
    next('Siguiente');
    expect(await screen.findByRole('button', { name: /: Acción c1$/ })).toBeTruthy();
    expect(level()).toBe('0');
  });

  it('RF-3 (024) · 3.2: si la Acción Común une Ápices lejanos, el mapa se aleja hasta que caben', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a3'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Ver el recorrido');
    next('Siguiente');
    expect(Number(level())).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /: Acción c1$/ })).toBeTruthy();
  });

  it('RF-3 (024): el paso de prototipar no mueve el mapa', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a2'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Ver el recorrido');
    next('Siguiente');
    const before = world();
    next('Siguiente');
    expect(screen.getByRole('region', { name: 'Bienvenida' }).textContent).toContain('Paso 3 de 3');
    expect(world()).toBe(before);
  });

  it('RF-3 (024) · 3.2, RF-22 (021) · 22.3: una Acción Común con un solo Ápice a la vista no se dibuja y el recorrido omite ese paso', async () => {
    const actions = fakeActions([summary('c1', ['a1', 'a-oculto'])]);
    setup(PERSON, { source: located(), actionSource: actions.source });
    await map();
    await loaded(actions.lists);
    next('Ver el recorrido');
    expect(screen.getByRole('region', { name: 'Bienvenida' }).textContent).toContain('Paso 1 de 2');
  });

  it('RF-3 (024) · D-12 (024): la tarjeta va en el panel, no sobre el mapa: el encuadre del paso no reserva ningún área', async () => {
    const offsetY = () => Number(/translate\((-?\d+)px, (-?\d+)px\)/.exec(world())![2]);
    const run = async () => {
      window.localStorage.removeItem('apicca:bienvenida');
      setup(PERSON, { source: located() });
      await map();
      next('Ver el recorrido');
      await waitFor(() => expect(level()).toBe('0'));
      return offsetY();
    };
    const free = await run();
    cleanupAndReset();
    const original = HTMLElement.prototype.getBoundingClientRect;
    const box = (left: number, top: number, right: number, bottom: number): DOMRect =>
      ({ left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('game-map')) return box(0, 0, 390, 559);
      if (this.classList.contains('welcome-card')) return box(12, 274, 310, 547);
      return original.call(this);
    });
    expect(await run()).toBe(free);
    vi.restoreAllMocks();
  });

  it('RF-3 (024): «Saltar el recorrido» quita la tarjeta y deja el mapa donde está', async () => {
    setup(PERSON, { source: located() });
    await map();
    next('Ver el recorrido');
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

  it('RF-23 (021) · 23.1, 23.2, 23.4: sin sesión, «Prototipar un Ápice» abre el boceto; su Ápice va al mapa como «Boceto», sin contar ni llamar al servidor', async () => {
    const { calls } = setup(VISITOR);
    await map();
    await waitFor(() => expect(counter().textContent).toBe('3 Ápices'));
    fireEvent.click(screen.getByRole('link', { name: 'Prototipar un Ápice' }));
    expect(window.location.pathname).toBe('/boceto');
    const aside = await screen.findByRole('complementary', { name: 'Boceto' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Agua' }));
    const drawn = await within(await map()).findByRole('button', { name: 'Boceto, agua, Idea' });
    expect(drawn.getAttribute('data-sketch')).toBe('true');
    expect(calls).toHaveLength(0);
    expect(JSON.parse(window.sessionStorage.getItem('apicca:boceto') ?? '{}')).toEqual({ axes: ['agua'], status: 'idea' });
    fireEvent.click(within(aside).getByRole('button', { name: 'Cerrar' }));
    expect(counter().textContent).toBe('3 Ápices');
  });

  it('RF-23 (021) · 23.2: al cerrar el panel, el boceto sale del mapa', async () => {
    window.sessionStorage.setItem('apicca:boceto', JSON.stringify({ axes: ['agua'], status: 'idea' }));
    window.history.replaceState(null, '', '/boceto');
    setup(VISITOR);
    expect(await within(await map()).findByRole('button', { name: 'Boceto, agua, Idea' })).toBeTruthy();
    fireEvent.click(within(await screen.findByRole('complementary', { name: 'Boceto' })).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Boceto, agua, Idea' })).toBeNull());
  });

  it('D-T39 (021): con sesión, /boceto lleva a «Prototipar un Ápice»', async () => {
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

describe('Play · la línea de llamada (E3 · Celda)', () => {
  const llamada = () => document.querySelector('.llamada');
  const startOf = (svg: Element) => svg.querySelector('.llamada__trazo')!.getAttribute('points')!.split(' ')[0];
  const discOf = (svg: Element) => [svg.querySelector('.llamada__disco')!.getAttribute('cx'), svg.querySelector('.llamada__disco')!.getAttribute('cy')];

  it('con 900 px o más, un Ápice elegido muestra su celda grande de 280 y la línea sale 8 px a la derecha de su borde y llega al lugar del Ápice en el mapa', async () => {
    viewport(true);
    layout();
    mapState.anchor = { x: 700, y: 400 };
    window.history.replaceState(null, '', '/apices/a2');
    setup(VISITOR);
    await map();
    const big = await waitFor(() => {
      const found = document.querySelector('.play__ampliacion .celda-grande');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(big.getAttribute('width')).toBe('280');
    await waitFor(() => expect(llamada()).not.toBeNull());
    // Borde derecho de la celda (320) + 8, al medio de su alto (200 + 140) menos el borde del contenedor (60).
    expect(startOf(llamada()!)).toBe('328.0,280.0');
    expect(discOf(llamada()!)).toEqual(['700', '340']);
    expect(llamada()!.getAttribute('aria-hidden')).toBe('true');
  });

  it('la línea se va al cerrar el panel del Ápice', async () => {
    viewport(true);
    layout();
    mapState.anchor = { x: 700, y: 400 };
    window.history.replaceState(null, '', '/apices/a2');
    setup(VISITOR);
    await map();
    await waitFor(() => expect(llamada()).not.toBeNull());
    fireEvent.click(within(await screen.findByRole('complementary', { name: 'Ápice' })).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(llamada()).toBeNull());
  });

  it('con una Acción Común elegida, la línea sale 6 px a la derecha de su Arco', async () => {
    viewport(true);
    layout();
    mapState.anchor = { x: 700, y: 400 };
    window.history.replaceState(null, '', '/acciones/c1');
    const { source } = fakeActions([summary('c1', ['a1', 'a2'])]);
    const { container } = setup(VISITOR, { actionSource: source });
    await map();
    await screen.findByRole('heading', { level: 1, name: 'Acción c1' });
    // El Arco lo dibuja la vista de la Acción Común (`PiezaArco`, clase `pieza-arco`) en la columna.
    expect(container.querySelector('.play__panel .pieza-arco')).not.toBeNull();
    await waitFor(() => expect(llamada()).not.toBeNull());
    expect(startOf(llamada()!)).toBe('326.0,280.0');
    expect(discOf(llamada()!)).toEqual(['700', '340']);
  });

  it('en un teléfono (menos de 900 px) no hay línea, aunque el mapa sepa dónde cae lo elegido; la celda grande sigue en la columna', async () => {
    viewport(false);
    layout();
    mapState.anchor = { x: 700, y: 400 };
    window.history.replaceState(null, '', '/apices/a2');
    setup(VISITOR);
    await map();
    await waitFor(() => expect(document.querySelector('.play__ampliacion .celda-grande')).not.toBeNull());
    expect(llamada()).toBeNull();
  });

  it('si el Ápice elegido no está en la ventana del mapa (sin lugar), no hay línea', async () => {
    viewport(true);
    layout();
    mapState.anchor = null;
    window.history.replaceState(null, '', '/apices/a2');
    setup(VISITOR);
    await map();
    await waitFor(() => expect(document.querySelector('.play__ampliacion .celda-grande')).not.toBeNull());
    expect(llamada()).toBeNull();
  });

  it('sin nada elegido (Inicio) no hay línea; y en un formulario tampoco', async () => {
    viewport(true);
    layout();
    mapState.anchor = { x: 700, y: 400 };
    const { unmount } = setup(VISITOR);
    await map();
    expect(llamada()).toBeNull();
    unmount();
    window.history.replaceState(null, '', '/apices/nuevo');
    setup(PERSON);
    await map();
    await screen.findByRole('complementary', { name: 'Prototipar un Ápice' });
    expect(llamada()).toBeNull();
  });

  it('si la celda sale de lo que la columna deja ver (se desplazó), la línea se esconde', async () => {
    viewport(true);
    mapState.anchor = { x: 700, y: 400 };
    // La celda cae bajo el borde inferior de la columna (60 + 740 = 800).
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains('play__body')) return rect(0, 60, 1200, 740);
      if (this.classList.contains('play__panel')) return rect(24, 60, 344, 740);
      if (this.classList.contains('celda-grande')) return rect(40, 900, 280, 280);
      return realRect.call(this);
    };
    window.history.replaceState(null, '', '/apices/a2');
    setup(VISITOR);
    await map();
    await waitFor(() => expect(document.querySelector('.play__ampliacion .celda-grande')).not.toBeNull());
    expect(llamada()).toBeNull();
  });
});

describe('rowsThatFit', () => {
  it('«E3 · Celda»: dibuja las filas enteras que caben y, si no caben todas, deja el sitio de «N Ápices más»', () => {
    // 26 px por fila: 312 px son 12 filas.
    expect(rowsThatFit(312, 8)).toBe(8);
    expect(rowsThatFit(312, 12)).toBe(12);
    expect(rowsThatFit(312, 19)).toBe(11);
    // Un resto de fila no cuenta.
    expect(rowsThatFit(337, 19)).toBe(11);
    expect(rowsThatFit(338, 19)).toBe(12);
  });

  it('«E3 · Celda»: aunque la ventana sea muy baja quedan tres filas (dos Ápices y «N Ápices más»)', () => {
    expect(rowsThatFit(0, 19)).toBe(2);
    expect(rowsThatFit(30, 19)).toBe(2);
    expect(rowsThatFit(30, 2)).toBe(2);
  });
});
