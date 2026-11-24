// RF-4 (021) · 4.1 a 4.4, RF-6 (021) · 6.1 a 6.3, RF-7 (021) · 7.1 a 7.5, RF-8 (021) · 8.1 a 8.6, RF-9 (021) · 9.1, 9.2,
// D-T17 (021) · Lienzo del mapa propio, teselado con H3 y dibujado con las superficies del sistema «APICCA · Mapa».
// Dibuja lo que calcula `shared/domain/hexmap.ts`: el teselado vacío, los bordes de zona y las rutas en una capa SVG
// decorativa y, encima, un botón por celda de Ápice, por grupo y por «+N». Sin teselas, sin imágenes y sin ninguna
// petición a la red; los colores salen de los tokens (GameMap.css).
// - Una zona son siete celdas con un borde de 4 px. Cada Ápice es una celda con su superficie de patrón: el color dice el
//   eje, el glifo lo repite y la regla dice la Etapa. Un Ápice de varios ejes va en franjas verticales.
// - Los rótulos (la zona y la Acción Común) van fuera de las celdas; el nombre de un Ápice aparece junto a su celda
//   al elegirla, al apuntarla o al enfocarla, nunca sobre el patrón.
// - Tres niveles (zona, ciudad y región). Al abrir encuadra todo; el encuadre se recalcula solo cuando cambia el
//   conjunto de Ápices. Elegir un grupo acerca hasta sus zonas y deja el foco en una de sus celdas.
// - Se mueve arrastrando, con los botones y con el teclado: con el foco en el lienzo, las flechas lo desplazan y + y -
//   cambian el nivel; con el foco en una celda, las flechas llevan a la más cercana en esa dirección y el mapa la sigue.
//   Un solo lugar está en el orden del tabulador. La rueda solo cambia el nivel con Ctrl o ⌘ (`wheel.ts`).
// - Los Ápices sin ubicación van en un terreno aparte, con su rótulo, y se eligen como los demás.
// - Con `fill` ocupa todo el alto de la página del mapa, sin borde ni radio (RF-11 (021) · 11.2, D-T22 (021)).
// - RF-18 (021) · 18.1 a 18.8, D-T30 (021): cada Acción Común es una fila de celdas de `ruta`, con el glifo de su eje, que
//   une las celdas de sus Ápices a la vista (`mapPaths.ts`), con un rótulo que la nombra y abre su panel; la cerrada
//   va con borde discontinuo y su rótulo dice «Cerrada». El rótulo entra en el foco itinerante. La Acción Común en
//   borrador de «Conectar» no lleva rótulo.
// - RF-3 (024), D-T4 (024), D-12 (024): el recorrido de bienvenida mueve el encuadre hasta lo que nombra cada paso, sin
//   que lo tape su tarjeta. RF-4 (024), D-T6 (024): abrir una Acción Común por su dirección encuadra sus Ápices.
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react';
import { APICE_STAGE_LABEL, type Axis } from '../../shared/domain/apice';
import { MAP_LIMIT } from '../../shared/domain/discovery';
import {
  LEVEL_SCALE,
  frameFit,
  frameMap,
  frameOn,
  layoutMap,
  mapNeighbor,
  scaleBar,
  tessellationPath,
  type MapBlock,
  type MapFrame,
  type MapGroup,
  type MapLayout,
  type MapLevel,
  type MapPlace,
  type MapSpot,
  type MapVertex,
  type MapViewport,
} from '../../shared/domain/hexmap';
import { axisIdentity } from '../../shared/domain/identity';
import {
  labelRect,
  pathCells,
  pathLabelCandidates,
  pathLabelWidth,
  pathPoints,
  placeLabel,
  pointInRect,
  rectsOverlap,
  shiftIntoView,
  type LabelCandidate,
  type LabelRect,
  type PathLabel,
  type PathPoint,
} from '../../shared/domain/mapPaths';
import { Dialog } from '../components/Dialog';
import { Glifo } from '../components/Glifo';
import { Superficie, SuperficieStripes, axesText } from '../components/Superficie';
import type { ListedApice } from '../data/apices';
import { bindModifierWheelZoom } from './wheel';
import './GameMap.css';

/** Una Acción Común que dibujar, o el borrador de «Conectar» (`draft`). */
export interface MapPath {
  id: string;
  title: string;
  closed: boolean;
  /** Los Ápices que une, en el orden de la Acción Común. */
  apiceIds: readonly string[];
  /** Su eje: el glifo de cada celda de la ruta. Sin eje, la ruta va sin glifo. */
  axis?: Axis | null;
  draft?: boolean;
}

interface Props {
  items: readonly ListedApice[];
  /** Las Acciones Comunes (RF-18 (021)). */
  paths?: readonly MapPath[];
  /** La Acción Común cuyo panel está abierto. */
  selectedPathId?: string | null;
  onSelectPath?(id: string): void;
  /** Los Ápices elegidos en «Conectar»: se marcan como el elegido (D-T31 (021)). */
  chosenIds?: ReadonlySet<string>;
  selectedId: string | null;
  onSelect(id: string): void;
  /** Pasa a la vista de lista: se ofrece cuando hay más Ápices que el tope del mapa (RF-7 (021) · 7.5). */
  onList?(): void;
  /** Ocupa todo el alto de quien lo contiene, sin borde: la página del mapa (D-T22 (021)). */
  fill?: boolean;
  /** La celda del boceto del visitante: se distingue por su forma (RF-23 (021) · 23.2, D-T39 (021)). */
  sketchId?: string | null;
  /**
   * El recorrido pide mirar estos Ápices: cada `token` nuevo mueve el mapa una vez (RF-3 (024)). `reserve` dice, al mover,
   * cuántos píxeles del borde de abajo ocupa la tarjeta del recorrido, para que no tape lo que se mira (D-12 (024)).
   */
  focus?: {
    token: number;
    ids: readonly string[];
    reserve?: () => number;
  } | null;
}

