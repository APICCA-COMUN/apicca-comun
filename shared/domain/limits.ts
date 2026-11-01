// Límites y normalización de texto. Los caracteres se cuentan como puntos de código
// Unicode, saltos de línea incluidos, y cada límite es inclusivo. Las reglas de Firestore
// que repitan estos límites deben usar un techo de 4 × porque `string.size()` cuenta
// unidades UTF-16.
//
// Toda capacidad nueva que necesite un tope lo agrega a esta misma tabla (con su spec);
// `countCodePoints`, `validateLength` y `excessReason` sirven tal cual, de modo que no haya
// una segunda manera de contar en el sitio.

export const LIMITS = {
  /** Títulos. */
  title: 120,
  /** Textos largos. */
  text: 10_000,
  /** Descripción de un enlace o una imagen. */
  linkDescription: 200,
  /** Nombre de una persona. */
  name: 80,
  /** Descripción corta de perfil de una persona. */
  bio: 256,
  /** Correo electrónico. */
  email: 254,
  /** Dirección de un enlace o imagen. */
  url: 2_000,
  /** Enlaces por contenido. */
  links: 10,
  /** Mensaje de una solicitud de inscripción (RF-4 (001)). */
  enrollmentMessage: 2_000,
  /** Nombre de usuario: máximo y mínimo (RF-2 (001)). */
  username: 24,
  usernameMin: 3,
  /** Contraseña: mínimo (RF-2 (001)). */
  passwordMin: 8,
  /** Motivo de una propuesta o de una objeción de la constitución (RF-16 (004), D-T17 (004)). */
  reason: 2_000,
  /** Comentario de una deliberación (RF-16 (004), D-T17 (004)). */
  comment: 10_000,
  /** Propuestas de cambio abiertas a la vez (RF-16 (004) · 4, D-12 (004)). */
  openAmendments: 100,
} as const;

/** Cuenta puntos de código Unicode (un emoji es uno; un salto de línea es uno). */
export function countCodePoints(text: string): number {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

export interface LengthResult {
  ok: boolean;
  limit: number;
  count: number;
  /** Cuántos puntos de código sobran; 0 si cabe. */
  excess: number;
}

/** Comprueba un límite inclusivo y devuelve el límite y cuántos caracteres sobran. */
export function validateLength(text: string, limit: number): LengthResult {
  const count = countCodePoints(text);
  const excess = Math.max(0, count - limit);
  return { ok: excess === 0, limit, count, excess };
}

/** «El texto admite hasta 10000 caracteres: sobran 3 caracteres.» con el plural correcto. */
export function excessReason(what: string, length: LengthResult): string {
  const excess = length.excess === 1 ? 'sobra 1 carácter' : `sobran ${length.excess} caracteres`;
  return `${what} admite hasta ${length.limit} caracteres: ${excess}.`;
}

/** Un campo obligatorio que solo contiene espacios en blanco se trata como vacío. */
export function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/** Los correos se guardan y comparan en minúsculas, sin espacios alrededor. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
