// Tope diario, política de fallas y texto de la petición de imagen (RF-17 (001), RF-19 (001),
// RF-20 (001)). Puro: el reloj llega como `Date` y el conteo lo guarda el servidor (D-T8 (001)).
import type { Axis } from './apice';

/** Generaciones por persona y día (RF-19 (001)). */
export const DAILY_LIMIT = 3;
/** Generaciones por día entre todas las personas (RF-19 (001), D-6 (001)). */
export const GLOBAL_DAILY_LIMIT = 60;
/** Tiempo máximo de espera al modelo: 90 s (RF-20 (001), D-6 (001)). */
export const GENERATION_TIMEOUT_MS = 90_000;
/** Fallas consecutivas que bloquean (RF-20 (001), D-6 (001)). */
export const FAILURE_LIMIT = 3;
/** Duración del bloqueo: 15 minutos (RF-20 (001)). */
export const BLOCK_MS = 15 * 60 * 1000;

const COLOMBIA_OFFSET_MS = 5 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** Generaciones que quedan dado lo usado hoy; sirve igual para el tope global (RF-19 (001)). */
export function remaining(used: number, limit: number = DAILY_LIMIT): number {
  return Math.max(0, limit - used);
}

/**
 * Próxima medianoche de Colombia (UTC−5, sin horario de verano) estrictamente posterior a `now`
 * (RF-19 (001)): a las 00:00 exactas el día acaba de reiniciarse y el siguiente reinicio es en 24 h.
 */
export function nextReset(now: Date): Date {
  const shifted = now.getTime() - COLOMBIA_OFFSET_MS;
  const startOfDay = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(startOfDay + DAY_MS + COLOMBIA_OFFSET_MS);
}

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Instante expresado en hora de Colombia, `AAAA-MM-DD HH:mm` (RF-19 (001)). */
export function colombiaClock(instant: Date): string {
  const s = new Date(instant.getTime() - COLOMBIA_OFFSET_MS);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())} ${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
}

/** Fallas seguidas de una persona y, si lo hay, hasta cuándo está bloqueada (RF-20 (001)). */
export interface FailureState {
  consecutive: number;
  blockedUntil: Date | null;
}

export const initialFailureState = (): FailureState => ({ consecutive: 0, blockedUntil: null });

/** Registra el resultado de una generación; devuelve un estado nuevo (RF-20 (001)). */
export function recordOutcome(state: FailureState, outcome: 'success' | 'failure', now: Date): FailureState {
  if (outcome === 'success') return { consecutive: 0, blockedUntil: state.blockedUntil };
  const consecutive = state.consecutive + 1;
  if (consecutive >= FAILURE_LIMIT) {
    return { consecutive: 0, blockedUntil: new Date(now.getTime() + BLOCK_MS) };
  }
  return { consecutive, blockedUntil: state.blockedUntil };
}

/** Verdadero mientras dure el bloqueo; a los 15 minutos exactos ya no (RF-20 (001)). */
export function isBlocked(state: FailureState, now: Date): boolean {
  return state.blockedUntil !== null && now.getTime() < state.blockedUntil.getTime();
}

export interface PromptReference {
  id: string;
  altText: string;
  isRemoved: boolean;
}

export interface PromptInput {
  name: string;
  description: string;
  axes: readonly Axis[];
  references: readonly PromptReference[];
}

export interface BuiltPrompt {
  prompt: string;
  /** Referencias no quitadas, en el orden en que viajan al modelo. */
  referenceIds: string[];
}

/**
 * Texto de la petición al modelo (RF-17 (001)): nombre, descripción, ejes y descripciones de las
 * referencias no quitadas; sirve sin referencias. El tamaño y la paleta no se piden como garantía:
 * los impone el servidor después (D-T7 (001)).
 */
export function buildImagePrompt(input: PromptInput): BuiltPrompt {
  const used = input.references.filter((ref) => !ref.isRemoved);
  const lines = [
    'Crea una imagen cuadrada (sprite) muy sencilla en estilo pixel art retro de 16 bits para un videojuego, que abstraiga lo esencial y representativo de este ápice de apoyo mutuo.',
    'Sujeto central claro, composición icónica y minimalista, bloques de color planos y limpios, contornos oscuros nítidos sin degradados fotográficos ni detalles minuciosos, sobre fondo liso despejado.',
    `Nombre: ${input.name}`,
    `Descripción: ${input.description}`,
  ];
  if (input.axes.length > 0) lines.push(`Ejes de autonomía: ${input.axes.join(', ')}`);
  if (used.length > 0) {
    lines.push('Imágenes de referencia adjuntas, en este orden:');
    used.forEach((ref, index) => lines.push(`${index + 1}. ${ref.altText}`));
  }
  return { prompt: lines.join('\n'), referenceIds: used.map((ref) => ref.id) };
}
