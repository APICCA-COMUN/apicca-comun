// RF-11 (021) · 11.1, 11.2, RF-12 (021) · 12.1–12.5, RF-14 (021) · 14.1–14.9, RF-15 (021) · 15.1, 15.2, RF-10 (021) ·
// 10.1–10.4, RF-4 (021) · 4.5, RF-9 (021) · 9.1, 9.2, RF-21 (001), RF-15 (004) · 15.1, RF-19 (019) · 19.1–19.3,
// RF-3 (024) (el recorrido de bienvenida mueve el mapa a cada paso), RF-2 (017), D-T21 (021) a D-T25 (021) · La página del mapa: el sitio comienza aquí (`/`). El mapa ocupa la ventana, con la
// barra de juego encima (logo, contador, avisos, tema, cuenta y «Menú»; luego «Construir ápice» o «Unirme», «Lo mío»,
// los filtros, el aviso de propuestas y el cambio de vista). La ficha, «Construir ápice» y «Editar ápice» se abren en un
// panel sobre el mapa (`/apices/:id`, `/apices/nuevo`, `/apices/:id/editar`), y mientras se llena el formulario el mapa
// muestra el edificio tal como quedará. Cerrar un formulario con cambios sin guardar pide confirmación. La lista
// (`?vista=lista`) es la alternativa completa, y si el mapa falla quedan el aviso y la lista (RNF-10 (001)). Los enlaces a
// una ficha, a su edición o a «Construir ápice» que hay en el escenario (las tarjetas, la ficha, el terreno de partida)
// abren su panel con la consulta vigente (RF-10 (021) · 10.3, RNF-1 (021)); con el panel ampliado, el mapa tapado queda
// inerte (RF-14 (021) · 14.7).
// Fase 4 (D-T29 (021) a D-T34 (021)): el mapa dibuja los caminos (las Acciones Comunes que quien mira puede leer) y el
// contador los suma; elegir uno abre su panel (`/acciones/:id`). «Trazar camino» (`/acciones/nueva`) cambia lo que hace
// elegir un edificio o una tarjeta: lo suma al camino o lo quita, y lo elegido vive aquí, no en la dirección. `/acciones`
// abre la lista con la sección «Caminos» primero. Con «Lo mío», solo los caminos en los que la persona participa.
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { COMMON_ACTION_LIMITS, pathsLabel } from '../../shared/domain/commonActions';
import { emptyState, matchesFilters, MAP_LIMIT, NO_FILTERS, type ListFilters } from '../../shared/domain/discovery';
import { tourFocus, tourReserve, tourSteps, type TourStep } from '../../shared/domain/tour';
import { useDrafts } from '../app/drafts';
import { NEW_PREVIEW_ID, draftKeyOf, previewItems, type PanelState } from '../app/draftPreview';
import { filtersFromSearch, filtersToSearch } from '../app/listFilters';
import { Link, navigate, useRoute, useSearch, type CurrentRoute } from '../app/router';
import { useSession } from '../app/session';
import { useApiceListing, type ApiceListing } from '../app/useApiceListing';
import { usePageTitle } from '../app/usePageTitle';
import { SKETCH_ID, readSketch, saveSketch, sketchItem, type Sketch } from '../app/sketch';
import { markWelcomeSeen, welcomeSeen } from '../app/welcome';
import { AmendmentNotice } from '../components/AmendmentNotice';
import { ApiceList } from '../components/ApiceList';
import { CommonActionList } from '../components/CommonActionList';
import { CommonActionView } from '../components/CommonActionView';
import { EmptyState } from '../components/EmptyState';
import { Filters } from '../components/Filters';
import { GameMenu } from '../components/GameMenu';
import { GamePanel } from '../components/GamePanel';
import { Logo } from '../components/Logo';
import { MapBoundary } from '../components/MapBoundary';
import { NoticeBell } from '../components/NoticeBell';
import { SessionEntry } from '../components/SessionEntry';
import { SketchPanel } from '../components/SketchPanel';
import { StartingTerrain } from '../components/StartingTerrain';
import { ThemeToggle } from '../components/ThemeToggle';
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
import { GameMap, type MapPath } from '../map/GameMap';
import { ApiceEdit } from './ApiceEdit';
import { ApiceNew } from './ApiceNew';
import { ApiceView } from './ApiceView';
import './Play.css';

