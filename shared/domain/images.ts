// Referencias de un ápice (RF-15 (001)): límites y validación de sus metadatos.
// Puro, sin DOM ni `sharp`: el servidor comprueba además el formato real por contenido
// (D-T9 (001)); aquí queda lo que cliente y servidor comparten.
import { invalid, valid, type Validation } from './result';
import { LIMITS, isBlank, validateLength } from './limits';

/** Peso máximo de una referencia: 5 MiB, inclusivo (RF-15 (001)). */
export const REFERENCE_MAX_BYTES = 5 * 1024 * 1024;
/** Referencias por ápice (RF-15 (001)). */
export const MAX_REFERENCES = 5;
/** Lado máximo, en píxeles, de una imagen subida (RF-15 (001)). */
export const MAX_IMAGE_DIMENSION = 4096;
/** Formatos admitidos, estáticos (RF-15 (001)). */
export const REFERENCE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Texto alternativo: de 1 a 200 caracteres tras recortar (RF-15 (001)). */
export const ALT_TEXT_MAX = LIMITS.linkDescription;

export interface ReferenceMetaInput {
  contentType: string;
  bytes: number;
  altText: string;
  /** Referencias no quitadas que el ápice ya tiene. */
  currentCount: number;
  /** El cliente no los conoce antes de subir; el servidor sí los lee de la imagen. */
  width?: number;
  height?: number;
}

export interface ReferenceMeta {
  contentType: (typeof REFERENCE_CONTENT_TYPES)[number];
  bytes: number;
  altText: string;
  width?: number;
  height?: number;
}

/** Texto alternativo recortado y dentro de su límite, o su código (RF-15 (001)). */
export function validateAltText(raw: string): Validation<string> {
  if (isBlank(raw)) return invalid('alt-text-required');
  const text = raw.trim();
  return validateLength(text, ALT_TEXT_MAX).ok ? valid(text) : invalid('alt-text-too-long');
}

const isSupportedType = (type: string): type is ReferenceMeta['contentType'] =>
  (REFERENCE_CONTENT_TYPES as readonly string[]).includes(type);

const exceedsDimension = (side: number | undefined): boolean => side !== undefined && side > MAX_IMAGE_DIMENSION;

/** Valida los metadatos de una referencia antes de aceptarla (RF-15 (001)). */
export function validateReferenceMeta(input: ReferenceMetaInput): Validation<ReferenceMeta> {
  if (input.currentCount >= MAX_REFERENCES) return invalid('references-full');
  if (!isSupportedType(input.contentType)) return invalid('image-type-unsupported');
  if (!Number.isFinite(input.bytes) || input.bytes <= 0 || input.bytes > REFERENCE_MAX_BYTES) {
    return invalid('image-too-large');
  }
  if (exceedsDimension(input.width) || exceedsDimension(input.height)) return invalid('image-dimensions-exceeded');
  const alt = validateAltText(input.altText);
  if (!alt.ok) return alt;
  const value: ReferenceMeta = { contentType: input.contentType, bytes: input.bytes, altText: alt.value };
  if (input.width !== undefined) value.width = input.width;
  if (input.height !== undefined) value.height = input.height;
  return valid(value);
}

// ── Imagen pixelada y propuesta (RF-17 (001), RF-18 (001)) ──────────────────────────

/** Lado de la imagen pixelada, en píxeles: cuadrada de 64 × 64 (RF-17 (001), D-5 (001)). */
export const PIXEL_SIZE = 64;

export type Rgb = readonly [number, number, number];

/**
 * Paleta fija definitiva de 16 colores (RF-17 (001), D-5 (001)): Sweetie 16 (de uso libre),
 * ratificada en T-6.8 tras verificación empírica de contraste y legibilidad a 64 × 64.
 */
export const PALETTE: readonly Rgb[] = [
  [26, 28, 44],
  [93, 39, 93],
  [177, 62, 83],
  [239, 125, 87],
  [255, 205, 117],
  [167, 240, 112],
  [56, 183, 100],
  [37, 113, 121],
  [41, 54, 111],
  [59, 93, 201],
  [65, 166, 246],
  [115, 239, 247],
  [244, 244, 244],
  [148, 176, 194],
  [86, 108, 134],
  [51, 60, 87],
];

function nearestPaletteIndex(r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  PALETTE.forEach(([pr, pg, pb], index) => {
    const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/**
 * Lleva cada píxel al color más cercano de la paleta (RF-17 (001)). Recibe y devuelve tripletas
 * RGB consecutivas (sin alfa) y no modifica la entrada; el servidor la alimenta con la imagen ya
 * reescalada a `PIXEL_SIZE` × `PIXEL_SIZE` (D-T7 (001)).
 */
export function quantizeToPalette(rgb: Uint8Array): Uint8Array {
  if (rgb.length % 3 !== 0) throw new Error('quantizeToPalette: la longitud debe ser múltiplo de 3');
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const color = PALETTE[nearestPaletteIndex(rgb[i] as number, rgb[i + 1] as number, rgb[i + 2] as number)] as Rgb;
    out[i] = color[0];
    out[i + 1] = color[1];
    out[i + 2] = color[2];
  }
  return out;
}

/** Vida de una propuesta sin decidir: 24 horas (RF-17 (001), D-5 (001)). */
export const PROPOSAL_TTL_MS = 24 * 3600 * 1000;

/** Verdadero desde las 24 h exactas de generada (RF-17 (001)). */
export function isProposalExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= PROPOSAL_TTL_MS;
}

/** Lo que el ápice era cuando se generó la propuesta. */
export interface ProposalSnapshot {
  /** Versión del contenido del ápice. */
  version: number;
  /** Imagen del ápice, o `null` si no tenía. */
  imageId: string | null;
  /** Referencias que se usaron para generar. */
  referenceIds: readonly string[];
}

/** Lo que el ápice es ahora. */
export interface ApiceCurrent {
  version: number;
  imageId: string | null;
  /** Referencias no quitadas. */
  activeReferenceIds: readonly string[];
}

export type ProposalWarning = 'content-changed' | 'image-changed' | 'reference-removed';

/**
 * Avisos que se dan antes de aceptar una propuesta vieja (RF-18 (001), RF-16 (001)), en orden
 * estable: contenido, imagen, referencia quitada.
 */
export function proposalWarnings(proposal: ProposalSnapshot, current: ApiceCurrent): ProposalWarning[] {
  const warnings: ProposalWarning[] = [];
  if (proposal.version !== current.version) warnings.push('content-changed');
  if (proposal.imageId !== current.imageId) warnings.push('image-changed');
  const active = new Set(current.activeReferenceIds);
  if (proposal.referenceIds.some((id) => !active.has(id))) warnings.push('reference-removed');
  return warnings;
}
