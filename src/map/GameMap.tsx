// RF-4 (021) · 4.1 a 4.4, RF-6 (021) · 6.1 a 6.3, RF-7 (021) · 7.1 a 7.5, RF-8 (021) · 8.1 a 8.6, RF-9 (021) · 9.1, 9.2,
// D-T17 (021) · Lienzo del mapa propio, teselado con H3 y dibujado con las superficies del sistema «APICCA · Mapa».
// Dibuja lo que calcula `shared/domain/hexmap.ts`: la trama de las zonas, los bordes de zona y los Arcos en capas SVG
// decorativas y, entre ellas, un botón por celda de Ápice, por grupo y por «+N». Sin teselas, sin imágenes y sin ninguna
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
// - RF-18 (021) · 18.1 a 18.8, D-T30 (021), «E3 · Celda»: cada Acción Común es un Arco (`mapArcs.ts`, `ArcLayer.tsx`) que
//   une las celdas de sus Ápices a la vista, con un rótulo (glifo del eje y nombre) que la nombra y abre su panel; la
//   cerrada va con línea discontinua y su rótulo dice «Cerrada». El rótulo entra en el foco itinerante. La Acción Común
//   en borrador de «Conectar» no lleva rótulo.
// - Apagado: con `dimmedIds` (lo que el filtro deja fuera) y, con un Ápice o una Acción Común elegidos, todo lo que no
//   es de ellos se dibuja en `trama` sin dejar de ser un botón (`data-off`). La página sabe dónde cae lo elegido con
//   `onAnchor`, y puede llevar el nivel (`level`, `onLevelChange`) y esconder los controles de zoom (`hideZoomControls`).
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
  frameAtLevel,
  frameFit,
  frameMap,
  frameOn,
  layoutMap,
  mapNeighbor,
  scaleBar,
  zonesTessellationPath,
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
import { buildArc, placeArcLabel, type Arc, type ArcLabelBox } from '../../shared/domain/mapArcs';
import {
  pathLabelWidth,
  pathPoints,
  pointInRect,
  rectsOverlap,
  shiftIntoView,
  type LabelRect,
  type PathPoint,
} from '../../shared/domain/mapPaths';
import { Dialog } from '../components/Dialog';
import { Glifo } from '../components/Glifo';
import { CeldaSuperficie } from '../components/Celda';
import { SuperficieStripes, axesText } from '../components/Superficie';
import type { ListedApice } from '../data/apices';
import { ArcLayer, type ArcItem } from './ArcLayer';
import { bindModifierWheelZoom } from './wheel';
import './GameMap.css';

