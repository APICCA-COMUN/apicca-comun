// RF-11 (021) · 11.1, 11.2, RF-12 (021) · 12.1–12.5, RF-14 (021) · 14.1–14.9, RF-15 (021) · 15.1, 15.2, RF-10 (021) ·
// 10.1–10.4, RF-4 (021) · 4.5, RF-9 (021) · 9.1, 9.2, RF-21 (001), RF-15 (004) · 15.1, RF-19 (019) · 19.1–19.3,
// RF-3 (024) (el recorrido de bienvenida mueve el mapa a cada paso), RF-2 (017), D-T21 (021) a D-T25 (021) · La página del
// mapa: el sitio comienza aquí (`/`).
// «E3 · Celda», composición de Inicio (24-11-2026, Propuesta del asistente): sin paneles ni bordes. La cabecera del sitio
// arriba (`SiteHeader`) y debajo dos zonas: a la izquierda una columna de lectura (margen y ancho que se encogen entre
// 900 y 1280 px) y, a su derecha, el mapa con la leyenda-control al pie (`LeyendaControl`: ejes, Etapa y nivel). La columna
// lleva arriba la línea «Ápices» con su cuenta y las filas (`ApiceRows`, hasta 12 y «N Ápices más»), «Lo mío» y la vista como
// enlaces de texto, y abajo el título, la entradilla, «Prototipar un Ápice» (rótulo grande) y «Conectar». Filtrar es atenuar:
// en el mapa los filtros no van a la consulta, los Ápices que no pasan se apagan (`dimmedIds`) en el mapa y en las filas; en la
// lista sí van al servidor. La ficha, «Prototipar un Ápice», «Editar ápice», el boceto, «Conectar», una Acción Común y la
// bienvenida se abren en esa misma columna, en lugar de su contenido, con «Cerrar» (`/apices/:id`, `/apices/nuevo`,
// `/apices/:id/editar`), y mientras se llena el formulario el mapa muestra el Ápice tal como quedará. Con un Ápice o una Acción
// Común elegidos, una línea de llamada (`Llamada`) une la celda grande o el Arco de la columna con su lugar en el mapa (solo
// con 900 px o más). Cerrar un formulario con cambios sin guardar pide confirmación, y lo mismo cualquier `navigate` hacia
// fuera de la página (cabecera, logo, menú, enlaces) mediante el guardián de navegación del enrutador; cerrar la pestaña o
// recargar activa el aviso nativo del navegador. Atrás no se intercepta: el borrador sigue en memoria y se restaura. La lista (`?vista=lista`) es la
// alternativa completa, y si el mapa falla quedan el aviso y la lista (RNF-10 (001)). Los enlaces a una ficha, a su edición o
// a «Prototipar un Ápice» que hay en la página abren su panel con la consulta vigente (RF-10 (021) · 10.3, RNF-1 (021)); en un
// teléfono van el mapa arriba, luego la leyenda-control y debajo la columna.
// Fase 4 (D-T29 (021) a D-T34 (021)): el mapa dibuja las Acciones Comunes que quien mira puede leer y el contador las suma;
// elegir una abre su panel (`/acciones/:id`). «Conectar» (`/acciones/nueva`) cambia lo que hace elegir un Ápice o una
// tarjeta: lo suma a la Acción Común o lo quita, y lo elegido vive aquí, no en la dirección. `/acciones` abre la lista con
// la sección «Acciones Comunes» primero. Con «Lo mío», solo las Acciones Comunes en las que la persona participa.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { COMMON_ACTION_LIMITS } from '../../shared/domain/commonActions';
import { AXES, type ApiceStatus, type Axis } from '../../shared/domain/apice';
import { dimmedIds, emptyState, hasActiveFilters, matchesFilters, MAP_LIMIT, NO_FILTERS, type ListFilters } from '../../shared/domain/discovery';
import type { MapLevel } from '../../shared/domain/hexmap';
import { tourSteps, type TourStep } from '../../shared/domain/tour';
import { useDrafts } from '../app/drafts';
import { NEW_PREVIEW_ID, draftKeyOf, previewItems, type PanelState } from '../app/draftPreview';
import { filtersFromSearch, filtersToSearch, splitFilters } from '../app/listFilters';
import { Link, navigate, pathOf, setNavigationGuard, useRoute, useSearch, type CurrentRoute, type NavigateOptions } from '../app/router';
import { useSession } from '../app/session';
import { useApiceListing, type ApiceListing } from '../app/useApiceListing';
import { usePageTitle } from '../app/usePageTitle';
import { SKETCH_ID, readSketch, saveSketch, sketchItem, type Sketch } from '../app/sketch';
import { markWelcomeSeen, welcomeSeen } from '../app/welcome';
import { AmendmentNotice } from '../components/AmendmentNotice';
import { ApiceList, ApiceRows } from '../components/ApiceList';
import { CommonActionList } from '../components/CommonActionList';
import { CommonActionView } from '../components/CommonActionView';
import { EmptyState } from '../components/EmptyState';
import { CeldaGrande } from '../components/CeldaGrande';
import { GamePanel } from '../components/GamePanel';
import { Icono } from '../components/Glifo';
import { LeyendaControl } from '../components/LeyendaControl';
import { Llamada } from '../components/Llamada';
import { MapBoundary } from '../components/MapBoundary';
import { SiteHeader } from '../components/SiteHeader';
import { SketchPanel } from '../components/SketchPanel';
import { StartingTerrain } from '../components/StartingTerrain';
import { TracePanel } from '../components/TracePanel';
import { WelcomeCard } from '../components/WelcomeCard';
import type { ApiOps, OpClient } from '../data/api';
import { firestoreListSource, type ApiceSource, type ListSource } from '../data/apices';
import { firestoreCommonActionSource, type CommonActionSource, type CommonActionSummary } from '../data/commonActions';
import {
  firestoreNoticeSource,
  NO_NOTICE,
  type AmendmentNotice as AmendmentNoticeData,
  type NoticeSource,
} from '../data/constitution/notice';
import type { NoticesSource } from '../data/notices';
import type { MapPath } from '../map/GameMap';
import { ApiceEdit } from './ApiceEdit';
import { ApiceNew } from './ApiceNew';
import { ApiceView } from './ApiceView';
import './Play.css';

