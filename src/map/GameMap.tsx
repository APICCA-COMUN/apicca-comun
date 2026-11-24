// RF-4 (021) · 4.1 a 4.4, RF-6 (021) · 6.1 a 6.3, RF-7 (021) · 7.1 a 7.5, RF-8 (021) · 8.1 a 8.6, RF-9 (021) · 9.1, 9.2,
// D-T17 (021) · Lienzo del mapa propio. Dibuja lo que calcula `shared/domain/hexmap.ts`: las placas de las manzanas en
// una capa SVG decorativa y, encima, un botón por edificio, por grupo y por «+n». Sin teselas, sin imágenes y sin
// ninguna petición a la red; los colores salen de los tokens (GameMap.css).
// - Tres niveles (barrio, ciudad y región). Al abrir encuadra todo; el encuadre se recalcula solo cuando cambia el
//   conjunto de ápices. Elegir un grupo acerca hasta sus manzanas y deja el foco en uno de sus edificios.
// - Se mueve arrastrando, con los botones y con el teclado: con el foco en el lienzo, las flechas lo desplazan y + y -
//   cambian el nivel; con el foco en un edificio, las flechas llevan al más cercano en esa dirección y el mapa lo sigue.
//   Un solo edificio está en el orden del tabulador. La rueda solo cambia el nivel con Ctrl o ⌘ (`wheel.ts`).
// - Los ápices sin ubicación van en un terreno aparte, con su rótulo, y se eligen como los demás.
// - Con `fill` ocupa todo el alto de la página del mapa, sin borde ni radio (RF-11 (021) · 11.2, D-T22 (021)).
// - RF-18 (021) · 18.1 a 18.8, D-T30 (021): cada camino (una Acción Común) es un trazo grueso bajo los edificios que pasa
//   por sus ápices a la vista (`mapPaths.ts`), con un rótulo que lo nombra y abre su panel; el cerrado va punteado y su
//   rótulo dice «Cerrado». El rótulo entra en el foco itinerante. El camino en borrador de «Trazar camino» no lleva rótulo.
// - RF-3 (024), D-T4 (024), D-12 (024): el recorrido de bienvenida mueve el encuadre hasta lo que nombra cada paso, sin
//   que lo tape su tarjeta. RF-4 (024), D-T6 (024): abrir un camino por su dirección encuadra sus ápices.
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react';
import { APICE_STAGE_LABEL, hasNeeds } from '../../shared/domain/apice';
import { MAP_LIMIT } from '../../shared/domain/discovery';
import {
  GROUP_RADIUS,
  LEVEL_SCALE,
  SPOT_HEIGHT,
  SPOT_WIDTH,
  frameFit,
  frameMap,
  frameOn,
  layoutMap,
  mapNeighbor,
  scaleBar,
  type MapBlock,
  type MapFrame,
  type MapGroup,
  type MapLayout,
  type MapLevel,
  type MapSpot,
  type MapViewport,
} from '../../shared/domain/hexmap';
import { pathLabelPoint, pathPoints, svgPoints } from '../../shared/domain/mapPaths';
import { Building } from '../components/Building';
import { Dialog } from '../components/Dialog';
import type { ListedApice } from '../data/apices';
import { bindModifierWheelZoom } from './wheel';
import './GameMap.css';

/** Un camino que dibujar: una Acción Común, o el borrador de «Trazar camino» (`draft`). */
export interface MapPath {
  id: string;
  title: string;
  closed: boolean;
  /** Los ápices que une, en el orden del camino. */
  apiceIds: readonly string[];
  draft?: boolean;
}