interface Props {
  source?: ListSource;
  /** Para la ficha y la edición del panel; sin él, los de Firebase. */
  apiceSource?: ApiceSource;
  client?: OpClient<ApiOps>;
  noticeSource?: NoticeSource;
  /** Avisos de la campana (RF-4 (012)); sin él, los de Firebase. */
  noticesSource?: NoticesSource;
  /** Los caminos (D-T29 (021)); sin él, los de Firebase. */
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

const PANEL_LABEL = { view: 'Ápice', edit: 'Editar ápice', new: 'Construir ápice', action: 'Camino', trace: 'Trazar camino', sketch: 'Boceto' } as const;

/** Id del camino en borrador de «Trazar camino»; ninguna Acción Común lo usa. */
const DRAFT_PATH_ID = '__trazo__';
const TOO_MANY = `Un camino une como máximo ${COMMON_ACTION_LIMITS.apicesMax} ápices.`;
/** Una tarjeta de la lista o un ápice del panel de un camino. */
const APICE_HREF = /^\/apices\/([^/?#]+)$/;

/** Los enlaces que se abren como panel: la ficha, su edición, «Construir ápice», un camino y «Trazar camino». */
const PANEL_HREF = /^\/(?:apices\/[^/?#]+(?:\/editar)?|acciones\/[^/?#]+)$/;

const isPlainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** El título del documento cuando no hay panel; con panel, lo pone la ficha o el formulario (RF-2 (017)). */
function MapTitle() {
  usePageTitle({ contentTitle: 'Jugar' });
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState<AmendmentNoticeData>(NO_NOTICE);
  const [pending, setPending] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  /** El panel se abrió desde la página: su título recibe el foco (RF-14 (021) · 14.8). */
  const [focusPanel, setFocusPanel] = useState(false);
  /** El panel cubre todo el mapa (RF-14 (021) · 14.7). */
  const [covered, setCovered] = useState(false);
  /** Quien tenía el foco al abrir el panel, y a quién volver si ya no está (D-T23 (021)). */
  const opener = useRef<HTMLElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const filtersId = useId();
  /** Los caminos; `null` mientras cargan (D-T33 (021)). */
  const [actions, setActions] = useState<CommonActionSummary[] | null>(null);
  const [actionsRefresh, setActionsRefresh] = useState(0);
  /** Lo elegido en «Trazar camino», en orden (D-T31 (021)). */
  const [chosen, setChosen] = useState<string[]>([]);
  const [traceNotice, setTraceNotice] = useState<string | null>(null);
  /** RF-21 (021) · 21.1, 21.3: la invitación, hasta que en este navegador se elija «Jugar» o «Cerrar». */
  const [welcome, setWelcome] = useState(() => !welcomeSeen());
  /** Lo que el paso del recorrido a la vista pide mirar; cada paso nuevo trae un token nuevo (RF-3 (024)). */
  const [tourView, setTourView] = useState<{ token: number; ids: readonly string[]; reserve: () => number } | null>(null);
  /** RF-23 (021), D-T39 (021): el boceto del visitante, que vive solo en este navegador. */
  const [sketch, setSketch] = useState<Sketch>(readSketch);

  const mine = person && query.mine;
  const uid = session.status === 'person' ? session.uid : null;
  // `/acciones` es la lista con los caminos primero (RF-20 (021) · 20.5).
  const view: View = route.page === 'actions' ? 'lista' : query.view;
  const listing = useApiceListing({
    audience: mine ? 'mine' : person ? 'member' : 'visitor',
    // «Lo mío» no admite filtros en el servidor: se aplican aquí (D-T25 (021)).
    filters: mine ? NO_FILTERS : query.filters,
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

  // RF-18 (021) · 18.1, RF-6 (010): los caminos que quien mira puede leer; con «Lo mío», solo en los que participa. Si no
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

  // Al salir de «Trazar camino», lo elegido se descarta (RF-19 (021) · 19.6).
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

  const shown: ApiceListing = mine ? withBrowserFilters(listing, query.filters) : listing;

  // En la vista de mapa se piden tandas hasta llegar al tope del mapa (D-T21 (021)).
  useEffect(() => {
    if (view !== 'mapa' || listing.status !== 'ready' || !listing.hasMore || listing.loadingMore) return;
    if (listing.items.length >= MAP_LIMIT) return;
    listing.loadMore();
  }, [view, listing.status, listing.hasMore, listing.loadingMore, listing.items.length]);

  // Al cerrar el panel, el foco vuelve a quien lo abrió o, si ya no está, al edificio o al mapa (RF-14 (021) · 14.8).
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

  // D-T39 (021): con sesión no hay boceto: `/boceto` lleva a «Construir ápice».
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

  /** RF-19 (021) · 19.1, 19.4: suma o quita un ápice del camino; pasar del tope avisa y no suma. */
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
    navigate(to, { keepFocus: true });
  };

  /** Cambia de panel o lo cierra; con cambios sin guardar, primero pregunta (RF-14 (021) · 14.9). */
  const guarded = (to: string) => {
    if (dirty) setPending(to);
    else leaveTo(to);
  };

  const leaveTo = (to: string) => {
    if (to.startsWith('/?') || to === '/') {
      const pressed = stage.current?.querySelector<HTMLElement>('.game-map button[aria-pressed="true"]') ?? null;
      const back = opener.current;
      restore.current = back !== null && back.isConnected && !back.closest('.game-panel') ? back : (pressed ?? stage.current?.querySelector<HTMLElement>('.game-map') ?? null);
      opener.current = null;
      navigate(to, { keepFocus: true });
      return;
    }
    go(to);
  };

  const discard = () => {
    const to = pending;
    if (draftKey !== null) drafts.clear(draftKey);
    setPending(null);
    if (to !== null) leaveTo(to);
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
    // Mientras se traza, una tarjeta de la lista suma su ápice en vez de abrir la ficha (D-T31 (021)).
    const apice = APICE_HREF.exec(href);
    if (tracing && apice !== null && link.closest('.game-panel') === null) {
      toggleChosen(apice[1] ?? '');
      return;
    }
    if (href === route.path) return;
    if (panel === null) link.focus({ preventScroll: true });
    guarded(`${href}${searchOf(query)}`);
  };

  /** RF-23 (021) · 23.1: sin sesión, «Construir ápice» abre el boceto. */
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

  // RF-23 (021) · 23.1, 23.2: mientras el panel del boceto está abierto, su edificio va en el mapa y se encuadra; no cuenta.
  const sketchBuilding = panel?.kind === 'sketch' ? sketchItem(sketch) : null;
  const items = sketchBuilding === null ? previewItems([...shown.items], panel, draftText) : [...shown.items, sketchBuilding];
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
  const mapPaths: MapPath[] = [
    ...(actions ?? []).map((action) => ({ id: action.id, title: action.title, closed: action.status === 'cerrada', apiceIds: action.apiceIds })),
    ...(tracing ? [{ id: DRAFT_PATH_ID, title: '', closed: false, apiceIds: chosen, draft: true }] : []),
  ];
  const namesById = new Map(shown.items.map((apice) => [apice.id, apice.name]));
  const switchView = (next: View) => updateQuery({ ...query, view: next });
  const clearFilters = () => updateQuery({ ...query, filters: NO_FILTERS });

  const list = (
    <div className="play__list">
      <CommonActionList actions={actions} mine={mine} />
      <ApiceList
        listing={shown}
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
  const pathsCount = actions === null || actions.length === 0 ? '' : ` · ${pathsLabel(actions.length)}`;
  // RF-22 (021) · 22.3: el recorrido omite el camino si ninguno se dibuja (menos de dos de sus ápices a la vista).
  // RF-3 (024), D-T3 (024): a qué ápices lleva el mapa cada paso; sin camino que se dibuje en el nivel cercano, el paso se omite.
  const tourPaths = useMemo(() => (actions ?? []).map((action) => ({ id: action.id, apiceIds: action.apiceIds })), [actions]);
  const focusOfTour = useMemo(() => tourFocus({ apices: shown.items, paths: tourPaths }), [shown.items, tourPaths]);
  const drawnPaths = focusOfTour.camino.length > 0 ? 1 : 0;
  /**
   * D-12 (024), D-T4b (024): cuánto del borde de abajo del lienzo tapa la tarjeta del recorrido, medido cuando el mapa se
   * mueve (con la tarjeta ya pintada). Sin tarjeta, o con la tarjeta a un lado del centro, es 0: fuera del recorrido, y a
   * 1280 px, el encuadre no cambia.
   */
  const tourCardReserve = (): number => {
    const map = stage.current?.querySelector('.game-map')?.getBoundingClientRect();
    const card = stage.current?.querySelector('.welcome-card')?.getBoundingClientRect();
    if (map === undefined || map.width === 0 || map.height === 0 || card === undefined) return 0;
    return tourReserve(
      { width: map.width, height: map.height },
      { left: card.left - map.left, right: card.right - map.left, top: card.top - map.top },
    );
  };
  /** Un paso del recorrido a la vista: el mapa va a su ápice o a su camino; el de construir no mueve nada. */
  const onTourStep = (step: TourStep) => {
    let ids: readonly string[] = [];
    if (step.key === 'apice') ids = focusOfTour.apice;
    if (step.key === 'camino') {
      const box = stage.current?.querySelector('.game-map')?.getBoundingClientRect();
      const viewport = box === undefined || box.width === 0 ? undefined : { width: box.width, height: box.height };
      ids = tourFocus({ apices: shown.items, paths: tourPaths, ...(viewport === undefined ? {} : { viewport }) }).camino;
    }
    if (ids.length > 0) setTourView((current) => ({ token: (current?.token ?? 0) + 1, ids, reserve: tourCardReserve }));
  };
  // RF-21 (021) · 21.2, D-T37 (021): solo sobre el mapa con ápices, sin panel abierto; el terreno de partida ya invita (D-T40 (021)).
  const showWelcome = welcome && panel === null && onMap && shown.status === 'ready';

  return (
    <div className="play">
      {panel === null && (
        <>
          <MapTitle />
          <h1 className="visually-hidden">Mapa de ápices</h1>
        </>
      )}
      <div className="play__hud">
        <div className="play__row">
          <Logo />
          <p role="status" className="block play__count">
            <svg className="play__count-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {shown.status === 'loading' ? 'Cargando ápices…' : `${shown.items.length} ${shown.items.length === 1 ? 'ápice' : 'ápices'}${pathsCount}`}
          </p>
          <div className="play__tools">
            {person && <NoticeBell {...(noticesSource === undefined ? {} : { source: noticesSource })} {...(client === undefined ? {} : { client })} />}
            <ThemeToggle />
            <SessionEntry />
            <GameMenu />
          </div>
        </div>
        <div className="play__row play__row--actions">
          {person ? (
            <Link href="/apices/nuevo" className={`block ${panel === null && !starting ? 'action-primary' : 'action-secondary'}`} onClick={build}>
              Construir ápice
            </Link>
          ) : (
            session.status === 'visitor' && (
              <>
                <Link href="/solicitar" className={`block ${starting ? 'action-secondary' : 'action-primary'}`}>
                  Unirme
                </Link>
                <Link href="/boceto" className="block action-secondary" aria-current={panel?.kind === 'sketch' ? 'page' : undefined} onClick={draw}>
                  Construir ápice
                </Link>
              </>
            )
          )}
          {person && (
            <Link href="/acciones/nueva" className="block action-secondary" aria-current={tracing ? 'page' : undefined} onClick={trace}>
              Trazar camino
            </Link>
          )}
          {person && (
            <button type="button" className="block action-secondary" aria-pressed={query.mine} onClick={() => updateQuery({ ...query, mine: !query.mine })}>
              Lo mío
            </button>
          )}
          <button
            type="button"
            className="block action-secondary play__filters-toggle"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filtros
          </button>
          <div id={filtersId} className="play__filters" data-open={filtersOpen ? 'true' : 'false'}>
            <Filters filters={query.filters} onChange={(filters) => updateQuery({ ...query, filters })} />
          </div>
          <button type="button" className="block action-secondary play__view" onClick={() => switchView(view === 'mapa' ? 'lista' : 'mapa')}>
            {view === 'mapa' ? 'Ver como lista' : 'Ver en el mapa'}
          </button>
          <AmendmentNotice openCount={notice.count} nextClosesAt={notice.nextCloseAt} />
        </div>
      </div>
      <div ref={stage} className="play__stage" onClickCapture={openFromStage}>
        <div className="play__board" inert={covered}>
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
              fill
            />
          </MapBoundary>
          ) : (
            list
          )}
        </div>
        {showWelcome && (
          <WelcomeCard steps={tourSteps({ apices: shown.items.length, paths: drawnPaths, signedIn: person })} onSeen={markWelcomeSeen} onClose={() => setWelcome(false)} onStep={onTourStep} />
        )}
        {panel !== null && (
          <GamePanel
            key={`${panel.kind}:${'id' in panel ? panel.id : ''}`}
            label={PANEL_LABEL[panel.kind]}
            autoFocus={focusPanel}
            onExpand={setCovered}
            onClose={() => guarded(`/${searchOf(query)}`)}
            notice={
              pending !== null && (
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
              )
            }
          >
            {panel.kind === 'view' && (
              <ApiceView id={panel.id} {...(apiceSource === undefined ? {} : { source: apiceSource })} {...(client === undefined ? {} : { client })} />
            )}
            {panel.kind === 'edit' && (
              <ApiceEdit id={panel.id} {...(apiceSource === undefined ? {} : { source: apiceSource })} {...(client === undefined ? {} : { client })} />
            )}
            {panel.kind === 'new' && <ApiceNew {...(client === undefined ? {} : { client })} />}
            {panel.kind === 'action' && (
              <CommonActionView id={panel.id} source={actionSource} {...(client === undefined ? {} : { client })} onChange={() => setActionsRefresh((value) => value + 1)} />
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
