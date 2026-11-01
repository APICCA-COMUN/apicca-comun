// Sincronía de las imágenes de marca (T-7.2, plan §9.1): regenera en memoria cada archivo de
// `public/brand/` desde el dominio y lo compara con el versionado. Los SVG, como texto; los PNG, píxel
// a píxel ya decodificados (los bytes del PNG pueden cambiar sin que cambie la imagen). Si alguien
// cambia un trazado o un color sin correr `npm run gen-brand-images`, esta prueba falla.
import { describe, expect, it } from 'vitest';
import { BRAND_IMAGES, brandSvg } from '../../shared/domain/identity';
import { rasterizeBrand } from '../../scripts/brand-raster.mjs';

async function pixels(source: Blob, width: number, height: number): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(source);
  expect([bitmap.width, bitmap.height]).toEqual([width, height]);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, width, height).data;
}

const base64Blob = (data: string) => new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: 'image/png' });

describe('imágenes de marca versionadas', () => {
  it.each(BRAND_IMAGES.filter((image) => !image.raster))('RF-1 (002) · 1.7, RF-11 (002) · 11.1: $file coincide con el dominio', async (image) => {
    const response = await fetch(`/brand/${image.file}`);
    expect(response.ok, `falta public/brand/${image.file}: corre npm run gen-brand-images`).toBe(true);
    expect(await response.text()).toBe(brandSvg(image));
  });

  it.each(BRAND_IMAGES.filter((image) => image.raster))('RF-1 (002) · 1.7, RF-11 (002) · 11.1, 11.2: $file coincide píxel a píxel con el dominio', async (image) => {
    const response = await fetch(`/brand/${image.file}`);
    expect(response.ok, `falta public/brand/${image.file}: corre npm run gen-brand-images`).toBe(true);
    const stored = await pixels(await response.blob(), image.width, image.height);
    const fresh = await pixels(base64Blob(await rasterizeBrand({ svg: brandSvg(image), width: image.width, height: image.height })), image.width, image.height);
    let different = 0;
    for (let i = 0; i < stored.length; i += 1) if (Math.abs(stored[i]! - fresh[i]!) > 2) different += 1;
    expect(different, `${image.file} no coincide: corre npm run gen-brand-images`).toBe(0);
  });
});