// El mapa y el cálculo del recorrido traen el teselado (`h3-js`, unos 540 KB): se cargan a pedido y la entrada no los pesa.
const GameMap = lazy(() => import('../map/GameMap').then((module) => ({ default: module.GameMap })));
type TourFocusFn = typeof import('../../shared/domain/tourFocus').tourFocus;

interface Props {
  source?: ListSource;
  /** Para la ficha y la edición del panel; sin él, los de Firebase. */
  apiceSource?: ApiceSource;
  client?: OpClient<ApiOps>;
  noticeSource?: NoticeSource;
  /** Avisos de la campana (RF-4 (012)); sin él, los de Firebase. */
  noticesSource?: NoticesSource;
  /** Las Acciones Comunes (D-T29 (021)); sin él, las de Firebase. */
  actionSource?: CommonActionSource;
}

type View = 'mapa' | 'lista';

/** Lo que la barra guarda en la dirección: filtros, «Lo mío» y la vista (D-T21 (021)). */
interface Query {
  filters: ListFilters;
  mine: boolean;
  view: View;
}

function queryFromSearch(search: string): Query {
  const params = new URLSearchParams(search);
  return { filters: filtersFromSearch(search), mine: params.get('mio') === '1', view: params.get('vista') === 'lista' ? 'lista' : 'mapa' };
}

