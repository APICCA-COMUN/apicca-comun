// Dominio del mapa propio (RF-5 (021) · 5.3, RF-6 (021), RF-7 (021), RF-8 (021) · 8.4, RF-9 (021), RNF-5 (021),
// D-T16 (021)): dónde va cada ápice en el lienzo, según su zona. Puro, sin React, sin DOM y sin biblioteca de celdas:
// la zona llega calculada del servidor (D-T13 (021)) y aquí solo se proyecta, se agrupa y se ordena.
import type { Location, Point } from './location';

/** Nivel de acercamiento (RF-7 (021) · 7.1): 0 es *barrio* (manzanas), 1 es *ciudad* y 2 es *región* (grupos). */
export type MapLevel = 0 | 1 | 2;

/** Lo que el mapa necesita de un ápice. */
export interface MapApice {
  id: string;
  location?: Location | null | undefined;
}

/** Un lugar del lienzo, en píxeles: el centro de la caja de un edificio o de un grupo. */
export interface MapSpot {
  id: string;
  x: number;
  y: number;
}

/** Manzana: los ápices de una zona (RF-6 (021)). `spots` lleva los edificios a la vista y `more`, cuántos no caben. */
export interface MapBlock {
  key: string;
  x: number;
  y: number;
  radius: number;
  /** Todos los ápices de la manzana, en su orden estable (RF-6 (021) · 6.4). */
  ids: string[];
  spots: MapSpot[];
  more: number;
}

/** Grupo de un nivel alejado (RF-7 (021) · 7.2). `unlocated` marca el de los ápices sin ubicación (RF-9 (021)). */
export interface MapGroup {
  key: string;
  x: number;
  y: number;
  ids: string[];
  unlocated: boolean;
}

