// RNF-2 (002), D-T14 (002), RNF-4 (003), RNF-5 (003), D-T24 (003): lo que agrega la identidad visual pesa menos de 150 KB con gzip -9.
// Se compila el sitio en una carpeta temporal y se suman: los CSS emitidos, el trozo `identity`
// (JS de la identidad), la fuente woff2 emitida y `public/brand/favicon.svg`. La `og:image` no cuenta.
//
// Sobre los CSS: se suman TODOS los .css emitidos, no solo `src/styles/` y `src/map/pin.css`. Vite
// los junta en una hoja y no se puede separar por origen; además `leaflet.css` y los de cada
// componente quedan dentro. Es el peor caso: sobrestima el aporte de la identidad, así que si pasa
// el límite con esa suma, pasa con la medida exacta. El gzip -9 también es el peor caso (si el
// hosting sirve brotli, pesa menos).
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../..');
/** Límite de RNF-2 (002): 150 KB. */
const LIMIT_BYTES = 150 * 1024;

/**
 * Módulos que forman el trozo `identity` (D-T14 (002)). `AxisBadge` vive dentro de `AxisIcon`. La piel de la
 * 003 suma `SiteNav`, `SiteFooter`, `RoadSegment`, `Node` y `navigation.ts` (D-T24 (003)); sus hojas ya cuentan
 * porque se suman todos los CSS emitidos. Medido el 9 de octubre de 2026 (T-3.20 (003)): 59,7 KB, con 90,3 KB
 * de margen.
 */
const IDENTITY_MODULE =
  /\/(?:shared\/domain\/identity\/|shared\/domain\/navigation\.|src\/components\/(?:Logo|AxisIcon|AxisBadge|Building|ConditionTag|ThemeToggle|SiteHeader|SiteNav|SiteFooter|RoadSegment|Node)\.|src\/app\/useTheme\.)/;

const outs: string[] = [];
afterAll(() => {
  for (const dir of outs) rmSync(dir, { recursive: true, force: true });
});

const gzipped = (buffer: Buffer): number => gzipSync(buffer, { level: 9 }).length;

describe('peso de la identidad', () => {
  it('RNF-2 (002), RNF-5 (003): con el inicio rediseñado, CSS, trozo identity, fuente y favicon suman menos de 150 KB con gzip -9', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'apicca-weight-'));
    outs.push(outDir);
    // Vitest fija NODE_ENV=test; el peso que importa es el del build de producción.
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({
        root,
        mode: 'production',
        logLevel: 'silent',
        build: {
          outDir,
          emptyOutDir: true,
          rollupOptions: {
            output: {
              manualChunks: (id) => (IDENTITY_MODULE.test(id.split('\\').join('/')) ? 'identity' : undefined),
            },
          },
        },
      });
    } finally {
      process.env.NODE_ENV = savedEnv;
    }

    const emitted = (readdirSync(outDir, { recursive: true }) as string[]).map((name) => name.split('\\').join('/'));
    const pick = (pattern: RegExp) => emitted.filter((name) => pattern.test(name));
    const css = pick(/\.css$/);
    const identity = pick(/(^|\/)identity-[^/]*\.js$/);
    const fonts = pick(/nunito[^/]*\.woff2$/i);
    expect(css.length, 'hay al menos una hoja').toBeGreaterThan(0);
    expect(identity, 'existe el trozo identity').toHaveLength(1);
    expect(fonts, 'existe la fuente woff2').toHaveLength(1);

    const parts: Record<string, number> = {};
    for (const name of [...css, ...identity, ...fonts]) parts[name] = gzipped(readFileSync(join(outDir, name)));
    parts['public/brand/favicon.svg'] = gzipped(readFileSync(join(root, 'public/brand/favicon.svg')));
    const total = Object.values(parts).reduce((sum, bytes) => sum + bytes, 0);

    console.info(`RNF-2 (002): peso de la identidad ${(total / 1024).toFixed(1)} KB de ${LIMIT_BYTES / 1024} KB`, parts);
    expect(total, `la identidad pesa ${(total / 1024).toFixed(1)} KB (límite ${LIMIT_BYTES / 1024} KB)`).toBeLessThan(LIMIT_BYTES);
  }, 180_000);
});
