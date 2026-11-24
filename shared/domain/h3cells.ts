// Celdas H3 del mapa: la única puerta a `h3-js` en el sitio. El teselado a la vista (zonas de siete celdas, celdas de los
// niveles alejados, rutas entre Ápices) sale de aquí; `hexmap.ts` y `mapPaths.ts` solo piden celdas y las proyectan.
// Puro, sin React ni DOM. Todo lo que puede lanzar la biblioteca (celdas inválidas, caminos entre pentágonos, resoluciones
// cruzadas) se atrapa aquí y devuelve un valor neutro: el mapa nunca se rompe por una celda.
import {
  cellToBoundary,
  cellToCenterChild,
  cellToLatLng,
  cellsToMultiPolygon,
  getHexagonEdgeLengthAvg,
  getResolution,
  greatCircleDistance,
  gridDisk,
  gridPathCells,
  isValidCell,
  latLngToCell,
} from 'h3-js';
import type { Point } from './location';

/** Resolución de las celdas con Ápice: las siete hijas de una zona (resolución 7). */
export const CELL_RESOLUTION = 8;
/** Resolución de la celda de cada nivel de acercamiento: cercano, ciudad y región. Cada una, siete veces más ancha. */
export const LEVEL_RESOLUTION: readonly [number, number, number] = [8, 6, 4];
/** Resolución de la zona (`ZONE_RESOLUTION` de `location.ts`). */
const ZONE_CELL_RESOLUTION = 7;

const EDGE_KM = new Map<number, number>();
/** Largo medio de la arista de una celda de la resolución, en kilómetros. */
export function edgeKm(resolution: number): number {
  let value = EDGE_KM.get(resolution);
  if (value === undefined) {
    value = getHexagonEdgeLengthAvg(resolution, 'km');
    EDGE_KM.set(resolution, value);
  }
  return value;
}

/**
 * El código corto de una zona, en minúscula: los cuatro dígitos hexadecimales que la distinguen de sus vecinas (los
 * del 6.º al 9.º del índice). «8766e42d2ffffff» es «42d2». Propuesta del asistente; sin decidir si es el nombre que verá
 * la gente.
 */
export const zoneCode = (cell: string): string => cell.slice(5, 9);

/** ¿Es un índice H3 válido de esa resolución? */
export function isCellOf(cell: unknown, resolution: number): cell is string {
  try {
    return typeof cell === 'string' && isValidCell(cell) && getResolution(cell) === resolution;
  } catch {
    return false;
  }
}

/** La celda de una resolución que contiene el punto. */
export const cellOfPoint = (point: Point, resolution: number): string => latLngToCell(point.lat, point.lng, resolution);

export function cellCenter(cell: string): Point {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/** Tope de la caché de bordes: las celdas de varias pantallas, y se vacía entera al llenarse. */
const BOUNDARY_CACHE_LIMIT = 6000;
const boundaries = new Map<string, readonly Point[]>();

/** Los vértices de la celda, en grados. Calcularlos cuesta, y el mapa los pide en cada cuadro: se guardan. */
export function cellBoundary(cell: string): readonly Point[] {
  let value = boundaries.get(cell);
  if (value === undefined) {
    value = cellToBoundary(cell).map(([lat, lng]) => ({ lat, lng }));
    if (boundaries.size >= BOUNDARY_CACHE_LIMIT) boundaries.clear();
    boundaries.set(cell, value);
  }
  return value;
}

/**
 * Las celdas de una zona: la central primero y las seis del anillo después, en el sentido del reloj desde el norte. Si
 * `zone` no es una celda de zona válida devuelve `[]`.
 */
export function zoneCells(zone: string): string[] {
  if (!isCellOf(zone, ZONE_CELL_RESOLUTION)) return [];
  const center = cellToCenterChild(zone, CELL_RESOLUTION);
  const middle = cellCenter(center);
  const around = gridDisk(center, 1)
    .filter((cell) => cell !== center)
    .map((cell) => {
      const point = cellCenter(cell);
      const dx = (point.lng - middle.lng) * Math.cos((middle.lat * Math.PI) / 180);
      const dy = point.lat - middle.lat;
      // 0 al norte y crece hacia el este.
      const angle = (Math.atan2(dx, dy) + 2 * Math.PI) % (2 * Math.PI);
      return { cell, angle };
    })
    .sort((a, b) => a.angle - b.angle || (a.cell < b.cell ? -1 : 1));
  return [center, ...around.map((entry) => entry.cell)];
}

/** El borde exterior de la unión de unas celdas (el de una zona de siete), en grados; `[]` si no hay celdas. */
export function outlineOf(cells: readonly string[]): readonly Point[] {
  if (cells.length === 0) return [];
  try {
    const rings = cellsToMultiPolygon([...cells], false).map((polygon) => polygon[0] ?? []);
    const outer = rings.sort((a, b) => b.length - a.length)[0] ?? [];
    return outer.map(([lat, lng]) => ({ lat, lng }));
  } catch {
    return [];
  }
}

/**
 * Las celdas de `rings` anillos alrededor de la que contiene al punto, incluida esa. Es el teselado vacío que se ve
 * debajo del mapa. Sin celdas si la resolución o el tamaño no son posibles.
 */
export function cellsAround(point: Point, resolution: number, rings: number): string[] {
  try {
    return gridDisk(latLngToCell(point.lat, point.lng, resolution), Math.max(0, Math.floor(rings)));
  } catch {
    return [];
  }
}

/** Cuántas celdas caben, a lo más, en una ruta entre dos Ápices; más larga no se dibuja. */
export const ROUTE_LIMIT = 120;

/**
 * Las celdas que unen a dos celdas de la misma resolución, con las dos puntas, en orden; `null` si la ruta pasa del
 * tope (`ROUTE_LIMIT`). Si H3 no puede trazar el camino (celdas de otra base o junto a un pentágono), se muestrea la
 * línea recta entre los centros.
 */
export function routeCells(from: string, to: string): string[] | null {
  try {
    const a = cellToLatLng(from);
    const b = cellToLatLng(to);
    const resolution = getResolution(from);
    const reach = greatCircleDistance(a, b, 'km') / (Math.sqrt(3) * edgeKm(resolution));
    if (reach > ROUTE_LIMIT) return null;
    try {
      const path = gridPathCells(from, to);
      return path.length > 0 && path.length <= ROUTE_LIMIT + 1 ? path : null;
    } catch {
      const steps = Math.max(1, Math.ceil(reach * 2));
      const cells: string[] = [];
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const cell = latLngToCell(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, resolution);
        if (cells[cells.length - 1] !== cell) cells.push(cell);
      }
      cells[0] = from;
      cells[cells.length - 1] = to;
      return cells.length <= ROUTE_LIMIT + 1 ? cells : null;
    }
  } catch {
    return null;
  }
}
