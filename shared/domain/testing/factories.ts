// Utilidades para fábricas de documentos de prueba: los dobles de datos y las pruebas de
// reglas construyen documentos con ellas para no duplicar formas. Cada fábrica de una
// capacidad nueva recibe sobrescrituras y el instante que sella la creación, y se agrega aquí.
import type { TimestampLike } from '../order';

/** Instante por defecto con que las fábricas sellan la creación. */
export const DEFAULT_NOW = new Date('2026-09-01T15:00:00Z');

/** Convierte una fecha en la forma de un `Timestamp` de Firestore. */
export function timestampFrom(date: Date): TimestampLike {
  const millis = date.getTime();
  const seconds = Math.floor(millis / 1000);
  return { seconds, nanoseconds: (millis - seconds * 1000) * 1_000_000 };
}

let counter = 0;

/** Identificador único y legible para documentos de prueba: `prefijo-1`, `prefijo-2`… */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
