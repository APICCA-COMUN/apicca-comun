// Spec 009 · Foro: límites, validadores, orden y filtro. Dominio puro, sin React, DOM ni Firebase (RNF-1 (009)).
import type { Axis } from '../apice';
import { countCodePoints, excessReason, isBlank, validateLength } from '../limits';
import { textLinkErrors } from '../textFormat';

/** RF-3 (009) · 3.1, 3.3 y RF-1 (009) · 1.1: límites del foro (D-3 (009)). */
export const FORUM_LIMITS = {
  titleMin: 3,
  title: 120,
  message: 2000,
  threadsPerDay: 10,
  pageSize: 20,
  /** RF-1 (018), D-1 (018), D-T1 (018): mensajes por página de un hilo. */
  messagePageSize: 50,
} as const;

export interface ForumValidation {
  ok: boolean;
  reason?: string;
}

const EMPTY = 'Falta un texto obligatorio: no puede quedar vacío ni con solo espacios.';

function check(raw: string, limit: number, what: string, min = 1): ForumValidation {
  if (isBlank(raw)) return { ok: false, reason: EMPTY };
  if (countCodePoints(raw.trim()) < min) return { ok: false, reason: `${what} necesita al menos ${min} caracteres.` };
  const length = validateLength(raw, limit);
  if (!length.ok) return { ok: false, reason: excessReason(what, length) };
  const links = textLinkErrors(raw);
  if (links.length > 0) return { ok: false, reason: links.join(' ') };
  return { ok: true };
}

/** RF-3 (009) · 3.1, 3.2: el título del hilo, de 3 a 120 caracteres. */
export const validateThreadTitle = (title: string): ForumValidation => check(title, FORUM_LIMITS.title, 'El título', FORUM_LIMITS.titleMin);

/** RF-3 (009) · 3.1, RF-4 (009), RF-6 (009): un mensaje, de 1 a 2000 caracteres. */
export const validateMessage = (text: string): ForumValidation => check(text, FORUM_LIMITS.message, 'El mensaje');

export interface ThreadSummary {
  id: string;
  title: string;
  axis: Axis;
  authorUsername: string;
  /** Milisegundos desde la época. */
  lastMessageAt: number;
  messageCount: number;
}

/** RF-1 (009): el hilo con actividad más reciente primero; no altera la lista recibida. */
export const sortByActivity = (threads: readonly ThreadSummary[]): ThreadSummary[] =>
  [...threads].sort((a, b) => b.lastMessageAt - a.lastMessageAt);

/** RF-2 (009): sin eje deja todos los hilos. */
export const filterByAxis = (threads: readonly ThreadSummary[], axis: Axis | null): ThreadSummary[] =>
  axis === null ? [...threads] : threads.filter((t) => t.axis === axis);

/** Nombre de un eje con la inicial en mayúscula. */
export const axisName = (axis: Axis): string => `${axis.charAt(0).toUpperCase()}${axis.slice(1)}`;

/** RF-2 (009) · 2.1: nombre accesible del filtro. */
export const axisFilterLabel = (axis: Axis): string => `Eje ${axisName(axis)}`;

/** RF-1 (009): «N respuestas» con su plural. */
export const repliesLabel = (count: number): string => (count === 1 ? '1 respuesta' : `${count} respuestas`);