/** Una Acción Común que dibujar, o el borrador de «Conectar» (`draft`). */
export interface MapPath {
  id: string;
  title: string;
  closed: boolean;
  /** Los Ápices que une, en el orden de la Acción Común. */
  apiceIds: readonly string[];
  /** Su eje: el glifo de su rótulo. Sin eje, el rótulo va sin glifo. */
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
  /** Los Ápices que el filtro deja fuera (`dimmedIds` de `discovery.ts`): se dibujan apagados, siguen siendo botones. */
  dimmedIds?: ReadonlySet<string>;
  /**
   * Dónde cae lo elegido, en coordenadas de la ventana (`client`): el punto medio del borde de abajo de la celda del Ápice
   * elegido, 4 px más abajo; o, con una Acción Común elegida, la muestra central de su Arco. Se llama tras cada cambio de
   * encuadre, arrastre o cambio de tamaño, solo si el punto se movió más de 0,5 px, y con `null` si no hay elección o
   * queda fuera de la ventana del mapa.
   */
  onAnchor?(point: { x: number; y: number } | null): void;
  /** El nivel de acercamiento, llevado desde fuera. Sin él, el mapa lo lleva solo. */
  level?: MapLevel;
  /** El nivel cambió (por los controles, la rueda, el teclado o al acercar un grupo): con `level`, la página decide si lo sigue. */
  onLevelChange?(level: MapLevel): void;
  /** Sin los botones Acercar, Alejar y Ver todo (los lleva la página). Por defecto se muestran. */
  hideZoomControls?: boolean;
  /**
   * El encuadre inicial va al nivel cercano (0), sobre las zonas de los Ápices a la vista, aunque todos quepan alejados:
   * «Conectar» pide celdas que se puedan pulsar, no grupos (QA celda 2 · C3). Lo que la persona mueve o la página lleva en
   * `level` manda sobre esto.
   */
  startClose?: boolean;
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
/** Hasta dónde llega, medido desde el borde de la celda, el contorno discontinuo del boceto (en píxeles). El elegido ya no lleva anillo: lo dice la línea de llamada y su contorno de 4 px. */
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
/** Lo que dice, sin depender del color, una celda apagada (Propuesta del asistente: texto de interfaz por decidir). */
const OFF_BY_FILTER = 'Fuera de los filtros';
const OFF_BY_PICK = 'Sin relación con lo elegido';
/** Propuesta del asistente (QA celda 2 · 2): lo que dice, sin depender del color, una celda marcada en «Conectar». */
const CHOSEN_FOR_PATH = 'Elegido para la Acción Común';

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
export function labelAreas(viewport: MapViewport, barPx: number, offsetX: number, offsetY: number, controls = true): LabelAreas {
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
      ...(controls
        ? [
            toWorld(
              viewport.width - OVERLAY_INSET - CONTROL_SIZE,
              viewport.height - OVERLAY_INSET - controlsHeight,
              viewport.width - OVERLAY_INSET,
              viewport.height - OVERLAY_INSET,
            ),
          ]
        : []),
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

/** Dónde va el rótulo de cada zona, del terreno sin ubicar y de los grupos sin ubicación, y de cada Arco. */
export interface LabelPlan {
  areas: LabelAreas;
  /** De qué lado va el nombre de cada Ápice elegido, ya contado entre los rótulos para que ninguno lo tape. */
  tags: Map<string, TagPlacement>;
  zones: Map<string, Placement>;
  terrain: Placement | null;
  groups: Map<string, Placement>;
  paths: Map<string, ArcLabelBox | null>;
}

/** Un Ápice elegido: su celda y su nombre, que se ve junto a ella siempre. */
export interface PressedApice {
  spot: MapSpot;
  name: string;
}

/** Una Acción Común con su Arco ya calculado. */
export interface DrawnPath {
  path: MapPath;
  arc: Arc;
}

/** Los centros de todo lo que lleva patrón o tinta en el nivel (Ápices, «+N», grupos y los del terreno sin ubicar): el Arco los esquiva. */
export function apiceCenters(layout: MapLayout): PathPoint[] {
  const centers: PathPoint[] = [];
  for (const block of layout.blocks) {
    for (const spot of block.spots) centers.push({ x: spot.x, y: spot.y });
    if (block.moreCell !== null) centers.push({ x: block.moreCell.x, y: block.moreCell.y });
  }
  for (const spot of layout.terrain?.spots ?? []) centers.push({ x: spot.x, y: spot.y });
  for (const item of layout.groups) centers.push({ x: item.x, y: item.y });
  return centers;
}

/** La caja de una celda: lo que los rótulos de zona no pueden tapar. */
const cellRect = (points: readonly MapVertex[]): LabelRect => ({
  left: Math.min(...points.map(([x]) => x)),
  right: Math.max(...points.map(([x]) => x)),
  top: Math.min(...points.map(([, y]) => y)),
  bottom: Math.max(...points.map(([, y]) => y)),
});

/**
 * Coloca todos los rótulos del lienzo (RF-4 (021) · 4.3, D-T30 (021)): primero los de zona, terreno y grupos sin ubicación,
 * que se voltean si no caben (los de zona, tampoco sobre una celda de Ápice o «+N»); luego los de los Arcos, el elegido
 * primero, cada uno en el primer lugar junto a su curva que no tapa un Ápice, otro rótulo, la leyenda ni los controles
 * (`placeArcLabel`). Un Arco sin sitio queda sin rótulo.
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
  // Las celdas de Ápice y los «+N» tampoco se tapan con el rótulo de una zona vecina.
  const cells: LabelRect[] = [];
  for (const block of layout.blocks) {
    for (const spot of block.spots) cells.push(cellRect(spot.points));
    if (block.moreCell !== null) cells.push(cellRect(block.moreCell.points));
  }
  for (const block of layout.blocks) {
    const width = pathLabelWidth(zoneText(block).length);
    const bottomEdge = Math.max(...block.outline.map(([, y]) => y));
    const placement = placeFlipping(
      { x: block.x, y: block.y },
      [above(block.label.x, -width / 2, width, block.label.y), below(block.label.x, -width / 2, width, bottomEdge + LABEL_OFFSET)],
      areas,
      [...taken, ...cells],
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
  const paths = new Map<string, ArcLabelBox | null>();
  const apices = apiceCenters(layout);
  const ordered = [...drawn].sort((a, b) => Number(b.path.id === selectedPathId) - Number(a.path.id === selectedPathId));
  for (const { path, arc } of ordered) {
    if (path.draft === true) continue;
    const box = placeArcLabel(arc, pathText(path), { apices, rects: [...taken, ...areas.blocked] }, areas.view);
    paths.set(path.id, box);
    if (box !== null) taken.push({ left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h });
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
  /** Apagada: lo que dice (`OFF_BY_FILTER`, `OFF_BY_PICK`) o `undefined` si está encendida. */
  off: string | undefined;
  /** Lo que dice una celda marcada en «Conectar» (`CHOSEN_FOR_PATH`), o `undefined`. */
  chosenText?: string | undefined;
  /**
   * Marcada en «Conectar» sin ser la elegida: su nombre sale solo al apuntarla o enfocarla, de una en una. Varias marcadas a la
   * vez no pueden mostrar todos sus nombres sin pisarse ni caer sobre un patrón (regla 5); la lista del panel ya las nombra.
   */
  tagOnPoint?: boolean;
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
  off,
  chosenText,
  tagOnPoint = false,
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
      data-off={off === undefined ? undefined : 'true'}
      data-tag={tagOnPoint ? 'point' : undefined}
      aria-description={off ?? chosenText}
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
const NO_IDS: ReadonlySet<string> = new Set();

/** Lo que lleva una celda de tinta apagada: la marca para la hoja de estilos y lo que dice, sin depender del color. */
const offAttributes = (text: string | undefined): Record<string, string | undefined> =>
  text === undefined ? {} : { 'data-off': 'true', 'aria-description': text };

/** El glifo del eje del rótulo del Arco, en píxeles. */
const PATH_GLYPH = 14;

/** Los vértices de la celda que muestra a `id` en este nivel: la suya, la del «+N» de su zona o la de su grupo. */
function cellOfApice(layout: MapLayout, id: string): readonly MapVertex[] | null {
  for (const block of layout.blocks) {
    const spot = block.spots.find((candidate) => candidate.id === id);
    if (spot !== undefined) return spot.points;
    if (block.moreCell !== null && block.ids.includes(id)) return block.moreCell.points;
  }
  const loose = layout.terrain?.spots.find((candidate) => candidate.id === id);
  if (loose !== undefined) return loose.points;
  return layout.groups.find((item) => item.ids.includes(id))?.points ?? null;
}

/** El punto medio del borde de abajo de la celda, 4 px más abajo: de ahí cuelga lo que la página muestra del Ápice elegido. */
const ANCHOR_DROP = 4;
function bottomAnchor(points: readonly MapVertex[]): PathPoint {
  const bottom = Math.max(...points.map(([, y]) => y));
  const edge = points.filter(([, y]) => y >= bottom - 0.5);
  return { x: edge.reduce((sum, [x]) => sum + x, 0) / edge.length, y: bottom + ANCHOR_DROP };
}

/**
 * Para encuadrar una Acción Común elegida: el nivel en que cada uno de sus Ápices es una parada distinta (si varios caen en
 * un mismo grupo, el Arco se encoge o desaparece). Se prefiere el más cercano aunque no quepan todos en la ventana.
 */
export const distinctStops =
  (ids: readonly string[]) =>
  (layout: MapLayout): boolean => {
    const points = pathPoints(layout, ids);
    return points.length >= 2 && new Set(points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)).size === ids.length;
  };

/** Lo menos que se mueve el punto de `onAnchor` para volver a avisar, en píxeles. */
const ANCHOR_EPSILON = 0.5;

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
  dimmedIds,
  onAnchor,
  level,
  onLevelChange,
  hideZoomControls = false,
  startClose = false,
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
  const home = useMemo(
    () => (startClose ? frameOn(shown, shown.map((apice) => apice.id), viewport) : frameMap(shown, viewport)),
    [shown, viewport, startClose],
  );
  /** La escala del nivel más lejano cuando hubo que alejarlo para que cupiera todo. */
  const farScale = home.level === 2 ? home.scale : undefined;
  /** El encuadre llevado a `wanted` (`frameAtLevel`): el mismo centro, pero nunca una ventana vacía; con un Ápice elegido, centrado en él. */
  const atLevel = (base: MapFrame, wanted: MapLevel): MapFrame => frameAtLevel(shown, base, wanted, viewport, selectedId, farScale);
  // Con `level` desde fuera manda la página: el encuadre guardado se lleva a ese nivel.
  const rawFrame = custom !== null && custom.key === idsKey ? custom.frame : home;
  const frame = useMemo(
    () => (level === undefined ? rawFrame : frameAtLevel(shown, rawFrame, level, viewport, selectedId, farScale)),
    // `selectedId` solo cuenta al cambiar de nivel; no se recentra cada vez que se elige otro Ápice.
    [rawFrame, level, shown, viewport, farScale],
  );
  const layout = useMemo(() => layoutMap(shown, frame.level, frame.scale), [shown, frame.level, frame.scale]);