/** Terreno aparte de los ápices sin ubicación, en el nivel cercano (RF-9 (021) · 9.1). `x` e `y` son su esquina. */
export interface MapTerrain {
  x: number;
  y: number;
  width: number;
  height: number;
  spots: MapSpot[];
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

/** Píxeles por kilómetro de cada nivel: cada uno, siete veces más lejos que el anterior (RF-7 (021) · 7.1). */
export const LEVEL_SCALE: readonly [number, number, number] = [200, 200 / 7, 200 / 49];

/** Resolución H3 de la celda que reúne a los ápices en cada nivel alejado (RF-7 (021) · 7.2). */
const GROUP_RESOLUTION: Record<1 | 2, number> = { 1: 5, 2: 3 };

/** Radio de la placa de una manzana: 0,9 km, menos que la mitad de lo que separa a dos celdas vecinas. */
export const BLOCK_RADIUS = 180;
/** Edificios a la vista en una manzana: una celda H3 tiene siete hijas (RF-6 (021) · 6.2). */
export const BLOCK_CAPACITY = 7;
/** Caja de un edificio con su nombre debajo. */
export const SPOT_WIDTH = 92;
export const SPOT_HEIGHT = 108;
/** Radio del marcador de un grupo y separación mínima entre dos grupos. */
export const GROUP_RADIUS = 40;
export const GROUP_SPACING = 96;
/** Clave del grupo de los ápices sin ubicación. */
export const UNLOCATED_KEY = 'sin-ubicar';

const EARTH_RADIUS_KM = 6371.0088;
const FRAME_MARGIN = 24;
const TERRAIN_COLUMNS = 6;
const TERRAIN_GAP = 12;
const TERRAIN_PADDING = 24;
/** Alto reservado para el rótulo del terreno. */
const TERRAIN_LABEL = 40;
const TERRAIN_DISTANCE = 64;

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
/** Diferencia de longitudes por el camino corto, para que el meridiano 180 no separe a dos vecinos. */
const wrapDegrees = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;

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

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const byPlace = <T extends { x: number; y: number; key: string }>(a: T, b: T): number => a.y - b.y || a.x - b.x || byText(a.key, b.key);

/** Una zona con ápices: su clave, su centro en kilómetros y sus ápices en orden estable. */
interface ZoneEntry {
  key: string;
  x: number;
  y: number;
  ids: string[];
}

/** La zona de una ubicación; si aún no tiene celda (RF-5 (021) · 5.4), su punto de pantalla hace de zona propia. */
const zoneOfLocation = (location: Location): { cell: string } & Point =>
  location.zone ?? { cell: `punto:${location.lat},${location.lng}`, lat: location.lat, lng: location.lng };

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

function zonesOf(apices: readonly MapApice[]): { zones: ZoneEntry[]; unlocated: string[] } {
  const byCell = new Map<string, { center: Point; ids: string[] }>();
  const unlocated: string[] = [];
  for (const apice of apices) {
    if (!apice.location) {
      unlocated.push(apice.id);
      continue;
    }
    const zone = zoneOfLocation(apice.location);
    const entry = byCell.get(zone.cell);
    if (entry) entry.ids.push(apice.id);
    else byCell.set(zone.cell, { center: { lat: zone.lat, lng: zone.lng }, ids: [apice.id] });
  }
  const cells = [...byCell.entries()].sort(([a], [b]) => byText(a, b));
  const origin = originOf(cells.map(([, entry]) => entry.center));
  const zones = cells.map(([key, entry]) => ({ key, ...projectKm(entry.center, origin), ids: entry.ids.sort(byText) }));
  return { zones, unlocated: unlocated.sort(byText) };
}

type Slot = readonly [x: number, y: number];

/** Puestos de una manzana según cuántos edificios muestra, en orden de lectura. Ninguna caja pisa a otra ni sale de la placa. */
const BLOCK_SLOTS: readonly (readonly Slot[])[] = [
  [[0, 0]],
  [[-55, 0], [55, 0]],
  [[0, -75], [-65, 38], [65, 38]],
  [[-55, -58], [55, -58], [-55, 58], [55, 58]],
  [[0, -100], [-95, -31], [95, -31], [-59, 81], [59, 81]],
  [[0, -110], [-95, -55], [95, -55], [-95, 55], [95, 55], [0, 110]],
  [[0, -110], [-95, -55], [95, -55], [0, 0], [-95, 55], [95, 55], [0, 110]],
];

/** Los puestos de una manzana con `count` edificios, relativos a su centro (RF-6 (021) · 6.1). */
export function blockSlots(count: number): { x: number; y: number }[] {
  const index = Math.min(BLOCK_CAPACITY, Math.max(1, Math.floor(count))) - 1;
  return (BLOCK_SLOTS[index] ?? []).map(([x, y]) => ({ x, y }));
}

const EMPTY_BOUNDS: MapBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

const grow = (bounds: MapBounds, minX: number, minY: number, maxX: number, maxY: number): MapBounds => ({
  minX: Math.min(bounds.minX, minX),
  minY: Math.min(bounds.minY, minY),
  maxX: Math.max(bounds.maxX, maxX),
  maxY: Math.max(bounds.maxY, maxY),
});

const around = (bounds: MapBounds, x: number, y: number, radius: number): MapBounds =>
  grow(bounds, x - radius, y - radius, x + radius, y + radius);

const orNull = (bounds: MapBounds): MapBounds | null => (Number.isFinite(bounds.minX) ? bounds : null);

function layoutBlocks(zones: readonly ZoneEntry[], unlocated: readonly string[], scale: number): MapLayout {
  let bounds = EMPTY_BOUNDS;
  const blocks = zones
    .map((zone): MapBlock => {
      const x = zone.x * scale;
      const y = zone.y * scale;
      const shown = Math.min(zone.ids.length, BLOCK_CAPACITY);
      const spots = blockSlots(shown).map((slot, index) => ({ id: zone.ids[index] ?? '', x: x + slot.x, y: y + slot.y }));
      return { key: zone.key, x, y, radius: BLOCK_RADIUS, ids: zone.ids, spots, more: zone.ids.length - shown };
    })
    .sort(byPlace);
  for (const block of blocks) bounds = around(bounds, block.x, block.y, block.radius);

  let terrain: MapTerrain | null = null;
  if (unlocated.length > 0) {
    const columns = Math.min(TERRAIN_COLUMNS, unlocated.length);
    const rows = Math.ceil(unlocated.length / columns);
    const width = 2 * TERRAIN_PADDING + columns * SPOT_WIDTH + (columns - 1) * TERRAIN_GAP;
    const height = TERRAIN_LABEL + rows * SPOT_HEIGHT + (rows - 1) * TERRAIN_GAP + TERRAIN_PADDING;
    const located = orNull(bounds);
    // Al sur de las manzanas y centrado con ellas; si no hay ninguna, en el centro del lienzo.
    const x = (located ? (located.minX + located.maxX) / 2 : 0) - width / 2;
    const y = located ? located.maxY + TERRAIN_DISTANCE : -height / 2;
    const spots = unlocated.map((id, index) => ({
      id,
      x: x + TERRAIN_PADDING + SPOT_WIDTH / 2 + (index % columns) * (SPOT_WIDTH + TERRAIN_GAP),
      y: y + TERRAIN_LABEL + SPOT_HEIGHT / 2 + Math.floor(index / columns) * (SPOT_HEIGHT + TERRAIN_GAP),
    }));
    terrain = { x, y, width, height, spots };
    bounds = grow(bounds, x, y, x + width, y + height);
  }
  return { level: 0, scale, blocks, groups: [], terrain, bounds: orNull(bounds) };
}

/** Grupo en construcción: suma de los centros de sus zonas, para sacar el centroide. */
interface Cluster {
  key: string;
  sumX: number;
  sumY: number;
  zones: number;
  ids: string[];
}

const centerOf = (cluster: Cluster, scale: number): { x: number; y: number } => ({
  x: (cluster.sumX / cluster.zones) * scale,
  y: (cluster.sumY / cluster.zones) * scale,
});

/**
 * Reúne las zonas por celda madre y después junta los grupos que quedarían encimados, del par más cercano en adelante:
 * dos celdas vecinas pueden tener madres distintas (RF-7 (021) · 7.2). El resultado no depende del orden de llegada.
 */
function clusterZones(zones: readonly ZoneEntry[], resolution: number, scale: number): Cluster[] {
  const byParent = new Map<string, Cluster>();
  for (const zone of zones) {
    const key = parentCell(zone.key, resolution);
    const cluster = byParent.get(key);
    if (cluster) {
      cluster.sumX += zone.x;
      cluster.sumY += zone.y;
      cluster.zones += 1;
      cluster.ids.push(...zone.ids);
    } else byParent.set(key, { key, sumX: zone.x, sumY: zone.y, zones: 1, ids: [...zone.ids] });
  }
  const clusters = [...byParent.values()].sort((a, b) => byText(a.key, b.key));
  for (;;) {
    let closest: { first: number; second: number; distance: number } | null = null;
    for (let first = 0; first < clusters.length; first += 1) {
      const a = centerOf(clusters[first]!, scale);
      for (let second = first + 1; second < clusters.length; second += 1) {
        const b = centerOf(clusters[second]!, scale);
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < GROUP_SPACING && (closest === null || distance < closest.distance)) closest = { first, second, distance };
      }
    }
    if (closest === null) return clusters;
    const keep = clusters[closest.first]!;
    const [gone] = clusters.splice(closest.second, 1);
    keep.sumX += gone!.sumX;
    keep.sumY += gone!.sumY;
    keep.zones += gone!.zones;
    keep.ids.push(...gone!.ids);
  }
}

