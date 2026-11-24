// Dominio del mapa teselado con H3 (sistema «APICCA · Mapa», 23-11-2026; RF-5 (021) · 5.3, RF-6 (021), RF-7 (021),
// RF-8 (021) · 8.4, RF-9 (021), RNF-5 (021), D-T16 (021)): dónde va cada Ápice en el lienzo. Cada zona (celda H3 de
// resolución 7, que llega calculada del servidor, D-T13 (021)) son siete celdas de resolución 8: la central y su anillo.
// Cada Ápice ocupa una celda y, si la zona tiene más de las que caben, la central pasa a ser el «+N». Los niveles
// alejados dibujan la celda de resolución 6 o 4 que reúne a las zonas. Puro, sin React ni DOM; las celdas salen de
// `h3cells.ts`, que es lo único que conoce la biblioteca.
import {
  LEVEL_RESOLUTION,
  cellBoundary,
  cellCenter,
  cellOfPoint,
  cellsAround,
  edgeKm,
  isCellOf,
  outlineOf,
  zoneCells,
  zoneCode,
} from './h3cells';
import type { Location, Point } from './location';

/** Nivel de acercamiento (RF-7 (021) · 7.1): 0 es *barrio* (celdas de Ápices), 1 es *ciudad* y 2 es *región* (grupos). */
export type MapLevel = 0 | 1 | 2;

/** Lo que el mapa necesita de un Ápice. */
export interface MapApice {
  id: string;
  location?: Location | null | undefined;
}

/** Un vértice, en píxeles del lienzo. */
export type MapVertex = readonly [x: number, y: number];

/** Un lugar enfocable del lienzo: su id y el centro, en píxeles. */
export interface MapPlace {
  id: string;
  x: number;
  y: number;
}

/** Una celda dibujada: el índice H3, su centro y sus vértices, en píxeles. */
export interface MapCell {
  cell: string;
  x: number;
  y: number;
  points: readonly MapVertex[];
}

/** La celda de un Ápice. */
export interface MapSpot extends MapPlace, MapCell {}

/**
 * Zona: una celda H3 de resolución 7 con sus siete celdas (RF-6 (021)). `spots` lleva los Ápices a la vista y `more`,
 * cuántos no caben; en ese caso la celda central es el «+N» (`moreCell`) y los Ápices van en el anillo.
 */
export interface MapBlock {
  /** La celda de la zona. */
  key: string;
  /** Su código corto (`zoneCode`). */
  code: string;
  /** El centro de la zona, en píxeles. */
  x: number;
  y: number;
  /** Todos los Ápices de la zona, en su orden estable (RF-6 (021) · 6.4). */
  ids: string[];
  /** Las siete celdas de la zona, la central primero. */
  cells: string[];
  spots: MapSpot[];
  more: number;
  moreCell: MapCell | null;
  /** El borde exterior de las siete celdas. */
  outline: readonly MapVertex[];
  /** Dónde se apoya el rótulo de la zona: centrado, justo encima del borde. */
  label: { x: number; y: number };
}

/** Grupo de un nivel alejado (RF-7 (021) · 7.2): una celda de resolución 6 o 4. `unlocated` marca el de los Ápices sin ubicación (RF-9 (021)). */
export interface MapGroup extends MapCell {
  key: string;
  ids: string[];
  unlocated: boolean;
}

/** Terreno aparte de los Ápices sin ubicación, en el nivel cercano (RF-9 (021) · 9.1). `x` e `y` son su esquina. */
export interface MapTerrain {
  x: number;
  y: number;
  width: number;
  height: number;
  spots: MapSpot[];
  /** Dónde se apoya su rótulo: a la izquierda, justo encima del borde. */
  label: { x: number; y: number };
}

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MapLayout {
  level: MapLevel;
  /** Píxeles por kilómetro. */
  scale: number;
  /** El punto de la Tierra que es el (0, 0) del lienzo. */
  origin: Point;
  /** Radio, en píxeles, de una celda de este nivel. */
  radius: number;
  blocks: MapBlock[];
  groups: MapGroup[];
  terrain: MapTerrain | null;
  /** Lo que ocupa todo lo dibujado; `null` si no hay nada. */
  bounds: MapBounds | null;
}