/** Ventana de respaldo, para cuando el lienzo todavía no se puede medir. */
const FALLBACK_VIEWPORT: MapViewport = { width: 960, height: 560 };
/** Lo que desplaza una flecha con el foco en el lienzo. */
const PAN_STEP = 80;
/** Menos que esto es un clic, no un arrastre. */
const DRAG_THRESHOLD = 4;
/** Un lugar más cerca que esto del borde de la ventana se trae al centro al recibir el foco. */
const FOCUS_MARGIN = 60;
/** Un gesto de pellizco manda muchos eventos de rueda: los repetidos en el mismo sentido se ignoran este tiempo. */
const WHEEL_PAUSE_MS = 300;
/** El teselado vacío se recalcula cuando el centro cambia de casilla de este tamaño, no en cada píxel de arrastre. */
const TESSELLATION_SNAP = 240;
/** Píxeles por unidad del patrón de las celdas: el del sistema, algo más denso para que se lea a 92 px. */
const PATTERN_SCALE = 0.42;
/** Hasta dónde llegan, medido desde el borde de la celda, el papel de 5 px y la tinta de 7 px del elegido y el contorno del boceto (en píxeles). */
const RING_PAPER = 5;
const RING_INK = 12;
const RING_SKETCH = 19;

/** Lo que cada rótulo deja libre contra el borde del lienzo. */
const VIEW_MARGIN = 8;
/** Lo que miden y dónde van los controles (44 px, a 16 px del borde) y la caja de norte y escala (GameMap.css). */
const OVERLAY_INSET = 16;
const CONTROL_SIZE = 44;
const CONTROL_GAP = 12;
const CONTROL_COUNT = 3;
const LEGEND_HEIGHT = 52;
const LEGEND_FRAME_WIDTH = 56;
/** Lo que mide de alto un rótulo y lo que lo separa de lo que nombra. */
const LABEL_HEIGHT = 24;
const LABEL_OFFSET = 6;
/** El nombre de un Ápice junto a su celda: lo que se aparta de ella, lo más que mide (14 rem) y lo que cuesta cada carácter. */
const TAG_OFFSET = 12;
const TAG_MAX_WIDTH = 224;
const TAG_CHAR_WIDTH = 8.5;
const TAG_PADDING = 24;
const TAG_HALF_HEIGHT = 14;
const TAG_MIN_ROOM = 56;

const moreId = (key: string): string => `more:${key}`;
const groupId = (key: string): string => `group:${key}`;
const pathId = (id: string): string => `path:${id}`;
const pathText = (path: MapPath): string => (path.closed ? `${path.title} · Cerrada` : path.title);

const apiceLabel = (apice: ListedApice): string =>
  `${apice.name}, ${apice.axes.length > 0 ? `${axesText(apice.axes)}, ` : ''}${APICE_STAGE_LABEL[apice.status]}`;
const countText = (count: number): string => (count === 1 ? '1 Ápice' : `${count} Ápices`);

const clampLevel = (level: number): MapLevel => (level <= 0 ? 0 : level >= 2 ? 2 : 1);

/** El foco llegó con el teclado. Donde el navegador no lo sabe decir, se toma como que sí. */
function focusFromKeyboard(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** Lo que mide y dónde cae una celda: su caja, y sus vértices como texto de SVG. */
interface Shape {
  x: number;
  y: number;
  width: number;
  height: number;
  points: string;
}

const pointsText = (points: readonly MapVertex[]): string => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function shapeOf(points: readonly MapVertex[]): Shape {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
    points: pointsText(points),
  };
}

/** La celda crecida `grow` píxeles hacia afuera, desde su centro (`radius` es su arista). */
function grown(points: readonly MapVertex[], center: MapPlace | { x: number; y: number }, radius: number, grow: number): string {
  const k = 1 + grow / ((radius * Math.sqrt(3)) / 2);
  return pointsText(points.map(([x, y]) => [center.x + (x - center.x) * k, center.y + (y - center.y) * k] as const));
}

const safeId = (value: string): string => value.replace(/[^\w-]/g, '_');

/** Lo que se ve del lienzo y lo que lo tapa, en píxeles del mundo (el origen que se arrastra), no de la ventana. */
interface LabelAreas {
  view: LabelRect;
  blocked: LabelRect[];
}

/**
 * La ventana con su margen y lo que la tapa: la caja de norte y escala abajo a la izquierda y los tres controles abajo a la
 * derecha. Los rótulos se miden contra esto para no cortarse ni quedar debajo (RF-4 (021) · 4.3, RF-8 (021) · 8.2).
 */
