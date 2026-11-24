import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Compila de verdad y mira lo que el navegador descargaría al abrir la primera pantalla.
let outDir = '';
let html = '';
let initial: { path: string; text: string }[] = [];

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'apicca-build-'));
  const result = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`vite build falló:\n${result.stdout}\n${result.stderr}`);
  html = readFileSync(join(outDir, 'index.html'), 'utf8');
  // Todo lo que el HTML pide al abrir: script de entrada, precargas y hojas de estilo.
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1] ?? '');
  initial = refs.map((ref) => ({ path: ref, text: readFileSync(join(outDir, ref), 'utf8') }));
}, 180_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('trozo de entrada', () => {
  it('RNF-8 (001): el build produce un trozo de entrada referenciado por el HTML', () => {
    expect(existsSync(join(outDir, 'index.html'))).toBe(true);
    expect(initial.some((file) => file.path.endsWith('.js'))).toBe(true);
  });

  it('RNF-8 (001): ningún archivo de la carga inicial contiene Leaflet (se descarga aparte, D-T11 (001))', () => {
    const withLeaflet = initial.filter((file) => /leaflet-(pane|container|marker-icon)/.test(file.text));
    expect(withLeaflet.map((file) => file.path)).toEqual([]);
  });

  // El teselado del mapa (`h3-js`, unos 540 KB) y el mapa mismo viajan en trozos aparte: Play los pide con `import()`.
  it('RNF-8 (001), D-T17 (021): ningún archivo de la carga inicial contiene h3-js ni el dibujo del mapa; algún otro trozo sí', () => {
    const H3 = 'Pentagon distortion was encountered'; // mensaje de error de la biblioteca: sobrevive a la minificación
    expect(initial.filter((file) => file.text.includes(H3)).map((file) => file.path)).toEqual([]);
    expect(initial.filter((file) => file.text.includes('game-map__tessellation')).map((file) => file.path)).toEqual([]);
    const assets = readdirSync(join(outDir, 'assets')).filter((name) => name.endsWith('.js'));
    const holders = assets.filter((name) => readFileSync(join(outDir, 'assets', name), 'utf8').includes(H3));
    expect(holders.length, 'h3-js viaja en algún trozo aparte').toBeGreaterThan(0);
    const entry = initial.map((file) => file.path.replace('/assets/', ''));
    expect(holders.filter((name) => entry.includes(name))).toEqual([]);
  });
});