  const move = (next: (current: MapFrame) => MapFrame) =>
    setCustom((current) => {
      const base = current !== null && current.key === idsKey ? current.frame : home;
      return { key: idsKey, frame: next(level === undefined ? base : atLevel(base, level)) };
    });

  /** Pone el encuadre que el mapa calculó (acercar un grupo, encuadrar una Acción Común) y avisa si cambió el nivel. */
  const place = (next: MapFrame) => {
    setCustom({ key: idsKey, frame: next });
    if (next.level !== frame.level) onLevelChange?.(next.level);
  };

  /** `step` 1 aleja y -1 acerca; el centro de la ventana se conserva (RF-7 (021) · 7.1). Con `level` desde fuera solo lo pide. */
  const zoom = (step: 1 | -1) => {
    const wanted = clampLevel(frame.level + step);
    if (wanted === frame.level) return;
    if (level === undefined) setCustom({ key: idsKey, frame: atLevel(frame, wanted) });
    onLevelChange?.(wanted);
  };

  /** «Ver todo»: el encuadre inicial, con su nivel. */
  const reset = () => {
    setCustom(null);
    if (home.level !== frame.level) onLevelChange?.(home.level);
  };

  // La trama (RF-4 (021) · 4.1, «E3 · Celda»): solo las siete celdas de cada zona del nivel cercano; los niveles alejados no
  // llevan. Se rehace al cambiar de nivel, de ventana o de casilla, no en cada píxel de arrastre.
  const snapX = Math.round(frame.x / TESSELLATION_SNAP);
  const snapY = Math.round(frame.y / TESSELLATION_SNAP);
  const tessellation = useMemo(
    () =>
      zonesTessellationPath(layout, {
        // El área es su centro y su tamaño, no su esquina.
        x: snapX * TESSELLATION_SNAP,
        y: snapY * TESSELLATION_SNAP,
        width: viewport.width + 2 * TESSELLATION_SNAP,
        height: viewport.height + 2 * TESSELLATION_SNAP,
      }),
    [layout, snapX, snapY, viewport],
  );