/** @internal Para las pruebas. */
export function labelAreas(viewport: MapViewport, barPx: number, offsetX: number, offsetY: number): LabelAreas {
  const toWorld = (left: number, top: number, right: number, bottom: number): LabelRect => ({
    left: left - offsetX,
    top: top - offsetY,
    right: right - offsetX,
    bottom: bottom - offsetY,
  });
  const controlsHeight = CONTROL_COUNT * CONTROL_SIZE + (CONTROL_COUNT - 1) * CONTROL_GAP;
  return {
    view: toWorld(VIEW_MARGIN, VIEW_MARGIN, viewport.width - VIEW_MARGIN, viewport.height - VIEW_MARGIN),
    blocked: [
      toWorld(
        OVERLAY_INSET,
        viewport.height - OVERLAY_INSET - LEGEND_HEIGHT,
        OVERLAY_INSET + LEGEND_FRAME_WIDTH + barPx,
        viewport.height - OVERLAY_INSET,
      ),
      toWorld(
        viewport.width - OVERLAY_INSET - CONTROL_SIZE,
        viewport.height - OVERLAY_INSET - controlsHeight,
        viewport.width - OVERLAY_INSET,
        viewport.height - OVERLAY_INSET,
      ),
    ],
  };
}

/** Cómo queda un rótulo que puede ir en dos lados de lo que nombra: si se voltea y lo que ocupa, ya corrido. */
interface Placement {
  flipped: boolean;
  rect: LabelRect;
}

/** El punto de apoyo del rótulo en la hoja de estilos: centrado o a la izquierda, y apoyado por abajo o por arriba. */
const anchorStyle = (rect: LabelRect, centered: boolean, bottomAnchored: boolean): { left: number; top: number } => ({
  left: centered ? (rect.left + rect.right) / 2 : rect.left,
  top: bottomAnchored ? rect.bottom : rect.top,
});

const moved = (rect: LabelRect, dx: number, dy: number): LabelRect => ({
  left: rect.left + dx,
  right: rect.right + dx,
  top: rect.top + dy,
  bottom: rect.bottom + dy,
});

/**
 * Elige entre `options` (el lugar de siempre y su volteado) el primero que cabe entero en la ventana, quizá corrido hacia
 * un lado, sin quedar bajo la leyenda ni los controles. Si ninguno cabe, queda el de siempre, corrido hasta la ventana.
 * Tampoco queda sobre un rótulo de `taken` (el nombre del Ápice elegido, por ejemplo): si el de siempre lo tapa, se voltea.
 * Si el punto `anchor` de lo que nombra está fuera de la ventana, el rótulo se va con él y no se toca (como `keptInside`).
 */
function placeFlipping(
  anchor: PathPoint,
  options: readonly [LabelRect, LabelRect],
  areas: LabelAreas,
  taken: readonly LabelRect[] = [],
): Placement {
  if (!pointInRect(anchor, areas.view)) return { flipped: false, rect: options[0] };
  let fallback: Placement | null = null;
  let apart: Placement | null = null;
  for (const [index, option] of options.entries()) {
    const shift = shiftIntoView(option, areas.view);
    const rect = moved(option, shift.x, shift.y);
    const free = !areas.blocked.some((area) => rectsOverlap(rect, area)) && !taken.some((other) => rectsOverlap(rect, other));
    fallback ??= { flipped: false, rect };
    if (free && shift.y === 0) return { flipped: index === 1, rect };
    if (free) apart ??= { flipped: index === 1, rect };
  }
  return apart ?? fallback!;
}

/** Lo que ocupa un rótulo apoyado por abajo en `bottom` (va por encima de lo que nombra) o por arriba en `top` (va por debajo). */
const above = (x: number, left: number, width: number, bottom: number): LabelRect => ({
  left: x + left,
  right: x + left + width,
  top: bottom - LABEL_HEIGHT,
  bottom,
});
const below = (x: number, left: number, width: number, top: number): LabelRect => ({
  left: x + left,
  right: x + left + width,
  top,
  bottom: top + LABEL_HEIGHT,
});

const zoneText = (block: MapBlock): string => `Zona ${block.code} · ${block.ids.length === 1 ? '1 Ápice' : `${block.ids.length} Ápices`}`;
const UNLOCATED_TEXT = 'Sin ubicación';

/** Dónde va el rótulo de cada zona, del terreno sin ubicar y de los grupos sin ubicación, y de cada Acción Común. */
export interface LabelPlan {
  areas: LabelAreas;
  /** De qué lado va el nombre de cada Ápice elegido, ya contado entre los rótulos para que ninguno lo tape. */
  tags: Map<string, TagPlacement>;
  zones: Map<string, Placement>;
  terrain: Placement | null;
  groups: Map<string, Placement>;
  paths: Map<string, PathLabel | null>;
}

/** Un Ápice elegido: su celda y su nombre, que se ve junto a ella siempre. */
export interface PressedApice {
  spot: MapSpot;
  name: string;
}

export interface DrawnPath {
  path: MapPath;
  /** Las celdas de `ruta` de la Acción Común: ocupadas para los rótulos. */
  cells: readonly { x: number; y: number }[];
  candidates: LabelCandidate[];
}

/**
 * Coloca todos los rótulos del lienzo (RF-4 (021) · 4.3, D-T30 (021)): primero los de zona, terreno y grupos sin ubicación,
 * que se voltean si no caben; luego los de las Acciones Comunes, la elegida primero, cada uno en el primer lugar que no
 * tapa una celda con patrón, otro rótulo, la leyenda ni los controles. Una Acción Común sin sitio queda sin rótulo.
 */
