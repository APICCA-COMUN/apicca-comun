// RF-9 (001) · Borrador de la ubicación en el formulario: lo que la persona escribe (texto) y su paso
// a la orden que entiende el servidor. Las reglas de coordenadas son las del dominio.
import { DEFAULT_PRECISION, validateCoordinates, type Precision } from '../../shared/domain/location';
import { invalid, valid, type Validation } from '../../shared/domain/result';
import type { LocationEdit } from '../data/api';

export type LocationDraft =
  | { mode: 'keep' }
  | { mode: 'remove' }
  | { mode: 'set'; lat: string; lng: string; precision: Precision }
  | { mode: 'precision'; precision: Precision };

export const KEEP_LOCATION: LocationDraft = { mode: 'keep' };

const PRECISIONS: readonly Precision[] = ['approximate', 'exact'];

/** Número desde lo escrito; acepta coma decimal. Vacío o con texto da `NaN`. */
function parseDegrees(text: string): number {
  const clean = text.trim().replace(',', '.');
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(clean) ? Number(clean) : Number.NaN;
}

/** La orden para el servidor, o `coordinates-invalid` si lo escrito no son coordenadas (RF-9 (001)). */
export function resolveLocationDraft(draft: LocationDraft): Validation<LocationEdit> {
  if (draft.mode !== 'set') return valid(draft);
  const point = validateCoordinates(parseDegrees(draft.lat), parseDegrees(draft.lng));
  if (!point.ok) return invalid(point.code);
  return valid({ mode: 'set', lat: point.value.lat, lng: point.value.lng, precision: draft.precision });
}

/** Escribir en un campo abre un borrador aproximado; vaciar ambos vuelve a conservar lo guardado. */
export function typeCoordinates(draft: LocationDraft, changes: { lat?: string; lng?: string }): LocationDraft {
  const base = draft.mode === 'set' ? draft : { lat: '', lng: '', precision: draft.mode === 'precision' ? draft.precision : DEFAULT_PRECISION };
  const lat = changes.lat ?? base.lat;
  const lng = changes.lng ?? base.lng;
  if (lat === '' && lng === '') return KEEP_LOCATION;
  return { mode: 'set', lat, lng, precision: base.precision };
}

/** Borrador guardado en el navegador; si está dañado o incompleto, se vuelve a conservar. */
export function restoreLocationDraft(raw: unknown): LocationDraft {
  if (typeof raw !== 'object' || raw === null) return KEEP_LOCATION;
  const { mode, lat, lng, precision } = raw as Record<string, unknown>;
  const known = PRECISIONS.find((candidate) => candidate === precision);
  if (mode === 'keep' || mode === 'remove') return { mode };
  if (mode === 'precision' && known) return { mode, precision: known };
  if (mode === 'set' && known && typeof lat === 'string' && typeof lng === 'string') return { mode, lat, lng, precision: known };
  return KEEP_LOCATION;
}
