// Genera las imágenes de marca de `public/brand/` desde `shared/domain/identity/brand.ts` (T-7.1,
// RF-1 (002) · 1.7, RF-11 (002) · 11.1, 11.2, D-19 (002), D-T6 (002)). Los SVG se escriben como texto; los
// PNG se rasterizan en Chromium con `brand-raster.mjs`, el mismo rasterizador de la prueba de sincronía
// (T-7.2). Carga el TypeScript con Vite, como `gen-tokens.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { rasterizeBrand } from './brand-raster.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'public/brand');
const server = await createServer({ root, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
let browser;
try {
  const { BRAND_IMAGES, brandSvg } = await server.ssrLoadModule('/shared/domain/identity/brand.ts');
  mkdirSync(out, { recursive: true });
  browser = await chromium.launch();
  const page = await browser.newPage();
  for (const image of BRAND_IMAGES) {
    const svg = brandSvg(image);
    const path = resolve(out, image.file);
    if (image.raster) {
      const png = await page.evaluate(rasterizeBrand, { svg, width: image.width, height: image.height });
      writeFileSync(path, Buffer.from(png, 'base64'));
    } else {
      writeFileSync(path, svg);
    }
  }
  console.log(`gen-brand-images: escritas ${BRAND_IMAGES.length} imágenes en public/brand/.`);
} finally {
  await browser?.close();
  await server.close();
}
