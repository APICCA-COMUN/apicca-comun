// D-T13 (002): la tesela local de las pruebas de navegador solo la publica el build `--mode browser`
// (`dist-browser/`); un build normal no contiene `/test-tiles/`, así que no puede desplegarse por error.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../..');
const outs: string[] = [];

/** Compila el sitio en una carpeta temporal con el modo y las variables dadas. */
async function buildTo(mode: string, env: Record<string, string>): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), `apicca-${mode}-`));
  outs.push(outDir);
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    await build({ root, mode, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  } finally {
    process.env = saved;
  }
  return outDir;
}

/** Todos los archivos de una carpeta, con su ruta relativa. */
const files = (dir: string): string[] => (readdirSync(dir, { recursive: true }) as string[]).map((name) => name.split('\\').join('/'));

afterAll(() => {
  for (const dir of outs) rmSync(dir, { recursive: true, force: true });
});

describe('tesela local de pruebas', () => {
  it('D-T13 (002): un build normal no publica test-tiles ni nombra /test-tiles/', async () => {
    const out = await buildTo('production', {});
    const all = files(out);
    expect(all.filter((name) => name.includes('test-tiles'))).toEqual([]);
    const texts = all.filter((name) => /\.(html|js|css|json)$/.test(name));
    expect(texts.filter((name) => readFileSync(join(out, name), 'utf8').includes('/test-tiles/'))).toEqual([]);
  }, 120_000);

  it('D-T13 (002): el build de pruebas publica la tesela en /test-tiles/tile.png y la usa', async () => {
    const out = await buildTo('browser', { VITE_USE_EMULATORS: 'true', VITE_TILE_URL: '/test-tiles/tile.png' });
    expect(existsSync(join(out, 'test-tiles', 'tile.png'))).toBe(true);
    const scripts = files(out).filter((name) => name.endsWith('.js'));
    expect(scripts.some((name) => readFileSync(join(out, name), 'utf8').includes('/test-tiles/tile.png'))).toBe(true);
  }, 120_000);
});