function layoutGroups(zones: readonly ZoneEntry[], unlocated: readonly string[], level: 1 | 2, scale: number): MapLayout {
  let bounds = EMPTY_BOUNDS;
  const groups = clusterZones(zones, GROUP_RESOLUTION[level], scale)
    .map((cluster): MapGroup => ({ key: cluster.key, ...centerOf(cluster, scale), ids: cluster.ids.sort(byText), unlocated: false }))
    .sort(byPlace);
  for (const group of groups) bounds = around(bounds, group.x, group.y, GROUP_RADIUS);
  if (unlocated.length > 0) {
    const located = orNull(bounds);
    // Al sur de todos los grupos, con espacio de sobra para que no se encime con ninguno.
    const x = located ? (located.minX + located.maxX) / 2 : 0;
    const y = located ? located.maxY - GROUP_RADIUS + 1.5 * GROUP_SPACING : 0;
    groups.push({ key: UNLOCATED_KEY, x, y, ids: [...unlocated], unlocated: true });
    bounds = around(bounds, x, y, GROUP_RADIUS);
  }
  return { level, scale, blocks: [], groups, terrain: null, bounds: orNull(bounds) };
}

/**
 * Dónde va cada ápice en el nivel pedido (RF-5 (021) · 5.3, RF-6 (021), RF-7 (021) · 7.2, RF-9 (021) · 9.1). `scale`
 * solo se cambia en el nivel más lejano, cuando el conjunto no cabe (RF-7 (021) · 7.4).
 */
