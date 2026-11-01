// RF-1 (002) · 1.7, RF-11 (002) · 11.1, 11.2, RF-12 (002), D-T6 (002): las imágenes de marca se describen en el
// dominio como SVG, con los trazados del logo y los colores de los tokens; `gen-brand-images` solo las escribe.
// RF-2 (003) · 2.5, D-T2 (003): las imágenes que se ven fuera de la página conservan su fondo (BRAND_BACKING)
// y og-image toma el background claro nuevo.
import { describe, expect, it } from 'vitest';
import { BRAND_BACKING, BRAND_IMAGES, brandSvg } from './brand';
import { FAVICON, LOGO } from './icons';
import { TOKENS } from './tokens';

const byFile = (file: string) => BRAND_IMAGES.find((image) => image.file === file)!;

describe('imágenes de marca', () => {
  it('RF-11 (002) · 11.1, 11.2, RF-1 (002) · 1.7: describe los seis archivos con sus medidas', () => {
    expect(BRAND_IMAGES.map((image) => [image.file, image.width, image.height])).toEqual([
      ['logo.svg', 768, 281],
      ['favicon.svg', 322, 322],
      ['og-image.png', 1200, 630],
      ['apple-touch-icon.png', 180, 180],
      ['favicon-32.png', 32, 32],
      ['logo.png', 384, 141],
    ]);
  });

  it('RF-1 (002) · 1.7: el favicon lleva las capas roja y azul, sin el gris, con los colores del logo', () => {
    const svg = brandSvg(byFile('favicon.svg'));
    expect(svg).toContain(`viewBox="${FAVICON.viewBox}"`);
    for (const layer of FAVICON.layers) expect(svg).toContain(`fill="${TOKENS.light[layer.token]}" d="${layer.d}"`);
    expect(svg).not.toContain(TOKENS.light['logo-gray']);
  });

  it('RF-1 (002) · 1.4: el logo lleva sus tres capas con sus colores y la regla evenodd', () => {
    const svg = brandSvg(byFile('logo.svg'));
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    for (const layer of LOGO.layers) expect(svg).toContain(`fill="${TOKENS.light[layer.token]}" d="${layer.d}"`);
    expect(svg.match(/fill-rule="evenodd"/g)).toHaveLength(LOGO.layers.length);
  });

  it('RF-11 (002) · 11.1: la vista previa pone el logo sobre la placa, encima del fondo del tema claro', () => {
    const svg = brandSvg(byFile('og-image.png'));
    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain(`fill="${TOKENS.light.background}"`);
    expect(svg).toContain(`fill="${BRAND_BACKING}"`);
    for (const layer of LOGO.layers) expect(svg).toContain(layer.d);
  });

  it('RF-11 (002) · 11.2: el ícono de inicio pone las «cc» sobre la placa', () => {
    const svg = brandSvg(byFile('apple-touch-icon.png'));
    expect(svg).toContain('width="180" height="180"');
    expect(svg).toContain(`fill="${BRAND_BACKING}"`);
    for (const layer of FAVICON.layers) expect(svg).toContain(layer.d);
  });

  it('RF-12 (002): el logo del correo va sobre la placa y los PNG se marcan para rasterizar', () => {
    expect(brandSvg(byFile('logo.png'))).toContain(`fill="${BRAND_BACKING}"`);
    expect(BRAND_IMAGES.filter((image) => image.file.endsWith('.png')).every((image) => image.raster)).toBe(true);
    expect(BRAND_IMAGES.filter((image) => image.file.endsWith('.svg')).some((image) => image.raster)).toBe(false);
  });

  it('RF-2 (003) · 2.5: BRAND_BACKING existe, vale #FFFFFF y no es un token de interfaz', () => {
    expect(BRAND_BACKING).toBe('#FFFFFF');
    expect(Object.keys(TOKENS.light)).not.toContain('plate');
  });

  it('RF-2 (003) · 2.5: apple-touch-icon, logo del correo y logo conservan su fondo blanco', () => {
    expect(brandSvg(byFile('apple-touch-icon.png'))).toContain(`<rect width="180" height="180" fill="${BRAND_BACKING}"/>`);
    expect(brandSvg(byFile('logo.png'))).toContain(`<rect width="384" height="141" fill="${BRAND_BACKING}"/>`);
    expect(byFile('logo.svg').background).toBeUndefined();
  });

  it('RF-2 (003) · 2.5: og-image toma el background claro nuevo (#E8E7EC) como fondo', () => {
    expect(TOKENS.light.background).toBe('#E8E7EC');
    expect(brandSvg(byFile('og-image.png'))).toContain(`<rect width="1200" height="630" fill="${TOKENS.light.background}"/>`);
  });
});