  /** Las Acciones Comunes con al menos dos puntos a la vista, cada una con su Arco (RF-18 (021) · 18.7). */
  const drawn = useMemo<DrawnPath[]>(() => {
    const apices = apiceCenters(layout);
    return paths.flatMap((path) => {
      const points = pathPoints(layout, path.apiceIds);
      if (points.length < 2) return [];
      const arc = buildArc(points, layout.radius, { apices });
      return arc === null ? [] : [{ path, arc }];
    });
  }, [paths, layout]);

  // Lo elegido apaga el resto: el Ápice elegido (si está en el mapa) y los de la Acción Común elegida se quedan encendidos.
  const dimmed = dimmedIds ?? NO_IDS;
  const chosen = selectedId !== null && byId.has(selectedId) ? selectedId : null;
  const pickedPath = selectedPathId === null ? undefined : paths.find((candidate) => candidate.id === selectedPathId);
  // «Conectar»: mientras haya Ápices marcados (`chosenIds`), los demás se apagan como al elegir uno (celda.md, regla 4).
  const marked = useMemo(() => (chosenIds === undefined ? [] : [...chosenIds].filter((id) => byId.has(id))), [chosenIds, byId]);
  const picked = chosen !== null || pickedPath !== undefined || marked.length > 0;
  const keep = useMemo(
    () => new Set<string>([...(chosen === null ? [] : [chosen]), ...(pickedPath?.apiceIds ?? []), ...marked]),
    [chosen, pickedPath, marked],
  );
  /** Qué dice una celda apagada, o `undefined` si está encendida: por el filtro o por lo elegido. */
  const offOf = (id: string): string | undefined =>
    dimmed.has(id) ? OFF_BY_FILTER : picked && !keep.has(id) ? OFF_BY_PICK : undefined;
  /** Lo mismo para una celda que reúne varios Ápices (el «+N» y el grupo): apagada solo si todos lo están. */
  const offOfAll = (ids: readonly string[]): string | undefined => {
    if (ids.length === 0 || ids.some((id) => offOf(id) === undefined)) return undefined;
    return ids.every((id) => dimmed.has(id)) ? OFF_BY_FILTER : OFF_BY_PICK;
  };

