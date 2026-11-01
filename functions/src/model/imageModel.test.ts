// Puerto del modelo de imágenes y su doble de pruebas (D-T7 (001)).
import { describe, expect, it } from 'vitest';
import { ImageModelError, createFakeImageModel, type ImageModel } from './imageModel';

const request = { prompt: 'una huerta', references: [] as Uint8Array[] };

describe('doble del modelo de imágenes', () => {
  it('RF-17 (001): devuelve la imagen configurada y registra las peticiones', async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const fake = createFakeImageModel({ image: bytes });
    const model: ImageModel = fake;
    expect([...(await model.generate(request))]).toEqual([1, 2, 3]);
    expect(fake.requests).toEqual([request]);
  });

  it.each(['failure', 'timeout', 'empty', 'rejected'] as const)(
    'RF-20 (001): el error «%s» sale tipificado',
    async (kind) => {
      const model = createFakeImageModel({ error: kind });
      const error = await model.generate(request).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ImageModelError);
      expect((error as ImageModelError).kind).toBe(kind);
    },
  );

  it('RF-20 (001): un resultado vacío del doble es el error «empty»', async () => {
    const model = createFakeImageModel({ image: new Uint8Array() });
    const error = await model.generate(request).catch((e: unknown) => e);
    expect((error as ImageModelError).kind).toBe('empty');
  });

  it('RF-20 (001): el doble puede cambiar de comportamiento entre llamadas', async () => {
    const model = createFakeImageModel({ error: 'failure' });
    await expect(model.generate(request)).rejects.toBeInstanceOf(ImageModelError);
    model.setBehavior({ image: Uint8Array.from([9]) });
    expect([...(await model.generate(request))]).toEqual([9]);
  });
});
