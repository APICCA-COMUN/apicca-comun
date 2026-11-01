// T-6.10: espera acotada al modelo (RF-20 (001)).
import { describe, expect, it } from 'vitest';
import { ImageModelError } from './imageModel';
import { withTimeout } from './timeout';

describe('withTimeout', () => {
  it('RF-20 (001): si el modelo tarda más del máximo, falla con el tipo `timeout`', async () => {
    const never = new Promise<Uint8Array>(() => undefined);
    const error = await withTimeout(never, 20).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageModelError);
    expect((error as ImageModelError).kind).toBe('timeout');
  });

  it('RF-17 (001): si responde a tiempo, devuelve el resultado', async () => {
    expect(await withTimeout(Promise.resolve(Uint8Array.from([1])), 1000)).toEqual(Uint8Array.from([1]));
  });

  it('RF-20 (001): propaga el error del modelo tal cual', async () => {
    const error = await withTimeout(Promise.reject(new ImageModelError('rejected')), 1000).catch((e: unknown) => e);
    expect((error as ImageModelError).kind).toBe('rejected');
  });
});