  /** Los Arcos con su estado: el borrador nunca se apaga; los demás, si no son de lo elegido o todos sus Ápices están fuera del filtro. */
  const arcItems = useMemo<ArcItem[]>(
    () =>
      drawn.map(({ path, arc }) => {
        const draft = path.draft === true;
        const visible = path.apiceIds.filter((id) => byId.has(id));
        const off =
          !draft &&
          ((chosen !== null && !path.apiceIds.includes(chosen)) ||
            (pickedPath !== undefined && path.id !== pickedPath.id) ||
            (marked.length > 0 && chosen === null && pickedPath === undefined) ||
            (visible.length > 0 && visible.every((id) => dimmed.has(id))));
        return { id: path.id, arc, closed: path.closed, draft, selected: path.id === selectedPathId, off };
      }),
    [drawn, byId, chosen, pickedPath, selectedPathId, dimmed, marked],
  );
  const offPaths = useMemo(() => new Set(arcItems.filter((item) => item.off).map((item) => item.id)), [arcItems]);

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
        // Solo el elegido muestra su nombre sin apuntarlo: los marcados en «Conectar» lo muestran al apuntarlos (`tagOnPoint`).
        if (apice !== undefined && spot.id === selectedId) pressed.push({ spot, name: apice.name });
      }
    return planLabels(layout, drawn, labelAreas(viewport, barPx, offsetX, offsetY, !hideZoomControls), selectedPathId, pressed);
  }, [layout, drawn, viewport, barPx, offsetX, offsetY, hideZoomControls, selectedPathId, byId, selectedId]);

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
      if (label != null) all.push({ id: pathId(path.id), x: label.x + label.w / 2, y: label.y + label.h / 2 });
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
    place(frameOn(shown, group.ids, viewport));
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
    else place(frameOn(shown, [selectedId], viewport));
  });

  /** La ventana medida ahora mismo: en el primer cuadro el estado todavía trae la de respaldo (RF-4 (024)). */
  const measuredViewport = (): MapViewport => {
    const element = ref.current;
    return element !== null && element.clientWidth > 0 && element.clientHeight > 0
      ? { width: element.clientWidth, height: element.clientHeight }
      : viewport;
  };

  // RF-4 (024) · 4.1 a 4.4, D-T5 (024): al abrir una Acción Común, el mapa se encuadra en sus Ápices, en el nivel más cercano en
  // que caben y la ruta se dibuja con paradas distintas (`distinctStops`: nunca dos Ápices en un mismo grupo, que borraría el Arco;
  // normalmente, el nivel cercano) y, si ninguno las junta, en el cercano centrado en una; una sola vez por Acción Común elegida,
  // y el Ápice elegido manda sobre ella.
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
    place(frameFit(shown, ids, measuredViewport(), undefined, ids.length > 1 ? distinctStops(ids) : undefined));
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
    place(frameFit(shown, ids, measuredViewport(), undefined, routeDrawn, focus.reserve?.() ?? 0));
  });

  // Dónde cae lo elegido, en el lienzo: la celda del Ápice elegido, o el medio del Arco de la Acción Común elegida.
  const anchorWorld = useMemo<PathPoint | null>(() => {
    if (chosen !== null) {
      const points = cellOfApice(layout, chosen);
      return points === null ? null : bottomAnchor(points);
    }
    if (pickedPath === undefined) return null;
    const arc = drawn.find(({ path }) => path.id === pickedPath.id)?.arc;
    const samples = arc?.segments.flatMap((segment) => segment.samples) ?? [];
    return samples[Math.floor((samples.length - 1) / 2)] ?? null;
  }, [layout, drawn, chosen, pickedPath]);

  // `onAnchor`: tras cada cambio de encuadre, arrastre o cambio de tamaño de la ventana, una vez por cuadro y solo si el punto
  // se movió más de medio píxel. Fuera de la ventana del mapa, o sin elección, es `null`.
  const anchorNow = useRef(onAnchor);
  anchorNow.current = onAnchor;
  const anchored = useRef<{ x: number; y: number } | null>(null);
  const wantsAnchor = onAnchor !== undefined;
  const anchorX = anchorWorld?.x;
  const anchorY = anchorWorld?.y;
  useEffect(() => {
    if (!wantsAnchor) return undefined;
    let frameId = 0;
    const measure = () => {
      frameId = 0;
      const element = ref.current;
      let next: { x: number; y: number } | null = null;
      if (element !== null && anchorX !== undefined && anchorY !== undefined) {
        const x = anchorX + offsetX;
        const y = anchorY + offsetY;
        if (x >= 0 && x <= viewport.width && y >= 0 && y <= viewport.height) {
          const box = element.getBoundingClientRect();
          next = { x: box.left + element.clientLeft + x, y: box.top + element.clientTop + y };
        }
      }
      const last = anchored.current;
      const same =
        next === null || last === null
          ? next === last
          : Math.abs(next.x - last.x) <= ANCHOR_EPSILON && Math.abs(next.y - last.y) <= ANCHOR_EPSILON;
      if (same) return;
      anchored.current = next;
      anchorNow.current?.(next);
    };
    const schedule = () => {
      if (frameId === 0) frameId = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      if (frameId !== 0) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [wantsAnchor, anchorX, anchorY, offsetX, offsetY, viewport]);

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
        off={offOf(apice.id)}
        chosenText={chosenIds?.has(apice.id) === true ? CHOSEN_FOR_PATH : undefined}
        tagOnPoint={chosenIds?.has(apice.id) === true && apice.id !== selectedId}
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

  const more = (block: MapBlock) => {
    if (block.moreCell === null) return null;
    // El «+N» reúne a los Ápices que no tienen celda propia en la zona.
    const inside = new Set(block.spots.map((spot) => spot.id));
    const hidden = block.ids.filter((id) => !inside.has(id));
    return inkCell(
      block.moreCell,
      'game-map__more',
      moreId(block.key),
      `${countText(block.more)} más en esta zona`,
      () => setMoreKey(block.key),
      `+${block.more}`,
      {
        'aria-haspopup': 'dialog',
        ...offAttributes(offOfAll(hidden.length > 0 ? hidden : block.ids)),
      },
    );
  };

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
          offAttributes(offOfAll(item.ids)),
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

  /** El rótulo del Arco: el glifo del eje y el nombre en tinta sobre papel, sin caja; abre la Acción Común. */
  const pathLabelButton = (path: MapPath, box: ArcLabelBox) => (
    <button
      key={path.id}
      type="button"
      className="block game-map__path-label"
      aria-label={`Acción Común: ${pathText(path)}`}
      aria-pressed={path.id === selectedPathId}
      data-closed={path.closed ? 'true' : undefined}
      data-off={offPaths.has(path.id) ? 'true' : undefined}
      style={{ left: box.x, top: box.y, maxInlineSize: box.w, blockSize: box.h }}
      onClick={() => onSelectPath?.(path.id)}
      {...spotProps(pathId(path.id))}
    >
      {path.axis != null && <Glifo axis={path.axis} size={PATH_GLYPH} tile={false} mode="macizo" className="game-map__path-glyph" />}
      <span className="game-map__path-name">{pathText(path)}</span>
    </button>
  );

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
        data-picked={picked ? 'true' : undefined}
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
          </svg>
          {/* El borde de zona va encima de las celdas (que son botones HTML) para verse entero, como en el sistema. */}
          <svg className="game-map__ground game-map__outlines" width="1" height="1" aria-hidden="true" focusable="false">
            {layout.blocks.map((block) => (
              <polygon key={block.key} className="game-map__zone-outline" points={pointsText(block.outline)} />
            ))}
          </svg>
          {/* Los Arcos apagados (en `trama`) van bajo los Ápices, antes que las celdas en el documento. */}
          <ArcLayer arcs={arcItems} layer="off" />
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
          {/* Los Arcos vivos van sobre el borde y las celdas (sus discos caen dentro de ellas) y bajo los rótulos y la celda apuntada. */}
          <ArcLayer arcs={arcItems} layer="live" />
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
        {!hideZoomControls && (
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
            <button type="button" className="block icon-button game-map__control" aria-label="Ver todo" onClick={reset}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
              </svg>
            </button>
          </div>
        )}
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
                    <CeldaSuperficie axes={apice.axes} status={apice.status} ancho={48} grosor={2} />
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