/** @internal Para las pruebas. */
export function planLabels(
  layout: MapLayout,
  drawn: readonly DrawnPath[],
  areas: LabelAreas,
  selectedPathId: string | null,
  pressed: readonly PressedApice[] = [],
): LabelPlan {
  const taken: LabelRect[] = [];
  // El nombre del Ápice elegido va primero: es lo que se lee al elegirlo, y los rótulos de zona se voltean o se corren por él.
  const tags = new Map<string, TagPlacement>();
  for (const { spot, name } of pressed) {
    const tag = tagPlacement(spot, name, areas);
    tags.set(spot.id, tag);
    taken.push(tag.rect);
  }
  const zones = new Map<string, Placement>();
  for (const block of layout.blocks) {
    const width = pathLabelWidth(zoneText(block).length);
    const bottomEdge = Math.max(...block.outline.map(([, y]) => y));
    const placement = placeFlipping(
      { x: block.x, y: block.y },
      [above(block.label.x, -width / 2, width, block.label.y), below(block.label.x, -width / 2, width, bottomEdge + LABEL_OFFSET)],
      areas,
      taken,
    );
    zones.set(block.key, placement);
    taken.push(placement.rect);
  }
  let terrain: Placement | null = null;
  if (layout.terrain !== null) {
    const width = pathLabelWidth(UNLOCATED_TEXT.length);
    const { x, y, width: boxWidth, height } = layout.terrain;
    terrain = placeFlipping(
      { x: x + boxWidth / 2, y: y + height / 2 },
      [above(layout.terrain.label.x, 0, width, layout.terrain.label.y), below(layout.terrain.label.x, 0, width, y + height + LABEL_OFFSET)],
      areas,
      taken,
    );
    taken.push(terrain.rect);
  }
  const groups = new Map<string, Placement>();
  for (const group of layout.groups) {
    if (!group.unlocated) continue;
    const width = pathLabelWidth(UNLOCATED_TEXT.length);
    const placement = placeFlipping(
      group,
      [
        below(group.x, -width / 2, width, group.y + layout.radius + LABEL_OFFSET),
        above(group.x, -width / 2, width, group.y - layout.radius - LABEL_OFFSET),
      ],
      areas,
      taken,
    );
    groups.set(group.key, placement);
    taken.push(placement.rect);
  }
  const paths = new Map<string, PathLabel | null>();
  // Las celdas de `ruta` de todas las Acciones Comunes, con su glifo, tampoco se tapan.
  const routeCells = drawn.flatMap(({ cells }) => cells.map(({ x, y }) => ({ x, y })));
  const ordered = [...drawn].sort((a, b) => Number(b.path.id === selectedPathId) - Number(a.path.id === selectedPathId));
  for (const { path, candidates } of ordered) {
    if (path.draft === true) continue;
    const characters = pathText(path).length;
    const label = placeLabel(layout, candidates, characters, {
      view: areas.view,
      blocked: areas.blocked,
      taken,
      busy: routeCells,
    });
    paths.set(path.id, label);
    if (label !== null) taken.push(labelRect(label, label.width ?? pathLabelWidth(characters)));
  }
  return { areas, tags, zones, terrain, groups, paths };
}

/** De qué lado de su celda va el nombre de un Ápice y cuánto puede medir ahí sin cortarse ni quedar bajo un control. */
interface TagPlacement {
  side: 'right' | 'left';
  room: number;
  /** Lo que ocupa el nombre, en píxeles del mundo, para que los demás rótulos no lo tapen. */
  rect: LabelRect;
}