interface Props {
  items: readonly ListedApice[];
  /** Los caminos (RF-18 (021)). */
  paths?: readonly MapPath[];
  /** El camino cuyo panel está abierto. */
  selectedPathId?: string | null;
  onSelectPath?(id: string): void;
  /** Los ápices elegidos en «Trazar camino»: se marcan como el elegido (D-T31 (021)). */
  chosenIds?: ReadonlySet<string>;
  selectedId: string | null;
  onSelect(id: string): void;
  /** Pasa a la vista de lista: se ofrece cuando hay más ápices que el tope del mapa (RF-7 (021) · 7.5). */
  onList?(): void;
  /** Ocupa todo el alto de quien lo contiene, sin borde: la página del mapa (D-T22 (021)). */
  fill?: boolean;
  /** El edificio del boceto del visitante: se distingue por su forma (RF-23 (021) · 23.2, D-T39 (021)). */
  sketchId?: string | null;
  /**
   * El recorrido pide mirar estos ápices: cada `token` nuevo mueve el mapa una vez (RF-3 (024)). `reserve` dice, al mover,
   * cuántos píxeles del borde de abajo ocupa la tarjeta del recorrido, para que no tape lo que se mira (D-12 (024)).
   */
  focus?: { token: number; ids: readonly string[]; reserve?: () => number } | null;
}

/** Ventana de respaldo, para cuando el lienzo todavía no se puede medir. */
const FALLBACK_VIEWPORT: MapViewport = { width: 960, height: 560 };
/** Lo que desplaza una flecha con el foco en el lienzo. */
const PAN_STEP = 80;
/** Menos que esto es un clic, no un arrastre. */
const DRAG_THRESHOLD = 4;
/** El control «+n» va sobre el borde de la placa, arriba a la derecha. */
const MORE_OFFSET = 132;
const MORE_RADIUS = 24;
/** Un lugar más cerca que esto del borde de la ventana se trae al centro al recibir el foco. */
const FOCUS_MARGIN = 60;
/** Un gesto de pellizco manda muchos eventos de rueda: los repetidos en el mismo sentido se ignoran este tiempo. */
const WHEEL_PAUSE_MS = 300;

const moreId = (key: string): string => `more:${key}`;
const groupId = (key: string): string => `group:${key}`;
const pathId = (id: string): string => `path:${id}`;
const pathText = (path: MapPath): string => (path.closed ? `${path.title} · Cerrado` : path.title);

const apiceLabel = (apice: ListedApice): string => `${apice.name}, ${APICE_STAGE_LABEL[apice.status]}`;
const countText = (count: number): string => (count === 1 ? '1 ápice' : `${count} ápices`);

const clampLevel = (level: number): MapLevel => (level <= 0 ? 0 : level >= 2 ? 2 : 1);

