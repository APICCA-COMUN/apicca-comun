// RF-22 (021), RF-26 (021) · 26.1, 26.2, D-T38 (021), RF-3 (024), D-T3 (024), D-12 (024): los pasos del primer recorrido y los ápices a
// los que lleva el mapa en cada uno. Dominio puro: el componente solo los muestra. Los textos son propuestos y por
// confirmar (plan §4, D-21 (003); plan 024 §2).
import { SPOT_WIDTH, frameFit, layoutMap, type MapApice, type MapViewport } from './hexmap';
import { pathPoints } from './mapPaths';

export type TourStepKey = 'apice' | 'camino' | 'construir';

export interface TourStep {
  readonly key: TourStepKey;
  readonly title: string;
  readonly text: string;
}

export interface TourInput {
  /** Ápices a la vista en el mapa. */
  readonly apices: number;
  /** Caminos a la vista en el mapa. */
  readonly paths: number;
  readonly signedIn: boolean;
}

/** Los pasos que el mapa puede mostrar, en orden; omite el que no tiene qué mostrar (RF-22 (021) · 22.3). */
export function tourSteps({ apices, paths, signedIn }: TourInput): TourStep[] {
  const steps: TourStep[] = [];
  if (apices > 0) steps.push({ key: 'apice', title: 'Mira un ápice', text: 'Cada edificio es un ápice. El mapa se acercó a uno: elígelo para ver su ficha.' });
  if (paths > 0) {
    steps.push({ key: 'camino', title: 'Mira un camino', text: 'Cada camino es una Acción Común que une ápices. El mapa se acercó a uno: elige su nombre para ver quién participa.' });
  }
  steps.push(
    signedIn
      ? { key: 'construir', title: 'Construye', text: 'Con «Construir ápice» propones el tuyo, y con «Trazar camino» unes varios en una Acción Común.' }
      : {
          key: 'construir',
          title: 'Construye',
          text: 'Para construir ápices y trazar caminos hace falta unirte a APICCA con «Unirme». Mientras tanto, «Construir ápice» te deja hacer un boceto que no se guarda.',
        },
  );
  return steps;
}

/** Un ápice del mapa; el nombre, si llega, debe tener texto para que el edificio lo muestre. */
export interface TourFocusApice extends MapApice {
  name?: string;
}

/** Un camino del mapa; el borrador de «Trazar camino» no se elige. */
export interface TourFocusPath {
  id: string;
  /** Los ápices que une, en el orden del camino. */
  apiceIds: readonly string[];
  draft?: boolean;
}

export interface TourFocusInput {
  apices: readonly TourFocusApice[];
  paths: readonly TourFocusPath[];
  /** La ventana del mapa; sin ella no se mide si el camino cabe. */
  viewport?: MapViewport;
}

/** Los ids de los ápices que el mapa encuadra en cada paso del recorrido; vacío si el paso no tiene a qué llevar. */
export interface TourFocus {
  apice: string[];
  camino: string[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A qué ápices lleva el mapa cada paso del recorrido (RF-3 (024), D-1 (024), D-T3 (024)). Trabaja sobre el nivel cercano:
 * - `apice`: el primer ápice, en el orden estable del mapa (por manzana y por id), que tiene edificio y nombre a la vista;
 *   nunca uno que quede dentro de un «+n». Si ninguno tiene ubicación, el primero del terreno.
 * - `camino`: los ápices, en su orden, del primer camino (por id) que se dibuja en el nivel cercano y cuyos ápices caben en
 *   la ventana; si ninguno cabe, el primero que se dibuje. El borrador no cuenta.
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

/** De la ventana del mapa, lo mínimo que la reserva deja libre: 40 % de su alto, para que un edificio siga cabiendo. */
const MIN_FREE_SHARE = 0.4;

/**
 * Cuántos píxeles del borde de abajo del lienzo ocupa la tarjeta del recorrido y el encuadre debe reservar (D-12 (024),
 * D-T4b (024)): desde el borde de arriba de la tarjeta hasta el borde de abajo del lienzo, solo si la tarjeta cruza la
 * columna central (la del ancho de un edificio): si queda a un lado, como a 1280 px, no tapa lo que el paso nombra y no
 * se reserva nada. Sin tarjeta (se saltó o terminó el recorrido), tampoco. Nunca deja libre menos del 40 % del alto.
 */
export function tourReserve(viewport: MapViewport, card: TourCardBox | null): number {
  if (card === null) return 0;
  const centre = viewport.width / 2;
  const covers = card.left < centre + SPOT_WIDTH / 2 && card.right > centre - SPOT_WIDTH / 2;
  if (!covers) return 0;
  const reserve = Math.min(viewport.height - card.top, viewport.height * (1 - MIN_FREE_SHARE));
  return Math.max(0, Math.round(reserve));
}