function tagPlacement(spot: MapSpot, name: string, areas: LabelAreas): TagPlacement {
  const xs = spot.points.map(([x]) => x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const wanted = Math.min(TAG_MAX_WIDTH, name.length * TAG_CHAR_WIDTH + TAG_PADDING);
  const rectFor = (side: 'right' | 'left', room: number): LabelRect => {
    const width = Math.min(wanted, room);
    const left = side === 'right' ? maxX + TAG_OFFSET : minX - TAG_OFFSET - width;
    return { left, right: left + width, top: spot.y - TAG_HALF_HEIGHT, bottom: spot.y + TAG_HALF_HEIGHT };
  };
  if (!pointInRect(spot, areas.view)) return { side: 'right', room: TAG_MAX_WIDTH, rect: rectFor('right', TAG_MAX_WIDTH) };
  const roomOn = (side: 'right' | 'left'): number => {
    let limit = side === 'right' ? areas.view.right : areas.view.left;
    for (const area of areas.blocked) {
      if (area.top > spot.y + TAG_HALF_HEIGHT || area.bottom < spot.y - TAG_HALF_HEIGHT) continue;
      if (side === 'right' && area.left >= maxX) limit = Math.min(limit, area.left - VIEW_MARGIN);
      if (side === 'left' && area.right <= minX) limit = Math.max(limit, area.right + VIEW_MARGIN);
    }
    return side === 'right' ? limit - (maxX + TAG_OFFSET) : minX - TAG_OFFSET - limit;
  };
  const right = roomOn('right');
  const left = roomOn('left');
  const side = right >= wanted ? 'right' : left >= wanted ? 'left' : right >= left ? 'right' : 'left';
  const room = Math.floor(Math.min(TAG_MAX_WIDTH, Math.max(TAG_MIN_ROOM, side === 'right' ? right : left)));
  return { side, room, rect: rectFor(side, room) };
}

/** Lo que las celdas de Ápice piden al lienzo; estable, para que arrastrar el mapa no vuelva a dibujarlas. */
interface CellHandlers {
  select(id: string): void;
  register(id: string, element: HTMLButtonElement | null): void;
  focus(id: string, event: SyntheticEvent<HTMLButtonElement>): void;
  key(id: string, event: KeyboardEvent<HTMLButtonElement>): void;
}

interface CellProps {
  spot: MapSpot;
  apice: ListedApice;
  radius: number;
  pressed: boolean;
  sketch: boolean;
  tabbable: boolean;
  /** De qué lado va su nombre y cuánto puede medir (`tagPlacement`). */
  tagSide: 'right' | 'left';
  tagRoom: number;
  /** Prefijo único para el recorte de esta celda. */
  uid: string;
  /** Dónde está el origen de quien la contiene (el terreno sin ubicación). */
  originX: number;
  originY: number;
  handlers: CellHandlers;
}

/** La celda de un Ápice: su superficie de patrón recortada al hexágono, con contorno de 2 px. */
const ApiceCell = memo(function ApiceCell({
  spot,
  apice,
  radius,
  pressed,
  sketch,
  tabbable,
  tagSide,
  tagRoom,
  uid,
  originX,
  originY,
  handlers,
}: CellProps) {
  const shape = useMemo(() => shapeOf(spot.points), [spot.points]);
  const clip = `${uid}-${safeId(spot.id)}`;
  const register = useCallback((element: HTMLButtonElement | null) => handlers.register(spot.id, element), [handlers, spot.id]);
  return (
    <button
      ref={register}
      type="button"
      className="block game-map__cell game-map__apice"
      aria-label={apiceLabel(apice)}
      aria-pressed={pressed}
      data-sketch={sketch ? 'true' : undefined}
      tabIndex={tabbable ? 0 : -1}
      style={{
        left: shape.x - originX,
        top: shape.y - originY,
        width: shape.width,
        height: shape.height,
      }}
      onClick={() => handlers.select(spot.id)}
      onFocus={(event) => handlers.focus(spot.id, event)}
      onKeyDown={(event) => handlers.key(spot.id, event)}
    >
      <svg
        className="game-map__shape"
        viewBox={`${shape.x} ${shape.y} ${shape.width} ${shape.height}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clip}>
            <polygon points={shape.points} />
          </clipPath>
        </defs>
        {sketch && <polygon className="game-map__ring game-map__ring--sketch" points={grown(spot.points, spot, radius, RING_SKETCH)} />}
        {pressed && <polygon className="game-map__ring game-map__ring--ink" points={grown(spot.points, spot, radius, RING_INK)} />}
        {pressed && <polygon className="game-map__ring game-map__ring--paper" points={grown(spot.points, spot, radius, RING_PAPER)} />}
        <g clipPath={`url(#${clip})`}>
          <SuperficieStripes
            axes={apice.axes}
            status={apice.status}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            scale={PATTERN_SCALE}
          />
        </g>
        <polygon className="game-map__hex" points={shape.points} />
      </svg>
      <span
        className="game-map__tag"
        aria-hidden="true"
        data-side={tagSide === 'left' ? 'left' : undefined}
        style={tagRoom < TAG_MAX_WIDTH ? ({ '--tag-room': `${tagRoom}px` } as CSSProperties) : undefined}
      >
        {apice.name}
      </span>
    </button>
  );
});

const NO_PATHS: readonly MapPath[] = [];

export function GameMap({
  items,
  paths = NO_PATHS,
  selectedPathId = null,
  onSelectPath,
  chosenIds,
  selectedId,
  onSelect,
  onList,
  fill = false,
  sketchId = null,
  focus = null,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const titleId = useId();
  const uid = useId().replace(/[^\w-]/g, '');
  const [viewport, setViewport] = useState<MapViewport>(FALLBACK_VIEWPORT);
  const [custom, setCustom] = useState<{ key: string; frame: MapFrame } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [moreKey, setMoreKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Arrastre en curso: dónde empezó el puntero y dónde estaba el mapa. */
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
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

  // RF-7 (021) · 7.4: el encuadre inicial; lo que la persona mueve vale mientras el conjunto de Ápices sea el mismo.
  const home = useMemo(() => frameMap(shown, viewport), [shown, viewport]);
  const frame = custom !== null && custom.key === idsKey ? custom.frame : home;
  const layout = useMemo(() => layoutMap(shown, frame.level, frame.scale), [shown, frame.level, frame.scale]);

  const move = (next: (current: MapFrame) => MapFrame) =>
    setCustom((current) => ({
      key: idsKey,
      frame: next(current !== null && current.key === idsKey ? current.frame : home),
    }));

  /** `step` 1 aleja y -1 acerca; el centro de la ventana se conserva (RF-7 (021) · 7.1). */
  const zoom = (step: 1 | -1) =>
    move((current) => {
      const level = clampLevel(current.level + step);
      if (level === current.level) return current;
      // El nivel más lejano usa la escala del encuadre inicial cuando hizo falta alejarlo para que cupiera todo.
      const scale = level === 2 && home.level === 2 ? home.scale : LEVEL_SCALE[level];
      return {
        level,
        scale,
        x: (current.x * scale) / current.scale,
        y: (current.y * scale) / current.scale,
      };
    });

  // El teselado vacío (RF-4 (021) · 4.1): las celdas H3 que tocan la ventana, más un margen; se rehace al cambiar de nivel,
  // de ventana o de casilla, no en cada píxel de arrastre.
  const snapX = Math.round(frame.x / TESSELLATION_SNAP);
  const snapY = Math.round(frame.y / TESSELLATION_SNAP);
  const tessellation = useMemo(
    () =>
      tessellationPath(layout, {
        // `tessellationPath` recibe el centro del área, no su esquina.
        x: snapX * TESSELLATION_SNAP,
        y: snapY * TESSELLATION_SNAP,
        width: viewport.width + 2 * TESSELLATION_SNAP,
        height: viewport.height + 2 * TESSELLATION_SNAP,
      }),
    [layout, snapX, snapY, viewport],
  );

  /** Las Acciones Comunes con al menos dos puntos a la vista: sus celdas de ruta y los lugares posibles de su rótulo (RF-18 (021) · 18.7). */
  const drawn = useMemo(
    () =>
      paths.flatMap((path) => {
        const points = pathPoints(layout, path.apiceIds);
        if (points.length === 0) return [];
        const cells = pathCells(layout, path.apiceIds);
        const candidates = path.draft === true ? [] : pathLabelCandidates(layout, path.apiceIds);
        return [{ path, points, cells, candidates }];
      }),
    [paths, layout],
  );

  const offsetX = Math.round(viewport.width / 2 - frame.x);
  const offsetY = Math.round(viewport.height / 2 - frame.y);
  const bar = scaleBar(frame.scale);
  const barPx = Math.round(bar.px);

  /** Dónde va cada rótulo con la ventana de ahora: ninguno se corta, ni queda bajo la leyenda o los controles, ni sobre un patrón. */
  const plan = useMemo(() => {
    const pressed: PressedApice[] = [];
    for (const block of layout.blocks)
      for (const spot of block.spots) {
        const apice = byId.get(spot.id);
        if (apice !== undefined && (spot.id === selectedId || chosenIds?.has(spot.id) === true)) pressed.push({ spot, name: apice.name });
      }
    return planLabels(layout, drawn, labelAreas(viewport, barPx, offsetX, offsetY), selectedPathId, pressed);
  }, [layout, drawn, viewport, barPx, offsetX, offsetY, selectedPathId, byId, selectedId, chosenIds]);

  /** Todo lo que se puede enfocar en el nivel a la vista, para moverse con las flechas (RF-8 (021) · 8.4). */
  const spots = useMemo(() => {
    const all: MapPlace[] = [];
    for (const block of layout.blocks) {
      all.push(...block.spots);
      if (block.moreCell !== null)
        all.push({
          id: moreId(block.key),
          x: block.moreCell.x,
          y: block.moreCell.y,
        });
    }
    if (layout.terrain !== null) all.push(...layout.terrain.spots);
    for (const group of layout.groups) all.push({ id: groupId(group.key), x: group.x, y: group.y });
    for (const { path } of drawn) {
      const label = plan.paths.get(path.id);
      if (label != null) all.push({ id: pathId(path.id), x: label.x, y: label.y });
    }
    return all;
  }, [layout, drawn, plan]);

  const has = (id: string | null): id is string => id !== null && spots.some((spot) => spot.id === id);
  /** Foco itinerante: el último enfocado; si ya no está, el elegido; si tampoco, el primero. */
  const tabStop = has(focusId) ? focusId : has(selectedId) ? selectedId : (spots[0]?.id ?? null);

  // RF-7 (021) · 7.3: al llegar al nivel cercano, el foco va a la celda del grupo más próxima al centro.
  useLayoutEffect(() => {
    const wanted = pendingFocus.current;
    if (wanted === null) return;
    pendingFocus.current = null;
    if (layout.level !== 0) return;
    let nearest: MapPlace | null = null;
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

  const latest = useRef({ zoom, follow, onSelect, spots });
  latest.current = { zoom, follow, onSelect, spots };

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
    return bindModifierWheelZoom(element, {
      zoomIn: () => wheelZoom(-1),
      zoomOut: () => wheelZoom(1),
    });
  }, []);

  // RF-20 (021) · 20.4, D-T32 (021): al elegir un Ápice desde fuera del mapa (el panel de una Acción Común, la dirección), el
  // mapa lleva a su celda: se centra en ella si está en este nivel y fuera de la ventana; si va dentro de un grupo, acerca.
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

  // RF-4 (024) · 4.1 a 4.4, D-T5 (024): al abrir una Acción Común, el mapa se encuadra en sus Ápices, en el nivel más cercano en
  // que caben y la ruta se dibuja (`frameFit`); una sola vez por Acción Común elegida, y el Ápice elegido manda sobre ella.
  const framedPath = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (selectedPathId === null) {
      framedPath.current = null;
      return;
    }
    if (framedPath.current === selectedPathId) return;
    const path = paths.find((candidate) => candidate.id === selectedPathId);
    if (path === undefined) return; // la Acción Común puede llegar después del mapa: se espera
    framedPath.current = selectedPathId;
    if (selectedId !== null) return;
    const ids = path.apiceIds.filter((id) => byId.has(id));
    if (ids.length === 0) return; // sin Ápices a la vista, el mapa queda en el encuadre inicial (RF-18 (021) · 18.7)
    const routeDrawn = ids.length > 1 ? (candidate: MapLayout) => pathPoints(candidate, ids).length > 0 : undefined;
    setCustom({
      key: idsKey,
      frame: frameFit(shown, ids, measuredViewport(), undefined, routeDrawn),
    });
  });

  // RF-3 (024), D-T3 (024): el recorrido lleva el mapa a lo que cada paso señala. Con varios Ápices (una Acción Común) se
  // prefiere el nivel en que caben y la ruta se dibuja; cada token mueve el mapa una sola vez. D-12 (024): `reserve` se
  // mide aquí, con la tarjeta ya pintada, y el encuadre deja libre su área; fuera del recorrido nada se reserva.
  const focused = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focus === null || focused.current === focus.token) return;
    focused.current = focus.token;
    const ids = focus.ids.filter((id) => byId.has(id));
    if (ids.length === 0) return;
    const routeDrawn = ids.length > 1 ? (candidate: MapLayout) => pathPoints(candidate, ids).length > 0 : undefined;
    setCustom({
      key: idsKey,
      frame: frameFit(shown, ids, measuredViewport(), undefined, routeDrawn, focus.reserve?.() ?? 0),
    });
  });

  /** Las celdas de Ápice piden esto al lienzo; no cambia, y lo último que saben lo leen de `latest`. */
  const handlers = useMemo<CellHandlers>(
    () => ({
      select: (id) => latest.current.onSelect(id),
      register: (id, element) => {
        if (element === null) buttons.current.delete(id);
        else buttons.current.set(id, element);
      },
      focus: (id, event) => {
        setFocusId(id);
        if (focusFromKeyboard(event.currentTarget)) latest.current.follow(id);
      },
      key: (id, event) => {
        if (!event.key.startsWith('Arrow')) return;
        event.preventDefault();
        const next = mapNeighbor(latest.current.spots, id, event.key);
        if (next !== null) buttons.current.get(next)?.focus({ preventScroll: true });
      },
    }),
    [],
  );

  /** Lo que comparten los controles que no son celdas de Ápice: el grupo, el «+N» y el rótulo de la Acción Común. */
  const spotProps = (id: string) => ({
    ref: (element: HTMLButtonElement | null) => handlers.register(id, element),
    tabIndex: id === tabStop ? 0 : -1,
    onFocus: (event: SyntheticEvent<HTMLButtonElement>) => handlers.focus(id, event),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => handlers.key(id, event),
  });

  // RF-8 (021) · 8.3: solo con el foco en el propio lienzo; en una celda las flechas son de su botón.
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
      move((current) => ({
        ...current,
        x: current.x + by[0],
        y: current.y + by[1],
      }));
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
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: frame.x,
      originY: frame.y,
      moved: false,
    };
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
    move((frameNow) => ({
      ...frameNow,
      x: current.originX - dx,
      y: current.originY - dy,
    }));
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

  const cell = (spot: MapSpot, originX = 0, originY = 0) => {
    const apice = byId.get(spot.id);
    if (apice === undefined) return null;
    const tag = plan.tags.get(spot.id) ?? tagPlacement(spot, apice.name, plan.areas);
    return (
      <ApiceCell
        key={spot.id}
        spot={spot}
        apice={apice}
        radius={layout.radius}
        pressed={apice.id === selectedId || chosenIds?.has(apice.id) === true}
        sketch={apice.id === sketchId}
        tabbable={spot.id === tabStop}
        tagSide={tag.side}
        tagRoom={tag.room}
        uid={uid}
        originX={originX}
        originY={originY}
        handlers={handlers}
      />
    );
  };

  /** Una celda de tinta con su texto: el «+N» de una zona y el grupo de un nivel alejado. */
  const inkCell = (
    place: { x: number; y: number; points: readonly MapVertex[] },
    className: string,
    id: string,
    label: string,
    onClick: () => void,
    text: string,
    extra: Record<string, string | undefined> = {},
  ) => {
    const shape = shapeOf(place.points);
    return (
      <button
        type="button"
        className={`block game-map__cell ${className}`}
        aria-label={label}
        style={{
          left: shape.x,
          top: shape.y,
          width: shape.width,
          height: shape.height,
        }}
        onClick={onClick}
        {...extra}
        {...spotProps(id)}
      >
        <svg
          className="game-map__shape"
          viewBox={`${shape.x} ${shape.y} ${shape.width} ${shape.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <polygon className="game-map__hex game-map__hex--ink" points={shape.points} />
        </svg>
        <span className="game-map__count">{text}</span>
      </button>
    );
  };

  const more = (block: MapBlock) =>
    block.moreCell === null
      ? null
      : inkCell(
          block.moreCell,
          'game-map__more',
          moreId(block.key),
          `${countText(block.more)} más en esta zona`,
          () => setMoreKey(block.key),
          `+${block.more}`,
          {
            'aria-haspopup': 'dialog',
          },
        );

  const group = (item: MapGroup) => {
    const placed = item.unlocated ? plan.groups.get(item.key) : undefined;
    return (
      <div key={item.key} className="game-map__group-wrap">
        {inkCell(
          item,
          `game-map__group${item.unlocated ? ' game-map__group--unlocated' : ''}`,
          groupId(item.key),
          `${countText(item.ids.length)}${item.unlocated ? ' sin ubicación' : ''}, acercar`,
          () => chooseGroup(item),
          String(item.ids.length),
        )}
        {placed !== undefined && (
          <span
            className="game-map__label game-map__label--below"
            data-side={placed.flipped ? 'above' : undefined}
            style={anchorStyle(placed.rect, true, placed.flipped)}
          >
            {UNLOCATED_TEXT}
          </span>
        )}
      </div>
    );
  };

  const routeCell = (
    path: MapPath,
    cellShape: {
      cell: string;
      x: number;
      y: number;
      points: readonly MapVertex[];
    },
  ) => (
    <g key={`${path.id}:${cellShape.cell}`}>
      <polygon
        className="game-map__route"
        points={pointsText(cellShape.points)}
        data-closed={path.closed ? 'true' : undefined}
        data-draft={path.draft === true ? 'true' : undefined}
        data-selected={path.id === selectedPathId ? 'true' : undefined}
      />
      {path.axis != null && (
        <Glifo
          axis={path.axis}
          size={layout.radius * 0.9}
          tile={false}
          mode="macizo"
          k={0.36}
          x={cellShape.x - layout.radius * 0.45}
          y={cellShape.y - layout.radius * 0.45}
          className={`game-map__glyph game-map__glyph--${axisIdentity(path.axis).key}`}
        />
      )}
    </g>
  );

  const pathLabelButton = (path: MapPath, label: PathLabel) => {
    return (
      <button
        key={path.id}
        type="button"
        className="block game-map__path-label"
        aria-label={`Acción Común: ${pathText(path)}`}
        aria-pressed={path.id === selectedPathId}
        data-closed={path.closed ? 'true' : undefined}
        data-align={label.align}
        style={{ left: label.x, top: label.y, maxInlineSize: label.width }}
        onClick={() => onSelectPath?.(path.id)}
        {...spotProps(pathId(path.id))}
      >
        {pathText(path)}
      </button>
    );
  };

  const { terrain } = layout;
  const openBlock = moreKey === null ? null : (layout.blocks.find((block) => block.key === moreKey) ?? null);

  return (
    <div className={fill ? 'game-map-shell game-map-shell--fill' : 'game-map-shell'}>
      {capped && (
        <div role="status" className="block game-map__notice">
          <span>{`El mapa muestra ${MAP_LIMIT} de ${items.length} Ápices. Afina los filtros para ver el resto.`}</span>
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
          // El foco en una celda fuera de la ventana no desplaza el lienzo: de eso se encarga el encuadre.
          event.currentTarget.scrollLeft = 0;
          event.currentTarget.scrollTop = 0;
        }}
      >
        <div key={frame.level} className="game-map__world" style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}>
          <svg className="game-map__ground" width="1" height="1" aria-hidden="true" focusable="false">
            <path className="game-map__tessellation" d={tessellation} />
            {drawn.map(({ path, points, cells }) =>
              cells.length === 0 ? (
                <polyline
                  key={`${path.id}:line`}
                  className="game-map__line"
                  points={points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
                  data-closed={path.closed ? 'true' : undefined}
                  data-draft={path.draft === true ? 'true' : undefined}
                  data-selected={path.id === selectedPathId ? 'true' : undefined}
                />
              ) : (
                cells.map((item) => routeCell(path, item))
              ),
            )}
          </svg>
          {/* El borde de zona va encima de las celdas (que son botones HTML) para verse entero, como en el sistema. */}
          <svg className="game-map__ground game-map__outlines" width="1" height="1" aria-hidden="true" focusable="false">
            {layout.blocks.map((block) => (
              <polygon key={block.key} className="game-map__zone-outline" points={pointsText(block.outline)} />
            ))}
          </svg>
          {layout.blocks.map((block) => {
            const placed = plan.zones.get(block.key);
            return (
              <div key={block.key} role="group" aria-label={`Zona ${block.code}`} className="game-map__zone">
                {placed !== undefined && (
                  <span
                    className="game-map__label game-map__label--zone"
                    data-side={placed.flipped ? 'below' : undefined}
                    style={anchorStyle(placed.rect, true, !placed.flipped)}
                  >
                    {zoneText(block)}
                  </span>
                )}
                {block.spots.map((spot) => cell(spot))}
                {more(block)}
              </div>
            );
          })}
          {terrain !== null && (
            <div
              role="group"
              aria-label="Sin ubicación"
              className="game-map__terrain"
              style={{
                left: terrain.x,
                top: terrain.y,
                width: terrain.width,
                height: terrain.height,
              }}
            >
              {terrain.spots.map((spot) => cell(spot, terrain.x, terrain.y))}
            </div>
          )}
          {terrain !== null && plan.terrain !== null && (
            <span
              className="game-map__label game-map__label--terrain"
              data-side={plan.terrain.flipped ? 'below' : undefined}
              style={anchorStyle(plan.terrain.rect, false, !plan.terrain.flipped)}
            >
              {UNLOCATED_TEXT}
            </span>
          )}
          {layout.groups.map(group)}
          {drawn.map(({ path }) => {
            const label = plan.paths.get(path.id);
            return label == null ? null : pathLabelButton(path, label);
          })}
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
          Ápices de esta zona
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
                    <Superficie axes={apice.axes} status={apice.status} width={64} height={44} scale={PATTERN_SCALE} decorative />
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