export function layoutMap(apices: readonly MapApice[], level: MapLevel, scale: number = LEVEL_SCALE[level]): MapLayout {
  const { zones, unlocated } = zonesOf(apices);
  return level === 0 ? layoutBlocks(zones, unlocated, scale) : layoutGroups(zones, unlocated, level, scale);
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
 * Encuadre inicial: el nivel más cercano en que caben todos los ápices; si no caben ni en el más lejano, ese nivel se
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
 * Encuadre del nivel cercano sobre las manzanas de unos ápices: lo que pasa al elegir un grupo (RF-7 (021) · 7.3). Si
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
    if (block.ids.some((id) => wanted.has(id))) {
      places.push({ x: block.x, y: block.y, bounds: around(EMPTY_BOUNDS, block.x, block.y, block.radius) });
    }
  }
  const { terrain } = layout;
  if (terrain?.spots.some((spot) => wanted.has(spot.id))) {
    places.push({
      x: terrain.x + terrain.width / 2,
      y: terrain.y + terrain.height / 2,
      bounds: { minX: terrain.x, minY: terrain.y, maxX: terrain.x + terrain.width, maxY: terrain.y + terrain.height },
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

/** Lo que ocupan los ápices pedidos en un nivel: sus edificios, el «+n» que los guarda, o sus grupos. `null` si ninguno está. */
function boundsOfIds(layout: MapLayout, wanted: ReadonlySet<string>): MapBounds | null {
  let bounds = EMPTY_BOUNDS;
  const spotBox = (spot: MapSpot) => grow(bounds, spot.x - SPOT_WIDTH / 2, spot.y - SPOT_HEIGHT / 2, spot.x + SPOT_WIDTH / 2, spot.y + SPOT_HEIGHT / 2);
  for (const block of layout.blocks) {
    let hidden = false;
    for (const id of block.ids) {
      if (!wanted.has(id)) continue;
      const spot = block.spots.find((candidate) => candidate.id === id);
      if (spot) bounds = spotBox(spot);
      else hidden = true;
    }
    // Un ápice que va en el «+n» no tiene edificio propio: se toma toda la placa de su manzana.
    if (hidden) bounds = around(bounds, block.x, block.y, block.radius);
  }
  for (const spot of layout.terrain?.spots ?? []) if (wanted.has(spot.id)) bounds = spotBox(spot);
  for (const group of layout.groups) if (group.ids.some((id) => wanted.has(id))) bounds = around(bounds, group.x, group.y, GROUP_RADIUS);
  return orNull(bounds);
}

/**
 * Encuadre del nivel más cercano en que caben los ápices `ids` (RF-4 (024) · 4.1, D-T5 (024)): a diferencia de `frameOn`,
 * que siempre acerca al nivel cercano, aquí se prefiere el primero en que todos caben, centrado en ellos. En el nivel
 * cercano se mide lo que ocupan sus edificios (no la placa entera de la manzana, que es más ancha que un teléfono); en los
 * alejados, sus grupos. Si no caben ni en el más lejano, ese nivel se aleja como en `frameMap`. Con `drawn`, entre los
 * niveles en que caben se prefiere el primero en que el camino se dibuja; si en ninguno, el primero en que caben. Los ids
 * que no están en `apices` se ignoran; si no queda ninguno, devuelve el encuadre inicial (RF-7 (021) · 7.4).
 * Con `reservedBottom` (D-12 (024)), el borde de abajo de la ventana está ocupado por la tarjeta del recorrido: el ajuste se
 * mide con el área libre y el centro baja la mitad de lo reservado, de modo que los ápices quedan en medio del área libre.
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
 * ningún edificio se quede sin camino.
 */
export function mapNeighbor(spots: readonly MapSpot[], id: string, key: string): string | null {
  const direction = DIRECTIONS[key];
  const from = spots.find((spot) => spot.id === id);
  if (!direction || !from) return null;
  let inCone: { id: string; cost: number } | null = null;
  let aside: { id: string; cost: number } | null = null;
  for (const spot of spots) {
    if (spot.id === id) continue;
    const dx = spot.x - from.x;
    const dy = spot.y - from.y;
    const forward = dx * direction[0] + dy * direction[1];
    if (forward <= 0) continue;
    const drift = Math.abs(dx * direction[1] - dy * direction[0]);
    const cost = forward + 2 * drift;
    if (drift <= forward) {
      if (inCone === null || cost < inCone.cost) inCone = { id: spot.id, cost };
    } else if (aside === null || cost < aside.cost) aside = { id: spot.id, cost };
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
