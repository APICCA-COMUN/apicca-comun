// T-5.5 y T-5.6: lectura y reescritura de imágenes de referencia (RF-15 (001), D-T9 (001)).
// Las imágenes de prueba se generan con sharp: no hay binarios versionados.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PALETTE, PIXEL_SIZE } from '../../shared/domain/images';
import { inspectImage, stripMetadata, toPixelPng } from './images';

const MAX = 4096;

const png = (width = 8, height = 8): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } }).png().toBuffer();

const jpegWithGps = (): Promise<Buffer> =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: '#cc3333' } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 26/1 46/1', GPSLongitudeRef: 'W', GPSLongitude: '79/1 58/1 56/1' } })
    .toBuffer();

const animatedGif = (): Promise<Buffer> => {
  const frame = (shade: number): Buffer => Buffer.alloc(8 * 8 * 4, shade);
  return sharp(Buffer.concat([frame(0), frame(200)]), { raw: { width: 8, height: 16, channels: 4, pageHeight: 8 } })
    .gif({ loop: 0, delay: [100, 100] })
    .toBuffer();
};

describe('functions/images · inspectImage', () => {
  it('RF-15 (001): un PNG con extensión .jpg se identifica como PNG por su contenido', async () => {
    // La extensión nunca llega a la función: solo los bytes. El formato sale de ellos.
    const result = await inspectImage(await png(20, 10), MAX);
    expect(result).toEqual({ ok: true, value: { format: 'png', contentType: 'image/png', width: 20, height: 10 } });
  });

  it('RF-15 (001): JPG y WebP también se reconocen', async () => {
    const jpg = await inspectImage(await jpegWithGps(), MAX);
    expect(jpg.ok && jpg.value.contentType).toBe('image/jpeg');
    const webp = await inspectImage(await sharp(await png()).webp().toBuffer(), MAX);
    expect(webp.ok && webp.value.contentType).toBe('image/webp');
  });

  it('RF-15 (001): un GIF animado se rechaza como animado', async () => {
    expect(await inspectImage(await animatedGif(), MAX)).toEqual({ ok: false, code: 'image-animated' });
  });

  it('RF-15 (001): un GIF estático no es un formato admitido', async () => {
    const still = await sharp(await png()).gif().toBuffer();
    expect(await inspectImage(still, MAX)).toEqual({ ok: false, code: 'image-type-unsupported' });
  });

  it('RF-15 (001): un WebP animado se rechaza como animado', async () => {
    const frame = (shade: number): Buffer => Buffer.alloc(8 * 8 * 4, shade);
    const webp = await sharp(Buffer.concat([frame(0), frame(200)]), { raw: { width: 8, height: 16, channels: 4, pageHeight: 8 } })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect(await inspectImage(webp, MAX)).toEqual({ ok: false, code: 'image-animated' });
  });

  it('RF-15 (001): 4096 px se aceptan y 4097 px se rechazan, en cada lado', async () => {
    expect((await inspectImage(await png(4096, 8), MAX)).ok).toBe(true);
    expect(await inspectImage(await png(4097, 8), MAX)).toEqual({ ok: false, code: 'image-dimensions-exceeded' });
    expect(await inspectImage(await png(8, 4097), MAX)).toEqual({ ok: false, code: 'image-dimensions-exceeded' });
  });

  it('RF-15 (001): un archivo de texto con extensión .png no se puede leer como imagen', async () => {
    expect(await inspectImage(Buffer.from('esto no es una imagen'), MAX)).toEqual({ ok: false, code: 'image-unreadable' });
    expect(await inspectImage(new Uint8Array(0), MAX)).toEqual({ ok: false, code: 'image-unreadable' });
  });

  it('RF-15 (001): una imagen truncada o corrupta se rechaza como ilegible', async () => {
    const whole = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#abcdef' } }).png().toBuffer();
    const corrupt = Buffer.concat([whole.subarray(0, 40), Buffer.alloc(30, 7)]);
    const result = await inspectImage(corrupt, MAX);
    expect(result.ok).toBe(false);
  });

  it('RF-15 (001): un SVG no es un formato admitido', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    const result = await inspectImage(svg, MAX);
    expect(result.ok).toBe(false);
  });
});