/** Encuadre: nivel, escala y el punto del lienzo que va al centro de la ventana. */
export interface MapFrame {
  level: MapLevel;
  scale: number;
  x: number;
  y: number;
}

export interface MapViewport {
  width: number;
  height: number;
}

/**
 * Píxeles por kilómetro de cada nivel: cada uno, siete veces más lejos que el anterior (RF-7 (021) · 7.1), así que la
 * celda de cada nivel mide lo mismo en pantalla (unos 53 px de arista).
 */
export const LEVEL_SCALE: readonly [number, number, number] = [100, 100 / 7, 100 / 49];

/** Ancho aproximado de una celda del nivel cercano, en píxeles: lo que una columna central del mapa deja a un Ápice. */
export const CELL_WIDTH = Math.round(Math.sqrt(3) * edgeKm(LEVEL_RESOLUTION[0]) * LEVEL_SCALE[0]);
/** Clave del grupo de los Ápices sin ubicación. */
export const UNLOCATED_KEY = 'sin-ubicar';

const EARTH_RADIUS_KM = 6371.0088;
const FRAME_MARGIN = 24;
const TERRAIN_COLUMNS = 6;
const TERRAIN_PADDING = 12;
/** Cuánto sube un rótulo sobre su borde; cuenta para lo que ocupa el mapa. */
const LABEL_HEIGHT = 30;
const LABEL_WIDTH = 190;

const CELL_PATTERN = /^[0-9a-f]{15}$/;
const RESOLUTION_SHIFT = 52n;

/**
 * Celda madre de una celda H3, por los bits del índice: la resolución va en los bits 52 a 55 y cada dígito más fino que
 * ella queda en 7 (D-T16 (021)). Lo que no es un índice H3, o ya es de esa resolución o más gruesa, se devuelve igual.
 */
