// Celda base y cálculo de escala para edificios de ápices (RF-7 (002) · 7.2, D-T10 (002)), sus partes por etapa
// (RF-4 (019) · 4.1 a 4.3, D-T19 (019)) y su forma vectorial (RF-2 (021), RF-3 (021), D-T3 (021)).
import { AXES, type ApiceStatus, type Axis } from '../apice';

/** Lado en píxeles de la celda mínima del edificio (RF-7 (002) · 7.2). */
export const BUILDING_CELL = 64;

/**
 * Calcula el factor de escala entero para un edificio a partir del ancho disponible y el máximo permitido.
 * Devuelve clamp(1, floor(width / 64), max). Si width no es finito o es negativo, devuelve 1.
 */
export function buildingScale(width: number, max: number): number {
  if (!Number.isFinite(width) || width < 0) return 1;
  const n = Math.floor(width / BUILDING_CELL);
  return Math.max(1, Math.min(n, max));
}

/** RF-4 (019) · 4.1 a 4.3, D-T19 (019): partes del edificio. */
export type BuildingPart = 'base' | 'body' | 'roof';

/** Partes que dibuja el edificio en cada etapa: la idea es solo la base y cada etapa suma una (RF-4 (019) · 4.1 a 4.3). */
export function buildingParts(stage: ApiceStatus): readonly BuildingPart[] {
  if (stage === 'idea') return ['base'];
  if (stage === 'prototipo') return ['base', 'body'];
  return ['base', 'body', 'roof'];
}

// RF-2 (021), RF-3 (021), D-T3 (021), RNF-5 (021): forma vectorial del edificio. Sale solo de los ejes, la etapa y el
// identificador del ápice; no usa imagen, React ni DOM. Las medidas van en unidades de la celda (`BUILDING_CELL`).

/** Rectángulo en unidades de la celda. */
export type BuildingRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** Puesto cuadrado del motivo de un eje (RF-2 (021) · 2.3). */
export type BuildingMotif = { readonly axis: Axis; readonly x: number; readonly y: number; readonly size: number };

/** Formas de techo, una por variante (RF-2 (021) · 2.5). */
export type RoofKind = 'gable' | 'flat' | 'shed' | 'stepped';

export type BuildingRoof = {
  readonly kind: RoofKind;
  /** Contorno del techo, en el sentido de las agujas del reloj desde la esquina inferior izquierda. */
  readonly points: readonly (readonly [number, number])[];
  /** Franja recta del techo, donde van los motivos (RF-3 (021) · 3.3). */
  readonly band: BuildingRect;
};

export type BuildingVariant = 0 | 1 | 2 | 3;

export type BuildingShape = {
  readonly parts: readonly BuildingPart[];
  readonly variant: BuildingVariant;
  readonly base: BuildingRect;
  readonly body: BuildingRect | null;
  readonly windows: readonly BuildingRect[];
  readonly door: BuildingRect | null;
  readonly roof: BuildingRoof | null;
  readonly motifs: readonly BuildingMotif[];
};

export type BuildingInput = {
  readonly axes: readonly Axis[];
  readonly stage: ApiceStatus;
  /** Identificador del ápice: de él sale la variante (RF-2 (021) · 2.5). */
  readonly seed?: string | undefined;
};

const BASE: BuildingRect = { x: 2, y: 52, width: 60, height: 10 };

/** Ancho y alto del cuerpo y forma del techo de cada variante. */
const VARIANTS: readonly { readonly width: number; readonly height: number; readonly roof: RoofKind }[] = [
  { width: 44, height: 22, roof: 'gable' },
  { width: 50, height: 19, roof: 'flat' },
  { width: 40, height: 25, roof: 'shed' },
  { width: 46, height: 21, roof: 'stepped' },
];

const ROOF_OVERHANG = 2;
const ROOF_BAND = 16;
const MOTIF_GAP = 1;
const MOTIF_PAD = 2;
const WINDOW = 6;
const WINDOW_GAP = 4;
const DOOR: Pick<BuildingRect, 'width' | 'height'> = { width: 8, height: 9 };

/** Variante estable a partir del identificador: FNV-1a de 32 bits, módulo 4. Sin semilla, 0. */
export function buildingVariant(seed: string | undefined): BuildingVariant {
  if (seed === undefined || seed === '') return 0;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 4) as BuildingVariant;
}