describe('functions/images · stripMetadata', () => {
  it('RF-15 (001): un JPG con geolocalización EXIF sale sin ningún metadato', async () => {
    const original = await jpegWithGps();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const clean = await stripMetadata(original, 'jpeg');
    const meta = await sharp(clean).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(clean.includes(Buffer.from('GPS'))).toBe(false);
  });

  it('RF-15 (001): conserva formato y dimensiones al reescribir PNG y WebP', async () => {
    const cleanPng = await sharp(await stripMetadata(await png(30, 12), 'png')).metadata();
    expect([cleanPng.format, cleanPng.width, cleanPng.height]).toEqual(['png', 30, 12]);
    const webp = await sharp(await png(30, 12)).webp().toBuffer();
    const cleanWebp = await sharp(await stripMetadata(webp, 'webp')).metadata();
    expect([cleanWebp.format, cleanWebp.width, cleanWebp.height]).toEqual(['webp', 30, 12]);
  });

  it('RF-15 (001): aplica la orientación EXIF antes de quitarla, para que la imagen no gire', async () => {
    const tall = await sharp({ create: { width: 10, height: 20, channels: 3, background: '#111111' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const meta = await sharp(await stripMetadata(tall, 'jpeg')).metadata();
    expect([meta.width, meta.height, meta.orientation]).toEqual([20, 10, undefined]);
  });
});

describe('functions/images · toPixelPng', () => {
  it('RF-17 (001): escala a 64 × 64 y deja solo colores de la paleta, sea cual sea la entrada', async () => {
    const gradient = await sharp({ create: { width: 200, height: 120, channels: 3, background: '#7a3b9e' } })
      .composite([{ input: await png(50, 50), left: 10, top: 10 }])
      .png()
      .toBuffer();
    const out = await toPixelPng(gradient);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', PIXEL_SIZE, PIXEL_SIZE]);
    const raw = await sharp(out).removeAlpha().raw().toBuffer();
    const palette = new Set(PALETTE.map((c) => c.join(',')));
    for (let i = 0; i < raw.length; i += 3) expect(palette.has(`${raw[i]},${raw[i + 1]},${raw[i + 2]}`)).toBe(true);
  });

  it('RF-17 (001): reduce sin suavizar: cada píxel conserva un color de la entrada y los bordes quedan nítidos', async () => {
    // Damero de bloques de 2 × 2 px en 128 × 128: al bajar a 64 × 64, cada bloque es un píxel.
    // Un núcleo que promedia mezclaría vecinos; el vecino más cercano no.
    const [a, b] = [PALETTE[0], PALETTE[12]] as [readonly number[], readonly number[]];
    const side = PIXEL_SIZE * 2;
    const input = Buffer.alloc(side * side * 3);
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) input.set((Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? a : b, (y * side + x) * 3);
    const checker = await sharp(input, { raw: { width: side, height: side, channels: 3 } }).png().toBuffer();
    const raw = await sharp(await toPixelPng(checker)).removeAlpha().raw().toBuffer();
    for (let y = 0; y < PIXEL_SIZE; y++)
      for (let x = 0; x < PIXEL_SIZE; x++) {
        const i = (y * PIXEL_SIZE + x) * 3;
        expect([raw[i], raw[i + 1], raw[i + 2]]).toEqual([...((x + y) % 2 === 0 ? a : b)]);
      }
  });

  it('RF-17 (001): una imagen con transparencia no rompe el proceso', async () => {
    const withAlpha = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const meta = await sharp(await toPixelPng(withAlpha)).metadata();
    expect([meta.width, meta.height]).toEqual([PIXEL_SIZE, PIXEL_SIZE]);
  });

  it('RF-20 (001): bytes que no son una imagen se rechazan con un error', async () => {
    await expect(toPixelPng(Uint8Array.from([1, 2, 3]))).rejects.toThrow();
  });
});