function searchOf({ filters, mine, view }: Query): string {
  const params = new URLSearchParams(filtersToSearch(filters));
  if (mine) params.set('mio', '1');
  if (view === 'lista') params.set('vista', 'lista');
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

function panelOf(route: CurrentRoute): PanelState {
  const id = route.params.id ?? '';
  if (route.page === 'apiceView') return { kind: 'view', id };
  if (route.page === 'apiceEdit') return { kind: 'edit', id };
  if (route.page === 'apiceNew') return { kind: 'new' };
  if (route.page === 'actionView') return { kind: 'action', id };
  if (route.page === 'actionNew') return { kind: 'trace' };
  if (route.page === 'sketch') return { kind: 'sketch' };
  return null;
}

const PANEL_LABEL = { view: 'Ápice', edit: 'Editar ápice', new: 'Prototipar un Ápice', action: 'Acción Común', trace: 'Conectar', sketch: 'Boceto' } as const;

/** La línea de sección del panel dice el TIPO; el h1 de dentro dice el nombre o la tarea (nunca lo mismo dos veces). */
const PANEL_SECTION = { view: 'Ápice', edit: 'Ápice', new: 'Ápice', action: 'Acción Común', trace: 'Acción Común', sketch: 'Boceto' } as const;

const HOME_TITLE = 'API para crear y conectar Acciones Comunes';
const HOME_LEAD = 'Apoyo mutuo, commoning y economías recíprocas no monetarias.';

/** Id de la Acción Común en borrador de «Conectar»; ninguna lo usa. */
const DRAFT_PATH_ID = '__trazo__';
const TOO_MANY = `Una Acción Común une como máximo ${COMMON_ACTION_LIMITS.apicesMax} ápices.`;
/** Una fila o tarjeta de la lista, o un Ápice del panel de una Acción Común. */
const APICE_HREF = /^\/apices\/([^/?#]+)$/;

/** Los enlaces que se abren como panel: la ficha, su edición y una Acción Común. */
const PANEL_HREF = /^\/(?:apices\/[^/?#]+(?:\/editar)?|acciones\/[^/?#]+)$/;

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** «19 Ápices · 4 Acciones Comunes · 5 zonas»: lo que no hay no se cuenta. */
function countText(apices: readonly { location?: { zone?: { cell: string } } | null }[], actions: number): string {
  const zones = new Set(apices.flatMap((apice) => (apice.location?.zone === undefined ? [] : [apice.location.zone.cell])));
  return [plural(apices.length, 'Ápice', 'Ápices'), ...(actions > 0 ? [plural(actions, 'Acción Común', 'Acciones Comunes')] : []), ...(zones.size > 0 ? [plural(zones.size, 'zona', 'zonas')] : [])].join(' · ');
}

const isPlainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** La columna y el mapa lado a lado, y con ello la línea de llamada: desde 900 px. Sin `matchMedia` (pruebas), se cuenta como angosto. */
const WIDE_QUERY = '(min-width: 900px)';
const subscribeWide = (notify: () => void): (() => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const wideNow = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(WIDE_QUERY).matches;

/** Hasta cuántas filas de Ápices dibuja la columna cuando no se mide (teléfono, pruebas); el resto se resume en «N Ápices más». */
const ROWS_LIMIT = 12;
/** El ritmo de una fila de Ápices (`.c-fila`, 26 px) y las que se dibujan como mínimo aunque la ventana sea muy baja. */
const ROW_HEIGHT = 26;
const ROWS_MIN = 3;

/**
 * Cuántas filas de Ápices dibujar en `height` px de lista para que la columna no se desborde: las que quepan, en filas enteras;
 * si no caben todas, la última de las que caben es «N Ápices más», así que se dibuja una menos.
 */
export function rowsThatFit(height: number, total: number): number {
  const rows = Math.max(ROWS_MIN, Math.floor(height / ROW_HEIGHT));
  return total <= rows ? total : rows - 1;
}

/** Separación entre el borde de la celda grande (o del Arco) y donde arranca la línea de llamada, en píxeles. */
const LLAMADA_GAP = { apice: 8, accion: 6 } as const;

/** A dónde iba la persona cuando se le preguntó por sus cambios sin guardar; `outside` guarda las opciones de un `navigate` de fuera. */
interface PendingLeave {
  to: string;
  outside?: NavigateOptions;
}

interface LlamadaEnds {
  desde: { x: number; y: number };
  hasta: { x: number; y: number };
}

const tenth = (value: number): number => Math.round(value * 10) / 10;
const sameEnds = (a: LlamadaEnds | null, b: LlamadaEnds | null): boolean =>
  a === b || (a !== null && b !== null && a.desde.x === b.desde.x && a.desde.y === b.desde.y && a.hasta.x === b.hasta.x && a.hasta.y === b.hasta.y);

/** Solo lectores de pantalla: la cuenta completa («19 Ápices · 4 Acciones Comunes · 5 zonas») que anuncia el cambio. */
const SR_ONLY = 'play__sr';

/** El título del documento cuando no hay panel; con panel, lo pone la ficha o el formulario (RF-2 (017)). */
function MapTitle() {
  usePageTitle({ contentTitle: 'Ápices' });
  return null;
}

export function Play(props: Props) {
  const session = useSession();
  if (session.status === 'loading') return <p>Cargando…</p>;
  return <Board {...props} />;
}

function Board({
  source = firestoreListSource,
  apiceSource,
  client,
  noticeSource = firestoreNoticeSource,
  noticesSource,
  actionSource = firestoreCommonActionSource,
}: Props) {
  const session = useSession();
  const route = useRoute();
  const drafts = useDrafts();
  const person = session.status === 'person';
  // La consulta vive en la dirección: Atrás, «Lo mío» desde la cuenta y los enlaces la cambian (D-T25 (021)).
  const search = useSearch();
  const query = useMemo(() => queryFromSearch(search), [search]);
  const [notice, setNotice] = useState<AmendmentNoticeData>(NO_NOTICE);
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const [refresh, setRefresh] = useState(0);
  /** El panel se abrió desde la página: su título recibe el foco (RF-14 (021) · 14.8). */
  const [focusPanel, setFocusPanel] = useState(false);
  /** Quien tenía el foco al abrir el panel, y a quién volver si ya no está (D-T23 (021)). */
  const opener = useRef<HTMLElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** El contenedor posicionado donde se dibuja la línea de llamada, y la columna de la izquierda (de donde sale). */
  const body = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  /** La lista de filas de Ápices de Inicio y el alto que la columna le deja (`null` mientras no se mide: ahí vale `ROWS_LIMIT`). */
  const rowsList = useRef<HTMLDivElement>(null);
  const [rowsRoom, setRowsRoom] = useState<number | null>(null);
  /** Las Acciones Comunes; `null` mientras cargan (D-T33 (021)). */
  const [actions, setActions] = useState<CommonActionSummary[] | null>(null);
  const [actionsRefresh, setActionsRefresh] = useState(0);
  /** Lo elegido en «Conectar», en orden (D-T31 (021)). */
  const [chosen, setChosen] = useState<string[]>([]);
  const [traceNotice, setTraceNotice] = useState<string | null>(null);
  /** RF-21 (021) · 21.1, 21.3: la invitación, hasta que en este navegador se elija «Ver el recorrido» o «Cerrar». */
  const [welcome, setWelcome] = useState(() => !welcomeSeen());
  /** Lo que el paso del recorrido a la vista pide mirar; cada paso nuevo trae un token nuevo (RF-3 (024)). */
  const [tourView, setTourView] = useState<{ token: number; ids: readonly string[]; reserve: () => number } | null>(null);
  /** RF-23 (021), D-T39 (021): el boceto del visitante, que vive solo en este navegador. */
  const [sketch, setSketch] = useState<Sketch>(readSketch);
  /** El nivel del mapa que la persona eligió en la leyenda (o con la rueda y el teclado); `null` hasta entonces, y manda el encuadre inicial. */
  const [level, setLevel] = useState<MapLevel | null>(null);
  /** El nivel que el mapa dice tener (`data-level`), para que la leyenda lo marque aunque nadie lo haya elegido todavía. */
  const [seenLevel, setSeenLevel] = useState<MapLevel>(0);
  /** Dónde cae en la ventana lo elegido en el mapa (`onAnchor`) y los dos extremos de la línea de llamada, ya en el contenedor. */
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [ends, setEnds] = useState<LlamadaEnds | null>(null);
  const wide = useSyncExternalStore(subscribeWide, wideNow);

  const mine = person && query.mine;
  const uid = session.status === 'person' ? session.uid : null;
  // `/acciones` es la lista con las Acciones Comunes primero (RF-20 (021) · 20.5).
  const view: View = route.page === 'actions' ? 'lista' : query.view;
  // Filtrar es atenuar (mapa): ahí los filtros no van a la consulta, se apagan los Ápices que no pasan. En la lista van al servidor.
  const split = useMemo(() => splitFilters(query.filters, view), [query.filters, view]);
  const listing = useApiceListing({
    audience: mine ? 'mine' : person ? 'member' : 'visitor',
    // «Lo mío» no admite filtros en el servidor: en la lista se aplican aquí (D-T25 (021)); en el mapa se atenúan.
    filters: mine ? NO_FILTERS : split.server,
    ...(mine ? { uid: session.uid } : {}),
    source,
    refresh,
  });

  const panel = panelOf(route);
  const draftKey = draftKeyOf(panel);
  const draftText = useSyncExternalStore(drafts.subscribe, () => (draftKey === null ? undefined : drafts.get(draftKey)));
  const dirty = draftText !== undefined;

  // Al pasar de un formulario a la ficha (se creó o se guardó), el mapa vuelve a pedir los ápices.
  const previous = useRef(panel?.kind ?? null);
  useEffect(() => {
    const before = previous.current;
    previous.current = panel?.kind ?? null;
    if ((before === 'new' || before === 'edit') && panel?.kind === 'view') {
      setRefresh((value) => value + 1);
      // El formulario ya no está: el foco va al título de la ficha (RF-14 (021) · 14.8).
      setFocusPanel(true);
    }
  }, [panel?.kind]);

  useEffect(() => setPending(null), [route.path]);

  // Guardián de navegación: mientras el panel tiene un borrador, un `navigate` hacia otra ruta (cabecera, logo, menú, enlaces)
  // pregunta antes. Lee el borrador en vivo, no `dirty`: quien guarda lo limpia y navega en el mismo instante, antes de que
  // este componente se vuelva a pintar. Lo que no cambia de ruta (consulta del mapa) y lo que ya confirmó pasan.
  useEffect(() => {
    if (draftKey === null) return;
    return setNavigationGuard((to, options) => {
      if (drafts.get(draftKey) === undefined) return true;
      if (pathOf(to) === pathOf(window.location.href)) return true;
      setPending({ to, outside: options });
      return false;
    });
  }, [drafts, draftKey]);

  // Cerrar la pestaña o recargar pierde el borrador (vive en memoria): con cambios, el navegador pide confirmar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // RF-18 (021) · 18.1, RF-6 (010): las Acciones Comunes que quien mira puede leer; con «Lo mío», solo en las que participa. Si no
  // se pueden leer, el mapa sigue sin ellos.
  useEffect(() => {
    let active = true;
    const owner = mine ? uid : null;
    Promise.resolve()
      .then(() => actionSource.list(owner))
      .then(
        (items) => {
          if (active) setActions(items);
        },
        () => {
          if (active) setActions([]);
        },
      );
    return () => {
      active = false;
    };
  }, [actionSource, mine, uid, actionsRefresh]);

  // Al salir de «Conectar», lo elegido se descarta (RF-19 (021) · 19.6).
  const tracing = panel?.kind === 'trace';
  useEffect(() => {
    if (tracing) return;
    setChosen([]);
    setTraceNotice(null);
  }, [tracing]);

  useEffect(() => {
    if (!person) return;
    let active = true;
    // Si el aviso no se puede leer, el mapa sigue sin él (RF-15 (004) · 15.1).
    noticeSource.fetchNotice('member').then(
      (data) => {
        if (active) setNotice(data);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [person, noticeSource]);

  const shown: ApiceListing = mine && view === 'lista' ? withBrowserFilters(listing, query.filters) : listing;
  /** Los Ápices que el filtro apaga en el mapa y en las filas; con la lista, ninguno (ahí el servidor ya filtró). */
  const dim = useMemo(() => dimmedIds(shown.items, split.dim), [shown.items, split.dim]);
  /** Lo que la Acción Común y su lista saben de cada Ápice para dibujar sus celdas. */
  const apiceInfo = useMemo(() => new Map(shown.items.map((apice) => [apice.id, { axes: apice.axes, status: apice.status, name: apice.name }])), [shown.items]);

  // En la vista de mapa se piden tandas hasta llegar al tope del mapa (D-T21 (021)).
  useEffect(() => {
    if (view !== 'mapa' || listing.status !== 'ready' || !listing.hasMore || listing.loadingMore) return;
    if (listing.items.length >= MAP_LIMIT) return;
    listing.loadMore();
  }, [view, listing.status, listing.hasMore, listing.loadingMore, listing.items.length]);

  // Al cerrar el panel, el foco vuelve a quien lo abrió o, si ya no está, al Ápice o al mapa (RF-14 (021) · 14.8).
  useEffect(() => {
    if (panel !== null || restore.current === null) return;
    const target = restore.current;
    restore.current = null;
    if (target.isConnected) target.focus();
    else stage.current?.querySelector<HTMLElement>('.game-map')?.focus();
  }, [panel]);

  // RF-21 (021) · 21.4, D-T37 (021): «Ver la bienvenida» del menú llega con `?bienvenida=1`; se muestra y se quita de la dirección.
  useEffect(() => {
    if (new URLSearchParams(search).get('bienvenida') !== '1') return;
    setWelcome(true);
    navigate(`${route.path}${searchOf(query)}`, { replace: true, keepFocus: true });
  }, [search]);

  // D-T39 (021): con sesión no hay boceto: `/boceto` lleva a «Prototipar un Ápice».
  useEffect(() => {
    if (route.page === 'sketch' && person) navigate('/apices/nuevo', { replace: true, keepFocus: true });
  }, [route.page, person]);

  const changeSketch = (next: Sketch) => {
    setSketch(next);
    saveSketch(next);
  };

  const updateQuery = (next: Query) => {
    // Desde `/acciones`, cambiar la consulta vuelve al mapa con ella (la vista de `/acciones` es siempre la lista).
    navigate(`${route.page === 'actions' ? '/' : route.path}${searchOf(next)}`, { replace: true, keepFocus: true });
  };

  /** RF-19 (021) · 19.1, 19.4: suma o quita un Ápice de la Acción Común; pasar del tope avisa y no suma. */
  const toggleChosen = (id: string) => {
    if (chosen.includes(id)) {
      setChosen(chosen.filter((candidate) => candidate !== id));
      setTraceNotice(null);
    } else if (chosen.length >= COMMON_ACTION_LIMITS.apicesMax) {
      setTraceNotice(TOO_MANY);
    } else {
      setChosen([...chosen, id]);
      setTraceNotice(null);
    }
  };

  const go = (to: string) => {
    const opening = panel === null && to !== '/';
    if (opening) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFocusPanel(true);
    navigate(to, { keepFocus: true, unguarded: true });
  };

  /** Cambia de panel o lo cierra; con cambios sin guardar, primero pregunta (RF-14 (021) · 14.9). */
  const guarded = (to: string) => {
    if (dirty) setPending({ to });
    else leaveTo(to);
  };

  const leaveTo = (to: string) => {
    if (to.startsWith('/?') || to === '/') {
      const pressed = stage.current?.querySelector<HTMLElement>('.game-map button[aria-pressed="true"]') ?? null;
      const back = opener.current;
      restore.current = back !== null && back.isConnected && !back.closest('.game-panel') ? back : (pressed ?? stage.current?.querySelector<HTMLElement>('.game-map') ?? null);
      opener.current = null;
      navigate(to, { keepFocus: true, unguarded: true });
      return;
    }
    go(to);
  };

  const discard = () => {
    const leaving = pending;
    if (draftKey !== null) drafts.clear(draftKey);
    setPending(null);
    if (leaving === null) return;
    // Lo que llegó de fuera (cabecera, logo, menú, enlaces) sigue con sus propias opciones; lo del panel, con las del mapa.
    if (leaving.outside !== undefined) navigate(leaving.to, { ...leaving.outside, unguarded: true });
    else leaveTo(leaving.to);
  };

  const select = (id: string) => {
    if (id === NEW_PREVIEW_ID || id === SKETCH_ID) return;
    if (tracing) {
      toggleChosen(id);
      return;
    }
    if (panel?.kind === 'view' && panel.id === id) return;
    guarded(`/apices/${id}${searchOf(query)}`);
  };

  /** En fase de captura: gana a `Link`, que ya no navega porque el clic llega con `defaultPrevented`. */
  const openFromStage = (event: MouseEvent<HTMLDivElement>) => {
    if (!isPlainClick(event) || !(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    const href = link?.getAttribute('href') ?? '';
    if (link === null || !PANEL_HREF.test(href) || (link.target !== '' && link.target !== '_self')) return;
    event.preventDefault();
    // Mientras se conecta, una tarjeta de la lista suma su Ápice en vez de abrir la ficha (D-T31 (021)).
    const apice = APICE_HREF.exec(href);
    if (tracing && apice !== null && link.closest('.game-panel') === null) {
      toggleChosen(apice[1] ?? '');
      return;
    }
    if (href === route.path) return;
    if (panel === null) link.focus({ preventScroll: true });
    guarded(`${href}${searchOf(query)}`);
  };

  /** RF-23 (021) · 23.1: sin sesión, «Prototipar un Ápice» abre el boceto. */
  const draw = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    if (panel?.kind !== 'sketch') guarded(`/boceto${searchOf(query)}`);
  };

  const build = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    if (panel?.kind !== 'new') guarded('/apices/nuevo');
  };

  const trace = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    if (!tracing) guarded(`/acciones/nueva${searchOf(query)}`);
  };

  const selectPath = (id: string) => {
    if (panel?.kind === 'action' && panel.id === id) return;
    guarded(`/acciones/${id}${searchOf(query)}`);
  };

  // RF-23 (021) · 23.1, 23.2: mientras el panel del boceto está abierto, su Ápice va en el mapa y se encuadra; no cuenta.
  const sketchBuilding = panel?.kind === 'sketch' ? sketchItem(sketch) : null;
  const panelId = panel !== null && 'id' in panel ? panel.id : '';
  // El mismo arreglo mientras nada cambie: el mapa no rehace su dibujo cada vez que esta página se vuelve a pintar (por ejemplo
  // al moverse la línea de llamada).
  const items = useMemo(
    () => (sketchBuilding === null ? previewItems([...shown.items], panel, draftText) : [...shown.items, sketchBuilding]),
    // `panel` se rehace en cada pintada; lo que cuenta es su clase y su id.
    [shown.items, panel?.kind, panelId, draftText, sketchBuilding],
  );
  const selectedId =
    panel === null || panel.kind === 'trace' || panel.kind === 'action'
      ? null
      : panel.kind === 'sketch'
        ? sketchBuilding === null
          ? null
          : SKETCH_ID
        : panel.kind === 'new'
          ? NEW_PREVIEW_ID
          : panel.id;
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);
  const mapPaths = useMemo<MapPath[]>(
    () => [
      ...(actions ?? []).map((action) => ({ id: action.id, title: action.title, closed: action.status === 'cerrada', apiceIds: action.apiceIds, axis: action.axis })),
      ...(tracing ? [{ id: DRAFT_PATH_ID, title: '', closed: false, apiceIds: chosen, draft: true, axis: shown.items.find((apice) => apice.id === chosen[0])?.axes[0] ?? null }] : []),
    ],
    [actions, tracing, chosen, shown.items],
  );
  const namesById = new Map(shown.items.map((apice) => [apice.id, apice.name]));
  const switchView = (next: View) => updateQuery({ ...query, view: next });
  const clearFilters = () => updateQuery({ ...query, filters: NO_FILTERS });
  /** La leyenda enciende o apaga un eje del filtro (en el orden de siempre) o elige la Etapa; el estado vive en la dirección. */
  const toggleAxis = (axis: Axis) =>
    updateQuery({ ...query, filters: { ...query.filters, axes: AXES.filter((candidate) => (candidate === axis) !== query.filters.axes.includes(candidate)) } });
  const chooseStatus = (status: ApiceStatus | null) => updateQuery({ ...query, filters: { ...query.filters, status } });

  // La lista que queda si el mapa falla filtra aquí, en el navegador: sin mapa no hay a quién atenuar.
  const listed = view === 'mapa' && hasActiveFilters(query.filters) ? withBrowserFilters(shown, query.filters) : shown;
  const list = (
    <div className="play__list">
      <CommonActionList actions={actions} mine={mine} apiceInfo={apiceInfo} />
      <ApiceList
        listing={listed}
        titulo
        selection={tracing ? { chosen, onToggle: toggleChosen } : undefined}
        empty={(kind) =>
          mine && kind === 'no-apices' ? (
            <StartingTerrain phrase="Todavía no tienes ápices en el terreno." action={{ label: 'Propón tu primer ápice', href: '/apices/nuevo' }} />
          ) : (
            <EmptyState kind={kind} canCreate={person} onClearFilters={clearFilters} />
          )
        }
      />
    </div>
  );
  // Con el terreno de partida, su acción es la única azul (RF-19 (019) · 19.4).
  const starting = shown.empty === 'no-apices';
  const onMap = view === 'mapa' && shown.status !== 'error' && shown.empty === null;
  // RF-22 (021) · 22.3: el recorrido omite la Acción Común si ninguna se dibuja (menos de dos de sus Ápices a la vista).
  // RF-3 (024), D-T3 (024): a qué Ápices lleva el mapa cada paso; sin Acción Común que se dibuje en el nivel cercano, el paso se omite.
  const tourPaths = useMemo(() => (actions ?? []).map((action) => ({ id: action.id, apiceIds: action.apiceIds })), [actions]);
  const [tourFocusFn, setTourFocusFn] = useState<TourFocusFn | null>(null);
  const focusOfTour = useMemo(
    () => (tourFocusFn === null ? { apice: [], camino: [] } : tourFocusFn({ apices: shown.items, paths: tourPaths })),
    [tourFocusFn, shown.items, tourPaths],
  );
  const drawnPaths = focusOfTour.camino.length > 0 ? 1 : 0;
  /** Un paso del recorrido a la vista: el mapa va a su Ápice o a su Acción Común; el de prototipar no mueve nada. */
  // La bienvenida ya no tapa el borde del mapa: va en el panel de la derecha, así que el encuadre no deja reserva.
  const noReserve = (): number => 0;
  const onTourStep = (step: TourStep) => {
    let ids: readonly string[] = [];
    if (step.key === 'apice') ids = focusOfTour.apice;
    if (step.key === 'camino' && tourFocusFn !== null) {
      const box = stage.current?.querySelector('.game-map')?.getBoundingClientRect();
      const viewport = box === undefined || box.width === 0 ? undefined : { width: box.width, height: box.height };
      ids = tourFocusFn({ apices: shown.items, paths: tourPaths, ...(viewport === undefined ? {} : { viewport }) }).camino;
    }
    if (ids.length > 0) setTourView((current) => ({ token: (current?.token ?? 0) + 1, ids, reserve: noReserve }));
  };
  // RF-21 (021) · 21.2, D-T37 (021): solo con el mapa con Ápices y sin panel abierto; el terreno de partida ya invita (D-T40 (021)).
  const showWelcome = welcome && panel === null && onMap && shown.status === 'ready';
  // El cálculo del recorrido se carga cuando el mapa se va a dibujar, a la par del propio mapa.
  useEffect(() => {
    if (!onMap || tourFocusFn !== null) return undefined;
    let current = true;
    import('../../shared/domain/tourFocus').then(
      (module) => {
        if (current) setTourFocusFn(() => module.tourFocus);
      },
      () => undefined, // sin él, el recorrido sigue sin llevar el mapa a ningún paso
    );
    return () => {
      current = false;
    };
  }, [onMap, tourFocusFn]);

  // El mapa dice su nivel en `data-level`: la leyenda lo marca aunque nadie lo haya elegido todavía (el encuadre inicial lo calcula él).
  useEffect(() => {
    const box = stage.current;
    if (!onMap || box === null || typeof MutationObserver === 'undefined') return undefined;
    let watched: Element | null = null;
    let attributes: MutationObserver | null = null;
    const read = () => {
      const value = watched?.getAttribute('data-level');
      if (value === '0' || value === '1' || value === '2') setSeenLevel(Number(value) as MapLevel);
    };
    const attach = () => {
      const map = box.querySelector('.game-map');
      if (map === watched) return;
      attributes?.disconnect();
      watched = map;
      if (map === null) return;
      attributes = new MutationObserver(read);
      attributes.observe(map, { attributes: true, attributeFilter: ['data-level'] });
      read();
    };
    // El mapa llega cuando termina de cargar: se atiende hasta que aparezca (`attach` es barato si no hay cambio).
    const arrival = new MutationObserver(attach);
    arrival.observe(box, { childList: true, subtree: true });
    attach();
    return () => {
      arrival.disconnect();
      attributes?.disconnect();
    };
  }, [onMap]);

  // En Inicio, con la columna y el mapa lado a lado, la lista de Ápices ocupa el espacio que sobra entre la línea «Ápices» y el pie
  // (título y acciones) y se recorta en filas enteras: la columna no se desplaza en el estado base.
  const baseHome = panel === null && onMap && !showWelcome;
  useLayoutEffect(() => {
    const list = rowsList.current;
    if (!wide || !baseHome || list === null || typeof ResizeObserver === 'undefined') {
      setRowsRoom(null);
      return undefined;
    }
    const read = () => {
      const style = window.getComputedStyle(list);
      const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
      const room = list.clientHeight - padding;
      setRowsRoom((current) => (current === room ? current : room));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(list);
    return () => observer.disconnect();
  }, [wide, baseHome]);
  const rowsLimit = rowsRoom === null ? ROWS_LIMIT : rowsThatFit(rowsRoom, shown.items.length);

  // La línea de llamada (E3 · Celda): une la celda grande del Ápice (o el Arco de la Acción Común) de la columna con su lugar en el
  // mapa. Solo con la columna y el mapa lado a lado, y mientras el mapa sepa dónde cae lo elegido.
  const callKind: 'apice' | 'accion' | null = !wide || !onMap || anchor === null ? null : panel?.kind === 'view' ? 'apice' : panel?.kind === 'action' ? 'accion' : null;
  const measureCall = useCallback(() => {
    const box = body.current;
    const col = column.current;
    let next: LlamadaEnds | null = null;
    const target = callKind === null || col === null ? null : col.querySelector(callKind === 'apice' ? '.celda-grande' : '.pieza-arco');
    if (target !== null && box !== null && col !== null && anchor !== null && callKind !== null) {
      const mark = target.getBoundingClientRect();
      const visible = col.getBoundingClientRect();
      const origin = box.getBoundingClientRect();
      const y = mark.top + mark.height / 2;
      // Fuera de lo que la columna deja ver (se desplazó), la línea no se dibuja.
      if (mark.width > 0 && y >= visible.top && y <= visible.bottom) {
        next = {
          desde: { x: tenth(mark.right + LLAMADA_GAP[callKind] - origin.left), y: tenth(y - origin.top) },
          hasta: { x: tenth(anchor.x - origin.left), y: tenth(anchor.y - origin.top) },
        };
      }
    }
    setEnds((current) => (sameEnds(current, next) ? current : next));
  }, [callKind, anchor]);
  // Tras cada pintada (la elección o el ancho cambiaron) y cuando la columna cambia por dentro o por fuera: una vez por cuadro.
  useLayoutEffect(() => {
    measureCall();
  });
  useEffect(() => {
    const col = column.current;
    if (callKind === null || col === null) return undefined;
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measureCall();
      });
    };
    col.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const content = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
    content?.observe(col, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    const size = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    size?.observe(col);
    return () => {
      col.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      content?.disconnect();
      size?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [callKind, measureCall]);

  const actionsCount = actions === null ? 0 : actions.length;
  const viewing = panel?.kind === 'view';
  // La cuenta completa, para quien lee con lector de pantalla; a la vista va solo el número en la línea «Ápices».
  const count = (
    <p aria-live="polite" className={`play__count ${SR_ONLY}`}>
      {shown.status === 'loading' ? 'Cargando Ápices…' : countText(shown.items, actionsCount)}
    </p>
  );
  const intro = (
    <div className="play__intro">
      <h1 className="c-titulo">{HOME_TITLE}</h1>
      <p className="c-cuerpo c-suave">{HOME_LEAD}</p>
    </div>
  );
  // «Prototipar un Ápice» es el rótulo grande (la única mancha de tinta fuera del mapa); con el terreno de partida, su acción es
  // la única principal (RF-19 (019) · 19.4) y esta pasa a enlace de texto.
  const prototype = (href: string, onClick: (event: MouseEvent<HTMLAnchorElement>) => void, current?: 'page') =>
    starting ? (
      <Link href={href} className="c-enlace" aria-current={current} onClick={onClick}>
        Prototipar un Ápice
      </Link>
    ) : (
      <Link href={href} className="c-barra action-primary" aria-current={current} onClick={onClick}>
        <span>Prototipar un Ápice</span>
        <Icono name="avanzar" size={14} />
      </Link>
    );
  const actionButtons = (
    <div className="play__actions">
      {person ? (
        <>
          {prototype('/apices/nuevo', build)}
          <Link href="/acciones/nueva" className="c-enlace" onClick={trace}>
            Conectar
          </Link>
        </>
      ) : (
        session.status === 'visitor' && (
          <>
            {prototype('/boceto', draw, panel?.kind === 'sketch' ? 'page' : undefined)}
            <Link href="/solicitar" className="c-enlace">
              Unirme
            </Link>
          </>
        )
      )}
    </div>
  );
  // Las filas de Ápices bajo la línea «Ápices» con su cuenta; solo con el mapa. Atenuar no quita: la fila apagada sigue. En la vista
  // de lista (y en el terreno de partida o si el mapa falla) los Ápices ya están en el área principal, con su propia línea
  // «Ápices»: la columna no repite la sección, que quedaría vacía.
  const rows = onMap ? (
    <div className="play__rows">
      <div className="c-seccion">
        <span className="c-rot">Ápices</span>
        <span className="c-rot c-suave" aria-hidden="true">
          {shown.status === 'ready' ? shown.items.length : ''}
        </span>
      </div>
      <div ref={rowsList} className="play__rows-list">
        <ApiceRows apices={shown.items} currentId={viewing ? panel.id : null} dimmed={dim} limit={panel === null ? rowsLimit : ROWS_LIMIT} onMore={() => switchView('lista')} />
      </div>
    </div>
  ) : null;
  // «Lo mío» y la vista son enlaces de texto bajo las filas: tratan de la lista de arriba (de quién y cómo se ve), no del mapa.
  const tools = (
    <div className="play__tools">
      {person && (
        <button type="button" className="c-enlace" aria-pressed={query.mine} onClick={() => updateQuery({ ...query, mine: !query.mine })}>
          Lo mío
        </button>
      )}
      <button type="button" className="c-enlace play__view" onClick={() => switchView(view === 'mapa' ? 'lista' : 'mapa')}>
        {view === 'mapa' ? 'Ver como lista' : 'Ver en el mapa'}
      </button>
    </div>
  );
  const foot = (
    <div className="play__foot">
      {intro}
      {actionButtons}
    </div>
  );
  const home = (
    <aside className={`play__home${baseHome ? ' play__home--base' : onMap ? '' : ' play__home--lista'}`} aria-label="Inicio">
      <MapTitle />
      {showWelcome ? (
        <div className="play__foot">
          {intro}
          <WelcomeCard
            steps={tourSteps({ apices: shown.items.length, paths: drawnPaths, signedIn: person })}
            onSeen={markWelcomeSeen}
            onClose={() => setWelcome(false)}
            onStep={onTourStep}
          />
        </div>
      ) : (
        <>
          {/* Sin mapa, la columna no tiene una lista que la llene: el título y las acciones abren arriba y «Ver en el mapa» sigue. */}
          {!onMap && foot}
          <div className="play__top">
            {count}
            {rows}
            {tools}
            <AmendmentNotice openCount={notice.count} nextClosesAt={notice.nextCloseAt} />
          </div>
          {onMap && foot}
        </>
      )}
    </aside>
  );
  const closePanel = () => guarded(`/${searchOf(query)}`);
  const discardNotice = pending !== null && (
    <div role="alert" className="block play__discard">
      <p>Tienes cambios sin guardar. ¿Quieres descartarlos?</p>
      <div className="play__discard-actions">
        <button type="button" className="block action-secondary" onClick={discard}>
          Descartar cambios
        </button>
        <button type="button" className="block action-secondary" onClick={() => setPending(null)}>
          Seguir editando
        </button>
      </div>
    </div>
  );
  const panelKey = panel === null ? '' : `${panel.kind}:${'id' in panel ? panel.id : ''}`;
  // Elegir es ampliar: la celda grande del Ápice bajo su línea de ejes (la llamada la une con el mapa).
  const viewed = panel?.kind === 'view' ? shown.items.find((apice) => apice.id === panel.id) : undefined;
  const ampliacion =
    viewed === undefined ? undefined : (
      <div className="play__ampliacion">
        <CeldaGrande axes={viewed.axes} status={viewed.status} ancho={280} titulo={viewed.name} />
      </div>
    );
  const withFicha =
    panel?.kind === 'view' ? (
      <div className="play__home play__home--ficha">
        <MapTitle />
        <div className="play__top">
          <GamePanel key={panelKey} label={PANEL_LABEL.view} autoFocus={focusPanel} embedded onClose={closePanel} notice={discardNotice} noticeSignal={pending}>
            <ApiceView
              id={panel.id}
              {...(apiceSource === undefined ? {} : { source: apiceSource })}
              {...(client === undefined ? {} : { client })}
              {...(ampliacion === undefined ? {} : { ampliacion })}
            />
          </GamePanel>
          {count}
          {rows}
        </div>
        <div className="play__foot">{actionButtons}</div>
      </div>
    ) : null;

  return (
    <div className="play">
      <SiteHeader {...(noticesSource === undefined ? {} : { noticesSource })} {...(client === undefined ? {} : { client })} />
      <div ref={body} className="play__body" onClickCapture={openFromStage}>
        <div ref={stage} className="play__stage">
          <div className="play__surface">
            {starting ? (
              <div className="play__list">
                {mine ? (
                  <StartingTerrain phrase="Todavía no tienes ápices en el terreno." action={{ label: 'Propón tu primer ápice', href: '/apices/nuevo' }} />
                ) : (
                  <StartingTerrain
                    phrase="Aún no hay ápices en el terreno."
                    action={person ? { label: 'Propón el primer ápice', href: '/apices/nuevo' } : { label: 'Pide tu inscripción', href: '/solicitar' }}
                  />
                )}
              </div>
            ) : onMap ? (
              <MapBoundary fallback={list}>
                <Suspense fallback={<p role="status" className="block">Cargando el mapa…</p>}>
                  <GameMap
                    items={items}
                    sketchId={sketchBuilding === null ? null : SKETCH_ID}
                    selectedId={selectedId}
                    chosenIds={chosenSet}
                    onSelect={select}
                    paths={mapPaths}
                    selectedPathId={panel?.kind === 'action' ? panel.id : null}
                    onSelectPath={selectPath}
                    focus={tourView}
                    onList={() => switchView('lista')}
                    dimmedIds={dim}
                    onAnchor={setAnchor}
                    {...(level === null ? {} : { level })}
                    onLevelChange={setLevel}
                    hideZoomControls
                    startClose={tracing}
                    fill
                  />
                </Suspense>
              </MapBoundary>
            ) : (
              list
            )}
          </div>
          {!starting && (
            <div className={`play__legend${onMap ? '' : ' play__legend--lista'}`}>
              <LeyendaControl
                ejes={query.filters.axes}
                onEje={toggleAxis}
                etapa={query.filters.status}
                onEtapa={chooseStatus}
                {...(onMap ? { nivel: level ?? seenLevel, onNivel: setLevel } : {})}
                {...(hasActiveFilters(query.filters) ? { onQuitar: clearFilters } : {})}
              />
            </div>
          )}
        </div>
        <div ref={column} className="play__panel">
          {panel === null ? (
            home
          ) : withFicha !== null ? (
            withFicha
          ) : (
            <GamePanel key={panelKey} label={PANEL_LABEL[panel.kind]} section={PANEL_SECTION[panel.kind]} autoFocus={focusPanel} onClose={closePanel} notice={discardNotice} noticeSignal={pending}>
              {panel.kind === 'edit' && (
                <ApiceEdit id={panel.id} {...(apiceSource === undefined ? {} : { source: apiceSource })} {...(client === undefined ? {} : { client })} />
              )}
              {panel.kind === 'new' && <ApiceNew {...(client === undefined ? {} : { client })} />}
              {panel.kind === 'action' && (
                <CommonActionView
                  id={panel.id}
                  source={actionSource}
                  apiceInfo={apiceInfo}
                  {...(client === undefined ? {} : { client })}
                  onChange={() => setActionsRefresh((value) => value + 1)}
                />
              )}
              {panel.kind === 'sketch' && !person && <SketchPanel sketch={sketch} onChange={changeSketch} />}
              {panel.kind === 'trace' && (
                <TracePanel
                  chosen={chosen.map((id) => ({ id, name: namesById.get(id) ?? id }))}
                  notice={traceNotice}
                  onRemove={toggleChosen}
                  onCancel={() => leaveTo(`/${searchOf(query)}`)}
                  onProposed={(id) => {
                    setChosen([]);
                    setActionsRefresh((value) => value + 1);
                    go(`/acciones/${id}${searchOf(query)}`);
                  }}
                  {...(client === undefined ? {} : { client })}
                />
              )}
            </GamePanel>
          )}
        </div>
        {ends !== null && <Llamada desde={ends.desde} hasta={ends.hasta} />}
      </div>
    </div>
  );
}

/** «Lo mío» con los filtros aplicados en el navegador (D-T25 (021)). */
function withBrowserFilters(listing: ApiceListing, filters: ListFilters): ApiceListing {
  const items = listing.items.filter((apice) => matchesFilters(apice, filters));
  return {
    ...listing,
    items,
    empty: listing.status === 'ready' ? (listing.items.length === 0 ? 'no-apices' : emptyState({ count: items.length, filters })) : null,
  };
}
