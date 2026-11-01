// RF-9 (016) · 9.2, D-T14 (016) · Lectura segura de identificadores del payload: rechaza vacío, más de 128 caracteres, «/», «.» y «..».
import { ApiError } from './errors';

/** Lee un identificador opaco del payload que entrará en una ruta de Firestore o Storage. */
export function readSafeId(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value === '' || value.length > 128 || value.includes('/') || value === '.' || value === '..') {
    throw new ApiError('invalid-request');
  }
  return value;
}