export function parentCell(cell: string, resolution: number): string {
  if (!CELL_PATTERN.test(cell)) return cell;
  const index = BigInt(`0x${cell}`);
  const current = Number((index >> RESOLUTION_SHIFT) & 0xfn);
  if (resolution >= current || resolution < 0) return cell;
  let parent = (index & ~(0xfn << RESOLUTION_SHIFT)) | (BigInt(resolution) << RESOLUTION_SHIFT);
  for (let digit = resolution + 1; digit <= 15; digit += 1) parent |= 0x7n << BigInt((15 - digit) * 3);
  return parent.toString(16);
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const degrees = (rad: number): number => (rad * 180) / Math.PI;
/** Diferencia de longitudes por el camino corto, para que el meridiano 180 no separe a dos vecinos. */
const wrapDegrees = (value: number): number => ((((value + 180) % 360) + 360) % 360) - 180;

/**
 * Proyección local en kilómetros alrededor de `origin`, con el norte arriba (RF-5 (021) · 5.3). Conserva dirección y
 * distancia mientras el conjunto no cubra un continente.
 */
export function projectKm(point: Point, origin: Point): { x: number; y: number } {
  const x = EARTH_RADIUS_KM * radians(wrapDegrees(point.lng - origin.lng)) * Math.cos(radians(origin.lat));
  const y = -EARTH_RADIUS_KM * radians(point.lat - origin.lat);
  // `+ 0` convierte -0 en 0.
  return { x: x + 0, y: y + 0 };
}

/** Lo contrario de `projectKm`: el punto de la Tierra que cae en esos kilómetros. */
export function unprojectKm(km: { x: number; y: number }, origin: Point): Point {
  const lat = origin.lat - degrees(km.y / EARTH_RADIUS_KM);
  const lng = origin.lng + degrees(km.x / (EARTH_RADIUS_KM * Math.cos(radians(origin.lat))));
  return { lat: Math.max(-90, Math.min(90, lat)), lng: wrapDegrees(lng) };
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const byPlace = <T extends { x: number; y: number; key: string }>(a: T, b: T): number => a.y - b.y || a.x - b.x || byText(a.key, b.key);

/** Una zona con Ápices: su celda y sus Ápices en orden estable. */
interface ZoneEntry {
  key: string;
  center: Point;
  ids: string[];
}

/**
 * La celda de zona de una ubicación: la publicada por el servidor si es una celda H3 de resolución 7; si no (el ápice
 * aún no pasó por el recálculo, RF-5 (021) · 5.4), la que contiene su punto. `null` si ni el punto sirve.
 */
function zoneCellOf(location: Location): string | null {
  if (location.zone && isCellOf(location.zone.cell, 7)) return location.zone.cell;
  try {
    return cellOfPoint(location, 7);
  } catch {
    return null;
  }
}

/** Centro del conjunto: la mitad de su extensión. No depende del orden de llegada. */
function originOf(centers: readonly Point[]): Point {
  const first = centers[0];
  if (!first) return { lat: 0, lng: 0 };
  let minLat = first.lat;
  let maxLat = first.lat;
  let minLng = 0;
  let maxLng = 0;
  for (const center of centers) {
    const delta = wrapDegrees(center.lng - first.lng);
    minLat = Math.min(minLat, center.lat);
    maxLat = Math.max(maxLat, center.lat);
    minLng = Math.min(minLng, delta);
    maxLng = Math.max(maxLng, delta);
  }
  return { lat: (minLat + maxLat) / 2, lng: first.lng + (minLng + maxLng) / 2 };
}

function zonesOf(apices: readonly MapApice[]): { zones: ZoneEntry[]; unlocated: string[]; origin: Point } {
  const byCell = new Map<string, string[]>();
  const unlocated: string[] = [];
  for (const apice of apices) {
    const cell = apice.location ? zoneCellOf(apice.location) : null;
    if (cell === null) {
      unlocated.push(apice.id);
      continue;
    }
    const ids = byCell.get(cell);
    if (ids) ids.push(apice.id);
    else byCell.set(cell, [apice.id]);
  }
  const zones = [...byCell.entries()]
    .sort(([a], [b]) => byText(a, b))
    .map(([key, ids]): ZoneEntry => ({ key, center: cellCenter(zoneCells(key)[0] ?? key), ids: ids.sort(byText) }));
  return { zones, unlocated: unlocated.sort(byText), origin: originOf(zones.map((zone) => zone.center)) };
}

const EMPTY_BOUNDS: MapBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

const grow = (bounds: MapBounds, minX: number, minY: number, maxX: number, maxY: number): MapBounds => ({
  minX: Math.min(bounds.minX, minX),
  minY: Math.min(bounds.minY, minY),
  maxX: Math.max(bounds.maxX, maxX),
  maxY: Math.max(bounds.maxY, maxY),
});

const growPoints = (bounds: MapBounds, points: readonly MapVertex[]): MapBounds =>
  points.reduce((all, [x, y]) => grow(all, x, y, x, y), bounds);

const orNull = (bounds: MapBounds): MapBounds | null => (Number.isFinite(bounds.minX) ? bounds : null);

/** Lo que ocupa un punto de apoyo de rótulo hacia arriba: el rótulo no debe quedar fuera del encuadre. */
const withLabel = (bounds: MapBounds, x: number, y: number, centered: boolean): MapBounds =>
  grow(bounds, centered ? x - LABEL_WIDTH / 2 : x, y - LABEL_HEIGHT, centered ? x + LABEL_WIDTH / 2 : x + LABEL_WIDTH, y);

/** Proyecta una celda H3 al lienzo. */
export function drawCell(cell: string, origin: Point, scale: number): MapCell {
  const project = (point: Point): MapVertex => {
    const { x, y } = projectKm(point, origin);
    return [x * scale, y * scale];
  };
  const center = project(cellCenter(cell));
  return { cell, x: center[0], y: center[1], points: cellBoundary(cell).map(project) };
}

/** Un hexágono de punta arriba, como las celdas de resolución par: para lo que no tiene celda H3 (el terreno sin ubicar). */
function syntheticCell(cell: string, x: number, y: number, radius: number): MapCell {
  const points = Array.from({ length: 6 }, (_, k): MapVertex => {
    const angle = (Math.PI / 3) * k - Math.PI / 2;
    return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
  });
  return { cell, x, y, points };
}

/** Lo que ocupa una zona dibujada, con su rótulo. */
export function blockBounds(block: MapBlock): MapBounds {
  return withLabel(growPoints(EMPTY_BOUNDS, block.outline), block.label.x, block.label.y, true);
}

function layoutBlocks(zones: readonly ZoneEntry[], unlocated: readonly string[], origin: Point, scale: number): MapLayout {
  const radius = edgeKm(LEVEL_RESOLUTION[0]) * scale;
  let bounds = EMPTY_BOUNDS;
  const blocks = zones
    .map((zone): MapBlock => {
      const cells = zoneCells(zone.key);
      const drawn = cells.map((cell) => drawCell(cell, origin, scale));
      const [middle, ...ring] = drawn;
      const room = ring.length;
      // Con más Ápices que celdas, la central pasa a ser el «+N» y los Ápices van en el anillo.
      const overflow = zone.ids.length > drawn.length;
      const slots = overflow ? ring : drawn;
      const spots = slots.slice(0, zone.ids.length).map((cell, index): MapSpot => ({ id: zone.ids[index] ?? '', ...cell }));
      const outline = outlineOf(cells).map((point): MapVertex => {
        const { x, y } = projectKm(point, origin);
        return [x * scale, y * scale];
      });
      const box = growPoints(EMPTY_BOUNDS, outline);
      return {
        key: zone.key,
        code: zoneCode(zone.key),
        x: middle?.x ?? 0,
        y: middle?.y ?? 0,
        ids: zone.ids,
        cells,
        spots,
        more: overflow ? zone.ids.length - Math.min(room, zone.ids.length) : 0,
        moreCell: overflow && middle ? middle : null,
        outline,
        label: { x: (box.minX + box.maxX) / 2, y: box.minY - 6 },
      };
    })
    .sort(byPlace);
  for (const block of blocks) {
    const box = blockBounds(block);
    bounds = grow(bounds, box.minX, box.minY, box.maxX, box.maxY);
  }

  let terrain: MapTerrain | null = null;
  if (unlocated.length > 0) {
    const columns = Math.min(TERRAIN_COLUMNS, unlocated.length);
    const rows = Math.ceil(unlocated.length / columns);
    const cellWidth = Math.sqrt(3) * radius;
    const width = 2 * TERRAIN_PADDING + columns * cellWidth + (rows > 1 ? cellWidth / 2 : 0);
    const height = 2 * TERRAIN_PADDING + 2 * radius + (rows - 1) * 1.5 * radius;
    const located = orNull(bounds);
    // Al sur de las zonas y centrado con ellas; si no hay ninguna, en el centro del lienzo.
    const x = (located ? (located.minX + located.maxX) / 2 : 0) - width / 2;
    const y = located ? located.maxY + 2 * radius + LABEL_HEIGHT : -height / 2;
    const spots = unlocated.map(
      (id, index): MapSpot => ({
        id,
        ...syntheticCell(
          `${UNLOCATED_KEY}:${index}`,
          x + TERRAIN_PADDING + cellWidth / 2 + (index % columns) * cellWidth + (Math.floor(index / columns) % 2 === 1 ? cellWidth / 2 : 0),
          y + TERRAIN_PADDING + radius + Math.floor(index / columns) * 1.5 * radius,
          radius,
        ),
      }),
    );
    terrain = { x, y, width, height, spots, label: { x, y: y - 6 } };
    bounds = withLabel(grow(bounds, x, y, x + width, y + height), x, y - 6, false);
  }
  return { level: 0, scale, origin, radius, blocks, groups: [], terrain, bounds: orNull(bounds) };
}

function layoutGroups(zones: readonly ZoneEntry[], unlocated: readonly string[], origin: Point, level: 1 | 2, scale: number): MapLayout {
  const resolution = LEVEL_RESOLUTION[level];
  const radius = edgeKm(resolution) * scale;
  const byParent = new Map<string, string[]>();
  for (const zone of zones) {
    const key = parentCell(zone.key, resolution);
    const ids = byParent.get(key);
    if (ids) ids.push(...zone.ids);
    else byParent.set(key, [...zone.ids]);
  }
  let bounds = EMPTY_BOUNDS;
  const groups = [...byParent.entries()]
    .map(([key, ids]): MapGroup => ({ key, ids: ids.sort(byText), unlocated: false, ...drawCell(key, origin, scale) }))
    .sort(byPlace);
  for (const group of groups) bounds = growPoints(bounds, group.points);
  if (unlocated.length > 0) {
    const located = orNull(bounds);
    // Al sur de todos los grupos, con espacio para su rótulo.
    const x = located ? (located.minX + located.maxX) / 2 : 0;
    const y = located ? located.maxY + 2 * radius + LABEL_HEIGHT : 0;
    const cell = syntheticCell(UNLOCATED_KEY, x, y, radius);
    groups.push({ key: UNLOCATED_KEY, ids: [...unlocated], unlocated: true, ...cell });
    bounds = growPoints(bounds, cell.points);
  }
  return { level, scale, origin, radius, blocks: [], groups, terrain: null, bounds: orNull(bounds) };
}

/**
 * Dónde va cada Ápice en el nivel pedido (RF-5 (021) · 5.3, RF-6 (021), RF-7 (021) · 7.2, RF-9 (021) · 9.1). `scale`
 * solo se cambia en el nivel más lejano, cuando el conjunto no cabe (RF-7 (021) · 7.4).
 */
export function layoutMap(apices: readonly MapApice[], level: MapLevel, scale: number = LEVEL_SCALE[level]): MapLayout {
  const { zones, unlocated, origin } = zonesOf(apices);
  return level === 0 ? layoutBlocks(zones, unlocated, origin, scale) : layoutGroups(zones, unlocated, origin, level, scale);
}

/** Cuántos anillos de celdas, a lo más, se piden para teselar la ventana: más allá, las celdas ya no se distinguen. */
const TESSELLATION_RING_LIMIT = 45;
/** Radio mínimo, en píxeles, para que valga la pena dibujar el teselado vacío. */
const TESSELLATION_MIN_RADIUS = 4;

/** Un área del lienzo, en píxeles: su centro y su tamaño. */
export interface MapArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * El teselado vacío que se ve debajo del mapa (sistema «APICCA · Mapa»: «el teselado siempre se ve»): las celdas H3 del
 * nivel que tocan el área, como un solo trazado SVG (`d`). Las celdas con contenido se pintan encima. Vacío si las
 * celdas serían menores de lo que se distingue.
 */
export function tessellationPath(layout: MapLayout, area: MapArea): string {
  if (layout.radius < TESSELLATION_MIN_RADIUS || area.width <= 0 || area.height <= 0) return '';
  const resolution = LEVEL_RESOLUTION[layout.level];
  const reach = Math.hypot(area.width, area.height) / 2 + 2 * layout.radius;
  const rings = Math.min(TESSELLATION_RING_LIMIT, Math.ceil(reach / (1.5 * layout.radius)) + 1);
  const centre = unprojectKm({ x: area.x / layout.scale, y: area.y / layout.scale }, layout.origin);
  const slack = 2 * layout.radius;
  const round = (value: number): number => Math.round(value * 10) / 10;
  let d = '';
  for (const cell of cellsAround(centre, resolution, rings)) {
    const middle = projectKm(cellCenter(cell), layout.origin);
    if (Math.abs(middle.x * layout.scale - area.x) > area.width / 2 + slack || Math.abs(middle.y * layout.scale - area.y) > area.height / 2 + slack) continue;
    const vertices = cellBoundary(cell).map((point) => {
      const { x, y } = projectKm(point, layout.origin);
      return `${round(x * layout.scale)} ${round(y * layout.scale)}`;
    });
    d += `M${vertices.join('L')}Z`;
  }
  return d;
}

const fitsIn = (bounds: MapBounds, viewport: MapViewport, margin: number): boolean =>
  bounds.maxX - bounds.minX <= viewport.width - 2 * margin && bounds.maxY - bounds.minY <= viewport.height - 2 * margin;

const centered = (layout: MapLayout, bounds: MapBounds): MapFrame => ({
  level: layout.level,
  scale: layout.scale,
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
});

/** Tope de pasos al alejar el nivel más lejano; con 0,8 por paso alcanza para cualquier conjunto. */
const MAX_FAR_STEPS = 48;

/**
 * Encuadre inicial: el nivel más cercano en que caben todos los Ápices; si no caben ni en el más lejano, ese nivel se
 * aleja hasta que quepan (RF-7 (021) · 7.4).
 */
export function frameMap(apices: readonly MapApice[], viewport: MapViewport, margin: number = FRAME_MARGIN): MapFrame {
  let layout = layoutMap(apices, 0);
  if (layout.bounds === null) return { level: 0, scale: LEVEL_SCALE[0], x: 0, y: 0 };
  for (const level of [0, 1, 2] as const) {
    layout = layoutMap(apices, level);
    if (layout.bounds !== null && fitsIn(layout.bounds, viewport, margin)) return centered(layout, layout.bounds);
  }
  let scale = LEVEL_SCALE[2];
  for (let step = 0; step < MAX_FAR_STEPS; step += 1) {
    scale *= 0.8;
    layout = layoutMap(apices, 2, scale);
    if (layout.bounds !== null && fitsIn(layout.bounds, viewport, margin)) break;
  }
  return centered(layout, layout.bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 });
}

/**
 * Encuadre del nivel cercano sobre las zonas de unos Ápices: lo que pasa al elegir un grupo (RF-7 (021) · 7.3). Si
 * no caben todas, va a la más cercana al centro del grupo.
 */
export function frameOn(
  apices: readonly MapApice[],
  ids: readonly string[],
  viewport: MapViewport,
  margin: number = FRAME_MARGIN,
): MapFrame {
  const layout = layoutMap(apices, 0);
  const wanted = new Set(ids);
  const places: { x: number; y: number; bounds: MapBounds }[] = [];
  for (const block of layout.blocks) {
    if (block.ids.some((id) => wanted.has(id))) places.push({ x: block.x, y: block.y, bounds: blockBounds(block) });
  }
  const { terrain } = layout;
  if (terrain?.spots.some((spot) => wanted.has(spot.id))) {
    places.push({
      x: terrain.x + terrain.width / 2,
      y: terrain.y + terrain.height / 2,
      bounds: { minX: terrain.x, minY: terrain.y - LABEL_HEIGHT, maxX: terrain.x + terrain.width, maxY: terrain.y + terrain.height },
    });
  }
  if (places.length === 0) return frameMap(apices, viewport, margin);
  const bounds = places.reduce((all, place) => grow(all, place.bounds.minX, place.bounds.minY, place.bounds.maxX, place.bounds.maxY), EMPTY_BOUNDS);
  const frame = centered(layout, bounds);
  if (fitsIn(bounds, viewport, margin)) return frame;
  let nearest = places[0]!;
  for (const place of places) {
    if (Math.hypot(place.x - frame.x, place.y - frame.y) < Math.hypot(nearest.x - frame.x, nearest.y - frame.y)) nearest = place;
  }
  return { ...frame, x: nearest.x, y: nearest.y };
}

/** Lo que ocupan los Ápices pedidos en un nivel: sus celdas, la zona entera si uno va en el «+N», o sus grupos. `null` si ninguno está. */
function boundsOfIds(layout: MapLayout, wanted: ReadonlySet<string>): MapBounds | null {
  let bounds = EMPTY_BOUNDS;
  for (const block of layout.blocks) {
    let hidden = false;
    for (const id of block.ids) {
      if (!wanted.has(id)) continue;
      const spot = block.spots.find((candidate) => candidate.id === id);
      if (spot) bounds = growPoints(bounds, spot.points);
      else hidden = true;
    }
    // Un Ápice que va en el «+N» no tiene celda propia: se toma toda la zona.
    if (hidden) bounds = growPoints(bounds, block.outline);
  }
  for (const spot of layout.terrain?.spots ?? []) if (wanted.has(spot.id)) bounds = growPoints(bounds, spot.points);
  for (const group of layout.groups) if (group.ids.some((id) => wanted.has(id))) bounds = growPoints(bounds, group.points);
  return orNull(bounds);
}

/**
 * Encuadre del nivel más cercano en que caben los Ápices `ids` (RF-4 (024) · 4.1, D-T5 (024)): a diferencia de `frameOn`,
 * que siempre acerca al nivel cercano, aquí se prefiere el primero en que todos caben, centrado en ellos. Si no caben ni
 * en el más lejano, ese nivel se aleja como en `frameMap`. Con `drawn`, entre los niveles en que caben se prefiere el
 * primero en que la Acción Común se dibuja; si en ninguno, el primero en que caben. Los ids que no están en `apices` se
 * ignoran; si no queda ninguno, devuelve el encuadre inicial (RF-7 (021) · 7.4).
 * Con `reservedBottom` (D-12 (024)), el borde de abajo de la ventana está ocupado por la tarjeta del recorrido: el ajuste se
 * mide con el área libre y el centro baja la mitad de lo reservado, de modo que los Ápices quedan en medio del área libre.
 * Con 0, que es lo normal, no cambia nada.
 */
export function frameFit(
  apices: readonly MapApice[],
  ids: readonly string[],
  viewport: MapViewport,
  margin: number = FRAME_MARGIN,
  drawn?: (layout: MapLayout) => boolean,
  reservedBottom: number = 0,
): MapFrame {
  const known = new Set(apices.map((apice) => apice.id));
  const wanted = new Set(ids.filter((id) => known.has(id)));
  if (wanted.size === 0) return frameMap(apices, viewport, margin);
  const reserved = Math.max(0, reservedBottom);
  const free: MapViewport = { width: viewport.width, height: Math.max(1, viewport.height - reserved) };
  const lowered = (frame: MapFrame): MapFrame => (reserved === 0 ? frame : { ...frame, y: frame.y + reserved / 2 });
  const seen: { first: MapFrame | null } = { first: null };
  const consider = (layout: MapLayout): MapFrame | null => {
    const bounds = boundsOfIds(layout, wanted);
    if (bounds === null || !fitsIn(bounds, free, margin)) return null;
    const frame = lowered(centered(layout, bounds));
    seen.first ??= frame;
    return drawn === undefined || drawn(layout) ? frame : null;
  };
  for (const level of [0, 1, 2] as const) {
    const frame = consider(layoutMap(apices, level));
    if (frame !== null) return frame;
  }
  if (seen.first !== null) return seen.first;
  let layout = layoutMap(apices, 2);
  let scale: number = LEVEL_SCALE[2];
  for (let step = 0; step < MAX_FAR_STEPS; step += 1) {
    scale *= 0.8;
    layout = layoutMap(apices, 2, scale);
    const bounds = boundsOfIds(layout, wanted);
    if (bounds !== null && fitsIn(bounds, free, margin)) break;
  }
  return lowered(centered(layout, boundsOfIds(layout, wanted) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }));
}

