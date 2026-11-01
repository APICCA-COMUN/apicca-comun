// Imágenes de marca como SVG (RF-1 (002) · 1.7, RF-11 (002) · 11.1, 11.2, RF-12 (002), D-T6 (002), D-19 (002), RF-2 (003) · 2.5, D-T2 (003)):
// los trazados del logo y los colores de los tokens del tema claro. `scripts/gen-brand-images.mjs` escribe los SVG
// y rasteriza los PNG en Chromium; la prueba de sincronía repite lo mismo y compara.
import { FAVICON, LOGO, type LayeredIcon } from './icons';
import { TOKENS } from './tokens';

/** Fondo de las imágenes de marca que conservan el suyo (RF-2 (003) · 2.5); no es un token de interfaz. */
export const BRAND_BACKING = '#FFFFFF';

type Box = { x: number; y: number; width: number; height: number };

export interface BrandImage {
  /** Nombre del archivo en `public/brand/`. */
  readonly file: string;
  readonly width: number;
  readonly height: number;
  /** Verdadero si se rasteriza a PNG; si no, el SVG se escribe como texto. */
  readonly raster: boolean;
  /** Fondo de pantalla completa, si lo hay: el token `background` o `BRAND_BACKING`. */
  readonly background?: 'background' | 'backing';
  /** Panel redondeado de `BRAND_BACKING` bajo el ícono, si lo hay. */
  readonly panel?: Box & { radius: number };
  readonly icon: LayeredIcon;
  /** Dónde va el ícono; por defecto, toda la imagen. */
  readonly at?: Box;
}

export const BRAND_IMAGES: readonly BrandImage[] = [
  { file: 'logo.svg', width: 768, height: 281, raster: false, icon: LOGO },
  { file: 'favicon.svg', width: 322, height: 322, raster: false, icon: FAVICON },
  {
    file: 'og-image.png',
    width: 1200,
    height: 630,
    raster: true,
    background: 'background',
    panel: { x: 160, y: 119, width: 880, height: 392, radius: 24 },
    icon: LOGO,
    at: { x: 216, y: 174.5, width: 768, height: 281 },
  },
  {
    file: 'apple-touch-icon.png',
    width: 180,
    height: 180,
    raster: true,
    background: 'backing',
    icon: FAVICON,
    at: { x: 18, y: 18, width: 144, height: 144 },
  },
  { file: 'favicon-32.png', width: 32, height: 32, raster: true, icon: FAVICON },
  {
    file: 'logo.png',
    width: 384,
    height: 141,
    raster: true,
    background: 'backing',
    icon: LOGO,
    at: { x: 8, y: 3, width: 368, height: 135 },
  },
];

const colors = TOKENS.light;

function layers(icon: LayeredIcon): string {
  return icon.layers.map((layer) => `<path fill="${colors[layer.token]}" d="${layer.d}" fill-rule="evenodd"/>`).join('');
}

/** El SVG completo de una imagen de marca. */
export function brandSvg(image: BrandImage): string {
  const { width, height, icon } = image;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
  if (!image.background && !image.panel && !image.at) return `${head} viewBox="${icon.viewBox}">${layers(icon)}</svg>\n`;
  const at = image.at ?? { x: 0, y: 0, width, height };
  const parts = [
    image.background
      ? `<rect width="${width}" height="${height}" fill="${image.background === 'backing' ? BRAND_BACKING : colors.background}"/>`
      : '',
    image.panel
      ? `<rect x="${image.panel.x}" y="${image.panel.y}" width="${image.panel.width}" height="${image.panel.height}" rx="${image.panel.radius}" fill="${BRAND_BACKING}"/>`
      : '',
    `<svg x="${at.x}" y="${at.y}" width="${at.width}" height="${at.height}" viewBox="${icon.viewBox}">${layers(icon)}</svg>`,
  ];
  return `${head} viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>\n`;
}
