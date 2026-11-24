// RF-3 (024), D-1 (024), D-T3 (024), D-12 (024): a qué Ápices lleva el mapa en cada paso del recorrido y cuánto del borde de
// abajo reserva el encuadre. Dominio puro. Vive aparte de `tour.ts` porque calcula con el teselado (`h3-js`): quien lo
// necesita lo carga con `import()` y la carga inicial de la página no lo trae.
import { CELL_WIDTH, frameFit, layoutMap, type MapApice, type MapViewport } from './hexmap';
import { pathPoints } from './mapPaths';

/** Un ápice del mapa; el nombre, si llega, debe tener texto para que la celda lo muestre. */
export interface TourFocusApice extends MapApice {
  name?: string;
}

/** Una Acción Común del mapa; el borrador de «Conectar» no se elige. */
export interface TourFocusPath {
  id: string;
  /** Los Ápices que une, en el orden de la Acción Común. */
  apiceIds: readonly string[];
  draft?: boolean;
}

export interface TourFocusInput {
  apices: readonly TourFocusApice[];
  paths: readonly TourFocusPath[];
  /** La ventana del mapa; sin ella no se mide si la Acción Común cabe. */
  viewport?: MapViewport;
}

/** Los ids de los Ápices que el mapa encuadra en cada paso del recorrido; vacío si el paso no tiene a qué llevar. */
export interface TourFocus {
  apice: string[];
  camino: string[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A qué Ápices lleva el mapa cada paso del recorrido (RF-3 (024), D-1 (024), D-T3 (024)). Trabaja sobre el nivel cercano:
 * - `apice`: el primer Ápice, en el orden estable del mapa (por zona y por id), que tiene celda y nombre a la vista;
 *   nunca uno que quede dentro de un «+N». Si ninguno tiene ubicación, el primero del terreno.
 * - `camino` (la Acción Común): los Ápices, en su orden, de la primera Acción Común (por id) que se dibuja en el nivel
 *   cercano y cuyos Ápices caben en la ventana; si ninguna cabe, la primera que se dibuje. El borrador no cuenta.
 * No depende del orden de llegada. Sin a qué llevar, la lista queda vacía y `tourSteps` omite el paso (RF-22 (021) · 22.3).
 */
export function tourFocus({ apices, paths, viewport }: TourFocusInput): TourFocus {
  const layout = layoutMap(apices, 0);
  const named = new Set(apices.filter((apice) => apice.name === undefined || apice.name.trim() !== '').map((apice) => apice.id));

  const candidates = [...layout.blocks.flatMap((block) => block.spots), ...(layout.terrain?.spots ?? [])];
  const first = candidates.find((spot) => named.has(spot.id));

  const present = new Set(apices.map((apice) => apice.id));
  const drawn = [...paths]
    .filter((path) => path.draft !== true)
    .sort((a, b) => byText(a.id, b.id))
    .map((path) => path.apiceIds.filter((id) => present.has(id)))
    .filter((ids) => pathPoints(layout, ids).length > 0);
  const fits = (ids: readonly string[]): boolean => viewport === undefined || frameFit(apices, ids, viewport).level === 0;
  const camino = drawn.find(fits) ?? drawn[0] ?? [];

  return { apice: first === undefined ? [] : [first.id], camino };
}

/** El borde de la tarjeta del recorrido, en píxeles desde la esquina de arriba a la izquierda del lienzo del mapa. */
export interface TourCardBox {
  left: number;
  right: number;
  top: number;
}

/** De la ventana del mapa, lo mínimo que la reserva deja libre: 40 % de su alto, para que una zona siga cabiendo. */
const MIN_FREE_SHARE = 0.4;

/**
 * Cuántos píxeles del borde de abajo del lienzo ocupa la tarjeta del recorrido y el encuadre debe reservar (D-12 (024),
 * D-T4b (024)): desde el borde de arriba de la tarjeta hasta el borde de abajo del lienzo, solo si la tarjeta cruza la
 * columna central (la del ancho de una celda): si queda a un lado, como a 1280 px, no tapa lo que el paso nombra y no
 * se reserva nada. Sin tarjeta (se saltó o terminó el recorrido), tampoco. Nunca deja libre menos del 40 % del alto.
 */
export function tourReserve(viewport: MapViewport, card: TourCardBox | null): number {
  if (card === null) return 0;
  const centre = viewport.width / 2;
  const covers = card.left < centre + CELL_WIDTH / 2 && card.right > centre - CELL_WIDTH / 2;
  if (!covers) return 0;
  const reserve = Math.min(viewport.height - card.top, viewport.height * (1 - MIN_FREE_SHARE));
  return Math.max(0, Math.round(reserve));
}
