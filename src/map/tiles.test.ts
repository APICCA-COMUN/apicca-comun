import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OSM_TILE_URL, TILE_ATTRIBUTION, TILE_URL, tileUrl } from './tiles';

/** Archivos fuente de `src/` que no son pruebas. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('proveedor de teselas', () => {
  it('RF-21 (001): la atribución del proveedor es una constante con su nombre y su enlace', () => {
    expect(TILE_ATTRIBUTION).toContain('OpenStreetMap');
    expect(TILE_ATTRIBUTION).toContain('https://www.openstreetmap.org/copyright');
  });

  it('RF-21 (001): la URL de teselas es ráster con {z}/{x}/{y} y https', () => {
    expect(TILE_URL).toMatch(/^https:\/\/.*\{z\}.*\{x\}.*\{y\}/);
  });

  it('RF-21 (001): la URL del proveedor aparece en un solo lugar del código (D-T11 (001))', () => {
    const root = join(process.cwd(), 'src');
    const hits = sourceFiles(root)
      .filter((file) => /tile\.openstreetmap\.org|openstreetmap\.org\/copyright/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file));
    expect(hits).toEqual(['map/tiles.ts']);
  });

  it('D-T13 (002): sin VITE_TILE_URL la URL de teselas es la de OpenStreetMap', () => {
    expect(tileUrl({})).toBe(OSM_TILE_URL);
    expect(tileUrl({ VITE_TILE_URL: '' })).toBe(OSM_TILE_URL);
    expect(OSM_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('D-T13 (002): con VITE_TILE_URL la URL de teselas es la de la variable', () => {
    expect(tileUrl({ VITE_TILE_URL: '/test-tiles/tile.png' })).toBe('/test-tiles/tile.png');
  });

  it('D-T13 (002): fuera del proyecto browser la variable no existe y TILE_URL es la de OpenStreetMap', () => {
    expect(TILE_URL).toBe(OSM_TILE_URL);
  });
});
