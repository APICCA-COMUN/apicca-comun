// Utillaje de las pruebas de ops de ápices; no es código de producción ni cita requisitos.
import { ApiError } from '../errors';
import type { Ctx } from '../context';
import type { TestCtx } from './index';

export async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

/** Ctx cuya transacción corre `before` justo antes de empezar. */
export function withBeforeTransaction(base: TestCtx, before: () => Promise<void>): Ctx {
  const db = new Proxy(base.db, {
    get(target, prop) {
      if (prop === 'runTransaction') {
        return async (...args: unknown[]) => {
          await before();
          return (target.runTransaction as (...a: unknown[]) => Promise<unknown>)(...args);
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { ...base, db };
}

export const VALID = {
  name: 'Huerta del barrio',
  description: 'Una huerta compartida.',
  axes: ['alimento'],
  needs: '',
  offers: '',
};
