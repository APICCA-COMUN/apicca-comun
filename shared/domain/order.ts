// Orden y comparación de sellos de tiempo. Las consultas de Firestore fijan el orden de cada
// lista con `orderBy`; estos comparadores lo documentan y lo prueban, y sirven para ordenar en
// el cliente lo que llega de varias páginas o de dobles. Cada capacidad nueva agrega aquí el
// comparador de su lista, apoyado en `compareTimestamps`.

/** Forma de un `Timestamp` de Firestore sin depender del SDK. */
export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
}

/**
 * Un sello de tiempo se reconoce por su forma y no por su clase: el `Timestamp` del SDK
 * web y el del Admin SDK la cumplen, y también el mapa plano que devuelve Firestore
 * cuando el valor se guardó sin convertir. Quien lee de la base no sabe cuál le llega,
 * así que comprueba esto antes de comparar en vez de fiarse de un método.
 */
export function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TimestampLike).seconds === 'number' &&
    typeof (value as TimestampLike).nanoseconds === 'number'
  );
}

/** Ascendente: negativo si `a` es anterior a `b`. */
export function compareTimestamps(a: TimestampLike, b: TimestampLike): number {
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}

/** Descendente: el más reciente primero. */
export function compareTimestampsDescending(a: TimestampLike, b: TimestampLike): number {
  return compareTimestamps(b, a);
}