/** El foco llegó con el teclado. Donde el navegador no lo sabe decir, se toma como que sí. */
function focusFromKeyboard(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

const NO_PATHS: readonly MapPath[] = [];

export function GameMap({ items, paths = NO_PATHS, selectedPathId = null, onSelectPath, chosenIds, selectedId, onSelect, onList, fill = false, sketchId = null, focus = null }: Props) {
  const ref = useRef<HTMLElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const titleId = useId();
  const [viewport, setViewport] = useState<MapViewport>(FALLBACK_VIEWPORT);
  const [custom, setCustom] = useState<{ key: string; frame: MapFrame } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [moreKey, setMoreKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Arrastre en curso: dónde empezó el puntero y dónde estaba el mapa. */
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  /** El clic que cierra un arrastre no elige nada (RF-8 (021) · 8.1). */
  const suppressClick = useRef(false);
  /** Ápices entre los que cae el foco al terminar de acercar un grupo (RF-7 (021) · 7.3). */
  const pendingFocus = useRef<ReadonlySet<string> | null>(null);

  const capped = items.length > MAP_LIMIT;
  const shown = useMemo(() => items.slice(0, MAP_LIMIT), [items]);
  const byId = useMemo(() => new Map(shown.map((apice) => [apice.id, apice])), [shown]);
  const idsKey = useMemo(() => shown.map((apice) => apice.id).join('\n'), [shown]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = element;
      if (width === 0 || height === 0) return;
      setViewport((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // RF-7 (021) · 7.4: el encuadre inicial; lo que la persona mueve vale mientras el conjunto de ápices sea el mismo.
  const home = useMemo(() => frameMap(shown, viewport), [shown, viewport]);
  const frame = custom !== null && custom.key === idsKey ? custom.frame : home;
  const layout = useMemo(() => layoutMap(shown, frame.level, frame.scale), [shown, frame.level, frame.scale]);

  const move = (next: (current: MapFrame) => MapFrame) =>
    setCustom((current) => ({ key: idsKey, frame: next(current !== null && current.key === idsKey ? current.frame : home) }));

  /** `step` 1 aleja y -1 acerca; el centro de la ventana se conserva (RF-7 (021) · 7.1). */
  const zoom = (step: 1 | -1) =>
    move((current) => {
      const level = clampLevel(current.level + step);
      if (level === current.level) return current;
      // El nivel más lejano usa la escala del encuadre inicial cuando hizo falta alejarlo para que cupiera todo.
      const scale = level === 2 && home.level === 2 ? home.scale : LEVEL_SCALE[level];
      return { level, scale, x: (current.x * scale) / current.scale, y: (current.y * scale) / current.scale };
    });

  const latest = useRef({ zoom });
  latest.current = { zoom };

  // RF-8 (021) · 8.6: la rueda sin tecla modificadora desplaza la página.
  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    let last = { step: 0, at: -Infinity };
    const wheelZoom = (step: 1 | -1) => {
      const now = performance.now();
      if (last.step === step && now - last.at < WHEEL_PAUSE_MS) return;
      last = { step, at: now };
      latest.current.zoom(step);
    };
    return bindModifierWheelZoom(element, { zoomIn: () => wheelZoom(-1), zoomOut: () => wheelZoom(1) });
  }, []);

  /** Los caminos con al menos dos puntos a la vista, y dónde va su rótulo (RF-18 (021) · 18.7). */
  const drawn = useMemo(
    () =>
      paths.flatMap((path) => {
        const points = pathPoints(layout, path.apiceIds);
        const label = pathLabelPoint(points);
        return label === null ? [] : [{ path, points, label }];
      }),
    [paths, layout],
  );

  /** Todo lo que se puede enfocar en el nivel a la vista, para moverse con las flechas (RF-8 (021) · 8.4). */
  const spots = useMemo(() => {
    const all: MapSpot[] = [];
    for (const block of layout.blocks) {
      all.push(...block.spots);
      if (block.more > 0) all.push({ id: moreId(block.key), x: block.x + MORE_OFFSET, y: block.y - MORE_OFFSET });
    }
    if (layout.terrain !== null) all.push(...layout.terrain.spots);
    for (const group of layout.groups) all.push({ id: groupId(group.key), x: group.x, y: group.y });
    for (const { path, label } of drawn) if (path.draft !== true) all.push({ id: pathId(path.id), x: label.x, y: label.y });
    return all;
  }, [layout, drawn]);

  const has = (id: string | null): id is string => id !== null && spots.some((spot) => spot.id === id);
  /** Foco itinerante: el último enfocado; si ya no está, el elegido; si tampoco, el primero. */
  const tabStop = has(focusId) ? focusId : has(selectedId) ? selectedId : (spots[0]?.id ?? null);

  // RF-7 (021) · 7.3: al llegar al nivel cercano, el foco va al edificio del grupo más próximo al centro.
  useLayoutEffect(() => {
    const wanted = pendingFocus.current;
    if (wanted === null) return;
    pendingFocus.current = null;
    if (layout.level !== 0) return;
    let nearest: MapSpot | null = null;
    let best = Infinity;
    for (const spot of spots) {
      if (!wanted.has(spot.id)) continue;
      const distance = Math.hypot(spot.x - frame.x, spot.y - frame.y);
      if (distance < best) {
        nearest = spot;
        best = distance;
      }
    }
    if (nearest !== null) buttons.current.get(nearest.id)?.focus({ preventScroll: true });
  });

  const chooseGroup = (group: MapGroup) => {
    pendingFocus.current = new Set(group.ids);
    setCustom({ key: idsKey, frame: frameOn(shown, group.ids, viewport) });
  };

  /** Si el lugar enfocado con el teclado queda fuera de la ventana, el mapa se centra en él. */
  const follow = (id: string) => {
    const spot = spots.find((candidate) => candidate.id === id);
    if (spot === undefined) return;
    const outside =
      Math.abs(spot.x - frame.x) > viewport.width / 2 - FOCUS_MARGIN || Math.abs(spot.y - frame.y) > viewport.height / 2 - FOCUS_MARGIN;
    if (outside) move((current) => ({ ...current, x: spot.x, y: spot.y }));
  };

  // RF-20 (021) · 20.4, D-T32 (021): al elegir un ápice desde fuera del mapa (el panel de un camino, la dirección), el mapa
  // lleva a su edificio: se centra en él si está en este nivel y fuera de la ventana; si va dentro de un grupo, acerca.
  const framed = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (selectedId === null) {
      framed.current = null;
      return;
    }
    if (framed.current === selectedId || !byId.has(selectedId)) return;
    framed.current = selectedId;
    if (spots.some((spot) => spot.id === selectedId)) follow(selectedId);
    else setCustom({ key: idsKey, frame: frameOn(shown, [selectedId], viewport) });
  });

  /** La ventana medida ahora mismo: en el primer cuadro el estado todavía trae la de respaldo (RF-4 (024)). */
  const measuredViewport = (): MapViewport => {
    const element = ref.current;
    return element !== null && element.clientWidth > 0 && element.clientHeight > 0
      ? { width: element.clientWidth, height: element.clientHeight }
      : viewport;
  };

  // RF-4 (024) · 4.1 a 4.4, D-T5 (024): al abrir un camino, el mapa se encuadra en sus ápices, en el nivel más cercano en que
  // caben y el camino se dibuja (`frameFit`); una sola vez por camino elegido, y el ápice elegido manda sobre el camino.
  const framedPath = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (selectedPathId === null) {
      framedPath.current = null;
      return;
    }
    if (framedPath.current === selectedPathId) return;
    const path = paths.find((candidate) => candidate.id === selectedPathId);
    if (path === undefined) return; // el camino puede llegar después del mapa: se espera
    framedPath.current = selectedPathId;
    if (selectedId !== null) return;
    const ids = path.apiceIds.filter((id) => byId.has(id));
    if (ids.length === 0) return; // sin ápices a la vista, el mapa queda en el encuadre inicial (RF-18 (021) · 18.7)
    const roadDrawn = ids.length > 1 ? (candidate: MapLayout) => pathPoints(candidate, ids).length > 0 : undefined;
    setCustom({ key: idsKey, frame: frameFit(shown, ids, measuredViewport(), undefined, roadDrawn) });
  });

  // RF-3 (024), D-T3 (024): el recorrido lleva el mapa a lo que cada paso señala. Con varios ápices (un camino) se
  // prefiere el nivel en que caben y el camino se dibuja; cada token mueve el mapa una sola vez. D-12 (024): `reserve` se
  // mide aquí, con la tarjeta ya pintada, y el encuadre deja libre su área; fuera del recorrido nada se reserva.
  const focused = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focus === null || focused.current === focus.token) return;
    focused.current = focus.token;
    const ids = focus.ids.filter((id) => byId.has(id));
    if (ids.length === 0) return;
    const roadDrawn = ids.length > 1 ? (candidate: MapLayout) => pathPoints(candidate, ids).length > 0 : undefined;
    setCustom({ key: idsKey, frame: frameFit(shown, ids, measuredViewport(), undefined, roadDrawn, focus.reserve?.() ?? 0) });
  });

  const spotProps = (id: string) => ({
    ref: (element: HTMLButtonElement | null) => {
      if (element === null) buttons.current.delete(id);
      else buttons.current.set(id, element);
    },
    tabIndex: id === tabStop ? 0 : -1,
    onFocus: (event: SyntheticEvent<HTMLButtonElement>) => {
      setFocusId(id);
      if (focusFromKeyboard(event.currentTarget)) follow(id);
    },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault();
      const next = mapNeighbor(spots, id, event.key);
      if (next !== null) buttons.current.get(next)?.focus({ preventScroll: true });
    },
  });

  // RF-8 (021) · 8.3: solo con el foco en el propio lienzo; en un edificio las flechas son de su botón.
  const onCanvasKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const pan: Record<string, readonly [x: number, y: number]> = {
      ArrowRight: [PAN_STEP, 0],
      ArrowLeft: [-PAN_STEP, 0],
      ArrowDown: [0, PAN_STEP],
      ArrowUp: [0, -PAN_STEP],
    };
    const by = pan[event.key];
    if (by !== undefined) {
      event.preventDefault();
      move((current) => ({ ...current, x: current.x + by[0], y: current.y + by[1] }));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoom(-1);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoom(1);
    }
  };

  // RF-8 (021) · 8.1: el puntero se captura cuando el arrastre ya empezó, para que un clic siga llegando a su botón.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: frame.x, originY: frame.y, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      current.moved = true;
      suppressClick.current = true;
      setDragging(true);
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Sin captura el arrastre sigue mientras el puntero no salga del lienzo.
      }
    }
    move((frameNow) => ({ ...frameNow, x: current.originX - dx, y: current.originY - dy }));
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const building = (spot: MapSpot, originX = 0, originY = 0) => {
    const apice = byId.get(spot.id);
    if (apice === undefined) return null;
    return (
      <button
        key={spot.id}
        type="button"
        className="block game-map__building"
        aria-label={apiceLabel(apice)}
        aria-pressed={apice.id === selectedId || chosenIds?.has(apice.id) === true}
        data-sketch={apice.id === sketchId ? 'true' : undefined}
        style={{ left: spot.x - originX - SPOT_WIDTH / 2, top: spot.y - originY - SPOT_HEIGHT / 2 }}
        onClick={() => onSelect(apice.id)}
        {...spotProps(spot.id)}
      >
        <Building axes={apice.axes} stage={apice.status} seed={apice.id} needs={hasNeeds(apice.needs)} max={1} />
        <span className="game-map__name">{apice.name}</span>
      </button>
    );
  };

  const more = (block: MapBlock) => (
    <button
      type="button"
      className="block game-map__more"
      aria-label={`${countText(block.more)} más en esta manzana`}
      aria-haspopup="dialog"
      style={{ left: block.x + MORE_OFFSET - MORE_RADIUS, top: block.y - MORE_OFFSET - MORE_RADIUS }}
      onClick={() => setMoreKey(block.key)}
      {...spotProps(moreId(block.key))}
    >
      +{block.more}
    </button>
  );

  const group = (item: MapGroup) => (
    <button
      key={item.key}
      type="button"
      className={`block game-map__group${item.unlocated ? ' game-map__group--unlocated' : ''}`}
      aria-label={`${countText(item.ids.length)}${item.unlocated ? ' sin ubicación' : ''}, acercar`}
      style={{ left: item.x - GROUP_RADIUS, top: item.y - GROUP_RADIUS }}
      onClick={() => chooseGroup(item)}
      {...spotProps(groupId(item.key))}
    >
      {item.ids.length}
      {item.unlocated && <span className="game-map__group-label">Sin ubicación</span>}
    </button>
  );

  const { terrain } = layout;
  const openBlock = moreKey === null ? null : (layout.blocks.find((block) => block.key === moreKey) ?? null);
  const bar = scaleBar(frame.scale);
  const offsetX = Math.round(viewport.width / 2 - frame.x);
  const offsetY = Math.round(viewport.height / 2 - frame.y);

  return (
    <div className={fill ? 'game-map-shell game-map-shell--fill' : 'game-map-shell'}>
      {capped && (
        <div role="status" className="block game-map__notice">
          <span>{`El mapa muestra ${MAP_LIMIT} de ${items.length} ápices. Afina los filtros para ver el resto.`}</span>
          {onList !== undefined && (
            <button type="button" className="block action-secondary" onClick={onList}>
              Ver como lista
            </button>
          )}
        </div>
      )}
      <section
        ref={ref}
        aria-label="Mapa de ápices"
        tabIndex={0}
        className="game-map"
        data-level={frame.level}
        data-dragging={dragging ? 'true' : undefined}
        onKeyDown={onCanvasKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onScroll={(event) => {
          // El foco en un edificio fuera de la ventana no desplaza el lienzo: de eso se encarga el encuadre.
          event.currentTarget.scrollLeft = 0;
          event.currentTarget.scrollTop = 0;
        }}
      >
        <div key={frame.level} className="game-map__world" style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}>
          <svg className="game-map__ground" width="1" height="1" aria-hidden="true" focusable="false">
            {layout.blocks.map((block) => (
              <circle key={block.key} className="game-map__plate" cx={block.x} cy={block.y} r={block.radius} />
            ))}
            {drawn.map(({ path, points }) => (
              <polyline
                key={path.id}
                className="game-map__path"
                points={svgPoints(points)}
                data-closed={path.closed ? 'true' : undefined}
                data-draft={path.draft === true ? 'true' : undefined}
                data-selected={path.id === selectedPathId ? 'true' : undefined}
              />
            ))}
          </svg>
          {layout.blocks.map((block) => (
            <Fragment key={block.key}>
              {block.spots.map((spot) => building(spot))}
              {block.more > 0 && more(block)}
            </Fragment>
          ))}
          {terrain !== null && (
            <div
              role="group"
              aria-label="Sin ubicación"
              className="game-map__terrain"
              style={{ left: terrain.x, top: terrain.y, width: terrain.width, height: terrain.height }}
            >
              <span className="game-map__terrain-label" aria-hidden="true">
                Sin ubicación
              </span>
              {terrain.spots.map((spot) => building(spot, terrain.x, terrain.y))}
            </div>
          )}
          {layout.groups.map(group)}
          {drawn.map(({ path, label }) =>
            path.draft === true ? null : (
              <button
                key={path.id}
                type="button"
                className="block game-map__path-label"
                aria-label={`Camino: ${pathText(path)}`}
                aria-pressed={path.id === selectedPathId}
                data-closed={path.closed ? 'true' : undefined}
                style={{ left: label.x, top: label.y }}
                onClick={() => onSelectPath?.(path.id)}
                {...spotProps(pathId(path.id))}
              >
                {pathText(path)}
              </button>
            ),
          )}
        </div>
        <div className="game-map__legend">
          <span role="img" aria-label="Norte arriba" className="game-map__north">
            N
          </span>
          <span className="game-map__scale" style={{ width: Math.round(bar.px) }}>
            {bar.label}
          </span>
        </div>
        <div className="game-map__controls" onPointerDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="block icon-button game-map__control"
            aria-label="Acercar"
            aria-disabled={frame.level === 0}
            onClick={() => zoom(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            className="block icon-button game-map__control"
            aria-label="Alejar"
            aria-disabled={frame.level === 2}
            onClick={() => zoom(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button type="button" className="block icon-button game-map__control" aria-label="Ver todo" onClick={() => setCustom(null)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
            </svg>
          </button>
        </div>
      </section>
      <Dialog open={openBlock !== null} labelledBy={titleId} onClose={() => setMoreKey(null)} className="game-map__dialog">
        <h2 id={titleId} className="game-map__dialog-title">
          Ápices de esta manzana
        </h2>
        {openBlock !== null && (
          <ul className="game-map__entries">
            {openBlock.ids.map((id) => {
              const apice = byId.get(id);
              if (apice === undefined) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="block game-map__entry"
                    aria-label={apiceLabel(apice)}
                    aria-pressed={id === selectedId || chosenIds?.has(id) === true}
                    onClick={() => {
                      setMoreKey(null);
                      onSelect(id);
                    }}
                  >
                    <Building axes={apice.axes} stage={apice.status} seed={apice.id} needs={hasNeeds(apice.needs)} max={1} />
                    <span className="game-map__entry-name">{apice.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="block action-secondary" onClick={() => setMoreKey(null)}>
          Cerrar
        </button>
      </Dialog>
    </div>
  );
}
