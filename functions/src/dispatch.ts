// Puerta común de las callables (D-T2 (001)): comprueba forma y tamaño de `{ op, ...payload }`
// y busca la op antes de aplicar ninguna regla (RNF-5 (001)).
import type { Ctx } from './context';
import { ApiError } from './errors';

/** Techo del `{ op, ...payload }` serializado. Cabe el texto máximo de una ficha (3 × 10.000 puntos de código, hasta 4 bytes cada uno). */
export const MAX_PAYLOAD_BYTES = 256 * 1024;

/** `uid` es `null` cuando quien llama no tiene sesión. */
export type OpHandler = (ctx: Ctx, payload: Record<string, unknown>, uid: string | null) => Promise<unknown>;

export async function dispatch(
  ops: Readonly<Record<string, OpHandler>>,
  data: unknown,
  ctx: Ctx,
  uid: string | null,
): Promise<unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new ApiError('invalid-request');
  const { op, ...payload } = data as Record<string, unknown>;
  if (typeof op !== 'string' || op === '') throw new ApiError('invalid-request');
  let size: number;
  try {
    size = Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch {
    throw new ApiError('invalid-request');
  }
  if (size > MAX_PAYLOAD_BYTES) throw new ApiError('payload-too-large');
  const handler = Object.hasOwn(ops, op) ? ops[op] : undefined;
  if (handler === undefined) throw new ApiError('unknown-op');
  return handler(ctx, payload, uid);
}
