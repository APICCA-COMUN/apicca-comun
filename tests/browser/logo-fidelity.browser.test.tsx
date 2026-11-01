// Fidelidad del logo (T-7.4, RF-1 (002) · 1.4, D-T6 (002), plan §9.4): el SVG del dominio, dibujado
// sobre `BRAND_BACKING` (D-T3 (003)) con las dimensiones del PNG original, alineado por el recuadro de su contenido y escalado
// con suavizado, difiere en 2 % de píxeles o menos.
// Referencia: `tests/browser/reference/apicca_logo.png` es una copia, hecha una sola vez el 9 de octubre de
// 2026, de `resetario/public/img/apicca_logo.png` (768×281, marca propia de APICCA). La prueba no lee
// `resetario`.
import { describe, expect, it } from 'vitest';
import { BRAND_BACKING, BRAND_IMAGES, TOKENS, brandSvg } from '../../shared/domain/identity';
import referenceUrl from './reference/apicca_logo.png?url';

const WIDTH = 768;
const HEIGHT = 281;
/** Diferencia por canal a partir de la cual un píxel cuenta como distinto (el suavizado queda por debajo). */
const CHANNEL_TOLERANCE = 48;
const backing = BRAND_BACKING;

type Box = { x: number; y: number; width: number; height: number };

async function load(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

function onPlate(draw: (context: CanvasRenderingContext2D) => void): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.fillStyle = backing;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  draw(context);
  return context;
}

/** El recuadro de los píxeles que se apartan de `BRAND_BACKING`. */
function contentBox(context: CanvasRenderingContext2D): Box {
  const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
  let [left, top, right, bottom] = [WIDTH, HEIGHT, -1, -1];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const i = (y * WIDTH + x) * 4;
      if (Math.max(255 - data[i]!, 255 - data[i + 1]!, 255 - data[i + 2]!) > CHANNEL_TOLERANCE) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Fracción de píxeles distintos entre la referencia y el SVG dado, alineados por su contenido. */
async function mismatch(svg: string): Promise<number> {
  const reference = onPlate(async () => undefined);
  reference.drawImage(await load(referenceUrl), 0, 0, WIDTH, HEIGHT);
  const logo = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const raw = onPlate((context) => context.drawImage(logo, 0, 0, WIDTH, HEIGHT));
  const [want, have] = [contentBox(reference), contentBox(raw)];
  const aligned = onPlate((context) =>
    context.drawImage(raw.canvas, have.x, have.y, have.width, have.height, want.x, want.y, want.width, want.height),
  );
  const a = reference.getImageData(0, 0, WIDTH, HEIGHT).data;
  const b = aligned.getImageData(0, 0, WIDTH, HEIGHT).data;
  let different = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!)) > CHANNEL_TOLERANCE) different += 1;
  }
  return different / (WIDTH * HEIGHT);
}

const logoSvg = brandSvg(BRAND_IMAGES.find((image) => image.file === 'logo.svg')!);

describe('fidelidad del logo', () => {
  it('RF-1 (002) · 1.4: el SVG difiere del logo original en 2 % de píxeles o menos', async () => {
    const reference = await load(referenceUrl);
    expect([reference.naturalWidth, reference.naturalHeight]).toEqual([WIDTH, HEIGHT]);
    expect(await mismatch(logoSvg)).toBeLessThanOrEqual(0.02);
  });

  it('RF-1 (002) · 1.4: la comparación detecta un cambio de color en las «cc»', async () => {
    const red = TOKENS.light['logo-red'];
    expect(logoSvg).toContain(`fill="${red}"`);
    expect(await mismatch(logoSvg.replaceAll(`fill="${red}"`, `fill="${TOKENS.light['logo-blue']}"`))).toBeGreaterThan(0.02);
  });
});
