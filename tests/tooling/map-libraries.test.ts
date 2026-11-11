// RNF-2 (021), RNF-3 (021), D-5 (021), D-T19 (021): el mapa no trae bibliotecas de mapas ni de retículas. `h3-js` solo se
// importa en `functions/`, y el sitio no la declara; Leaflet solo se importa en `src/map/PointPickerMap.tsx`, el mapa del
// selector de ubicación (D-9 (021)), que a su vez solo se carga a pedido desde `LocationPicker`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const SKIP = new Set(['node_modules', 'dist', 'lib', '.git', '__screenshots__']);

/** Los archivos de código de una carpeta, con su ruta relativa a la raíz del repositorio. */
function codeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) found.push(...codeFiles(path));
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) found.push(path);
  }
  return found;
}

/** Los archivos que importan `module`, estática o dinámicamente. */
function importers(dirs: readonly string[], module: RegExp): string[] {
  return dirs
    .flatMap(codeFiles)
    .filter((file) => module.test(readFileSync(join(root, file), 'utf8')))
    .map((file) => relative(root, join(root, file)))
    .sort();
}

const imports = (name: string) => new RegExp(String.raw`(?:from\s+|import\s*\(\s*)['"]${name}(?:/[^'"]*)?['"]`);

const SITE = ['src', 'shared', 'tests'];

describe('bibliotecas del mapa', () => {
  it('RNF-3 (021), D-5 (021): h3-js solo se importa en functions/ y el sitio no la declara', () => {
    expect(importers(SITE, imports('h3-js'))).toEqual([]);
    const site = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
    expect(Object.keys({ ...site['dependencies'], ...site['devDependencies'] })).not.toContain('h3-js');
    const functions = JSON.parse(readFileSync(join(root, 'functions/package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(functions.dependencies['h3-js']).toBe('4.5.0');
    expect(importers(['functions/src'], imports('h3-js')).filter((file) => !file.endsWith('.test.ts'))).toEqual(['functions/src/zone.ts']);
  });

  it('RNF-2 (021), D-T18 (021): Leaflet solo se importa en el selector de punto, y el selector solo se carga a pedido', () => {
    const leaflet = importers(['src', 'shared'], imports('leaflet')).filter((file) => !/\.test\.tsx?$/.test(file));
    expect(leaflet).toEqual(['src/map/PointPickerMap.tsx']);
    const picker = importers(['src', 'shared'], /PointPickerMap/).filter((file) => !/\.test\.tsx?$/.test(file) && file !== 'src/map/PointPickerMap.tsx');
    expect(picker).toEqual(['src/components/LocationPicker.tsx']);
    const source = readFileSync(join(root, 'src/components/LocationPicker.tsx'), 'utf8');
    expect(source).toMatch(/lazy\(\(\) => import\('\.\.\/map\/PointPickerMap'\)\)/);
    expect(source).not.toMatch(/^import [^;]*PointPickerMap/m);
  });

  it('RNF-2 (021), D-T17 (021): el mapa propio no importa bibliotecas: solo React, el dominio y componentes del sitio', () => {
    const source = readFileSync(join(root, 'src/map/GameMap.tsx'), 'utf8');
    const modules = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]!);
    expect(modules.filter((module) => !module.startsWith('.'))).toEqual(['react']);
  });
});
