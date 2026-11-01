// RF-6 (001) · Lectura común del contenido de la ficha que llega en el payload de las ops de ápices.
import { APICE_STATUSES, validateContent, type ApiceStatus } from '../../../shared/domain/apice';
import { DEFAULT_PRECISION, validateCoordinates, type Precision } from '../../../shared/domain/location';
import { ApiError } from '../errors';
import type { LocationChange, StoredContent } from '../apiceStore';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalText = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ApiError('invalid-request');
  return value;
};

/** Valida forma y contenido; el primer problema de la ficha se devuelve como su código. */
export function readContent(raw: unknown, fallbackStatus?: ApiceStatus): StoredContent {
  if (!isObject(raw)) throw new ApiError('invalid-request');
  const { name, description, axes, status } = raw;
  if (typeof name !== 'string' || typeof description !== 'string') throw new ApiError('invalid-request');
  if (!Array.isArray(axes) || !axes.every((axis) => typeof axis === 'string')) throw new ApiError('invalid-request');
  const needs = optionalText(raw['needs']);
  const offers = optionalText(raw['offers']);
  const checked = validateContent({
    name,
    description,
    axes: axes as string[],
    ...(needs === undefined ? {} : { needs }),
    ...(offers === undefined ? {} : { offers }),
  });
  if (!checked.ok) throw new ApiError(checked.issues[0]?.code ?? 'invalid-request');
  const resolved = status ?? fallbackStatus;
  if (typeof resolved !== 'string' || !(APICE_STATUSES as readonly string[]).includes(resolved)) {
    throw new ApiError('invalid-request');
  }
  return { ...checked.value, status: resolved as ApiceStatus };
}

export function readId(payload: Record<string, unknown>): string {
  const id = payload['id'];
  if (typeof id !== 'string' || id === '' || id.length > 128 || id.includes('/')) throw new ApiError('invalid-request');
  return id;
}

export function readInteger(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) throw new ApiError('invalid-request');
  return value;
}

const readPrecision = (value: unknown): Precision => {
  if (value === 'approximate' || value === 'exact') return value;
  throw new ApiError('invalid-request');
};

/** Lee el campo `location` del payload (RF-9 (001)); ausente equivale a conservar. */
export function readLocationChange(raw: unknown): LocationChange {
  if (raw === undefined) return { mode: 'keep' };
  if (!isObject(raw)) throw new ApiError('invalid-request');
  switch (raw['mode']) {
    case 'keep':
      return { mode: 'keep' };
    case 'remove':
      return { mode: 'remove' };
    case 'precision':
      return { mode: 'precision', precision: readPrecision(raw['precision']) };
    case 'set': {
      const checked = validateCoordinates(raw['lat'], raw['lng']);
      if (!checked.ok) throw new ApiError(checked.code);
      const precision = raw['precision'] === undefined ? DEFAULT_PRECISION : readPrecision(raw['precision']);
      return { mode: 'set', point: checked.value, precision };
    }
    default:
      throw new ApiError('invalid-request');
  }
}