/** Fila centrada de puestos cuadrados dentro de `area`, apoyada en su borde inferior o centrada en su alto. */
function motifRow(axes: readonly Axis[], area: BuildingRect, max: number, align: 'bottom' | 'middle'): BuildingMotif[] {
  const count = axes.length;
  if (count === 0) return [];
  const fit = (area.width - MOTIF_GAP * (count - 1)) / count;
  const size = Math.floor(Math.min(max, area.height, fit) * 100) / 100;
  const total = size * count + MOTIF_GAP * (count - 1);
  const left = area.x + (area.width - total) / 2;
  const y = align === 'bottom' ? area.y + area.height - size : area.y + (area.height - size) / 2;
  return axes.map((axis, index) => ({ axis, x: left + index * (size + MOTIF_GAP), y, size }));
}

function roofPoints(kind: RoofKind, band: BuildingRect): (readonly [number, number])[] {
  const left = band.x;
  const right = band.x + band.width;
  const top = band.y;
  const bottom = band.y + band.height;
  if (kind === 'gable') return [[left, bottom], [left, top], [left + band.width / 2, top - 7], [right, top], [right, bottom]];
  if (kind === 'shed') return [[left, bottom], [left, top - 7], [right, top], [right, bottom]];
  if (kind === 'flat') {
    return [[left, bottom], [left, top - 3], [left + 5, top - 3], [left + 5, top], [right - 5, top], [right - 5, top - 3], [right, top - 3], [right, bottom]];
  }
  const step = Math.round(band.width / 4);
  return [[left, bottom], [left, top], [left + step, top], [left + step, top - 5], [right - step, top - 5], [right - step, top], [right, top], [right, bottom]];
}

/** Vanos del cuerpo: una o dos filas según su alto, sin encimar la puerta. */
function bodyWindows(body: BuildingRect, door: BuildingRect): BuildingRect[] {
  const columns = Math.floor((body.width - 2 * WINDOW_GAP + WINDOW_GAP) / (WINDOW + WINDOW_GAP));
  const rows = body.height >= 24 ? 2 : 1;
  const left = body.x + (body.width - (columns * WINDOW + (columns - 1) * WINDOW_GAP)) / 2;
  const windows: BuildingRect[] = [];
  for (let row = 0; row < rows; row += 1) {
    const y = body.y + WINDOW_GAP + row * (WINDOW + 3);
    for (let column = 0; column < columns; column += 1) {
      const x = left + column * (WINDOW + WINDOW_GAP);
      const overDoor = y + WINDOW > door.y - 1 && x < door.x + door.width + 1 && x + WINDOW > door.x - 1;
      if (!overDoor) windows.push({ x, y, width: WINDOW, height: WINDOW });
    }
  }
  return windows;
}

/**
 * Forma del edificio de un ápice (RF-2 (021), RF-3 (021)): la idea es la base con los motivos de sus ejes encima; el
 * prototipo suma el cuerpo, con los motivos sobre él; en marcha suma el techo, que los lleva dentro.
 */
export function buildingShape({ axes, stage, seed }: BuildingInput): BuildingShape {
  const parts = buildingParts(stage);
  const variant = buildingVariant(seed);
  const ordered = AXES.filter((axis) => axes.includes(axis));
  if (!parts.includes('body')) {
    const area: BuildingRect = { x: BASE.x + MOTIF_PAD, y: BASE.y - 1 - 16, width: BASE.width - 2 * MOTIF_PAD, height: 16 };
    return { parts, variant, base: BASE, body: null, windows: [], door: null, roof: null, motifs: motifRow(ordered, area, 16, 'bottom') };
  }

  const spec = VARIANTS[variant]!;
  const body: BuildingRect = { x: (BUILDING_CELL - spec.width) / 2, y: BASE.y - spec.height, width: spec.width, height: spec.height };
  const door: BuildingRect = { x: (BUILDING_CELL - DOOR.width) / 2, y: BASE.y - DOOR.height, ...DOOR };
  const windows = bodyWindows(body, door);
  const band: BuildingRect = { x: body.x - ROOF_OVERHANG, y: body.y - ROOF_BAND, width: body.width + 2 * ROOF_OVERHANG, height: ROOF_BAND };
  const max = ROOF_BAND - 2 * MOTIF_PAD;

  if (!parts.includes('roof')) {
    const area: BuildingRect = { x: body.x, y: body.y - 1 - max, width: body.width, height: max };
    return { parts, variant, base: BASE, body, windows, door, roof: null, motifs: motifRow(ordered, area, max, 'bottom') };
  }

  const area: BuildingRect = { x: body.x, y: band.y + MOTIF_PAD, width: body.width, height: max };
  const roof: BuildingRoof = { kind: spec.roof, points: roofPoints(spec.roof, band), band };
  return { parts, variant, base: BASE, body, windows, door, roof, motifs: motifRow(ordered, area, max, 'middle') };
}