const DIRECTIONS: Record<string, readonly [x: number, y: number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

/**
 * El lugar más cercano en la dirección de la flecha, o `null` (RF-8 (021) · 8.4). Primero busca dentro del cono de 45
 * grados a cada lado; si ahí no hay nadie, toma al que menos se desvía de los que quedan hacia ese lado, para que
 * ninguna celda se quede sin camino.
 */
export function mapNeighbor(places: readonly MapPlace[], id: string, key: string): string | null {
  const direction = DIRECTIONS[key];
  const from = places.find((place) => place.id === id);
  if (!direction || !from) return null;
  let inCone: { id: string; cost: number } | null = null;
  let aside: { id: string; cost: number } | null = null;
  for (const place of places) {
    if (place.id === id) continue;
    const dx = place.x - from.x;
    const dy = place.y - from.y;
    const forward = dx * direction[0] + dy * direction[1];
    if (forward <= 0) continue;
    const drift = Math.abs(dx * direction[1] - dy * direction[0]);
    const cost = forward + 2 * drift;
    if (drift <= forward) {
      if (inCone === null || cost < inCone.cost) inCone = { id: place.id, cost };
    } else if (aside === null || cost < aside.cost) aside = { id: place.id, cost };
  }
  return (inCone ?? aside)?.id ?? null;
}

/** Largo máximo de la barra de la escala, en píxeles. */
const SCALE_BAR_MAX = 120;

/** Escala del mapa: la distancia redonda más larga (1, 2 o 5 por una potencia de diez) que cabe en la barra (RF-4 (021) · 4.3). */
export function scaleBar(scale: number, maxPx: number = SCALE_BAR_MAX): { meters: number; px: number; label: string } {
  let meters = 1;
  for (let magnitude = 1; magnitude <= 1e7; magnitude *= 10) {
    for (const step of [1, 2, 5]) {
      const candidate = step * magnitude;
      if ((candidate / 1000) * scale <= maxPx) meters = candidate;
    }
  }
  return { meters, px: (meters / 1000) * scale, label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m` };
}
