// RF-6 (013), RF-7 (013), RF-8 (013), RNF-1 (013), RNF-2 (013) · D-T13 (013): los documentos de operación,
// la CI y la lista de dependencias se vigilan como texto, sin red ni nube.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string): string => {
  const full = resolve(root, path);
  expect(existsSync(full), `falta ${path}`).toBe(true);
  return readFileSync(full, 'utf8');
};
const headings = (markdown: string): string[] =>
  markdown.split('\n').filter((line) => line.startsWith('## ')).map((line) => line.slice(3).trim());

// Los documentos de operación son internos y no viajan en el repo público: en la CI no existen (RF-8 (013) v0.5).
const internalDocs = ['docs/operacion.md', 'docs/despliegues.md'].every((path) => existsSync(resolve(root, path)));

describe.skipIf(!internalDocs)('operación · documentos', () => {
  it('RF-7 (013) · 7.1: docs/operacion.md tiene las seis secciones del runbook', () => {
    expect(headings(read('docs/operacion.md'))).toEqual(
      expect.arrayContaining([
        'Desplegar por partes',
        'Revertir el hosting',
        'Restaurar un respaldo',
        'Rotar `OPENROUTER_API_KEY`',
        'Rotar `IP_HASH_SALT`',
        'Plantilla del correo',
      ]),
    );
  });

  it('RF-7 (013) · 7.2: todo `firebase deploy` del runbook lleva `--only` y `--project apicca-com`', () => {
    const deploys = read('docs/operacion.md').split('\n').filter((line) => line.includes('firebase deploy'));
    expect(deploys.length).toBeGreaterThan(0);
    for (const line of deploys) {
      expect(line).toContain('--only');
      expect(line).toContain('--project apicca-com');
    }
  });

  it('RF-6 (013) · 6.1: docs/despliegues.md tiene la tabla de fecha, commit, partes y specs con al menos una entrada', () => {
    const lines = read('docs/despliegues.md').split('\n');
    const header = lines.findIndex((line) => /^\| Fecha \| Commit \| Partes \| Specs \|/.test(line));
    expect(header).toBeGreaterThanOrEqual(0);
    const rows = lines.slice(header + 2).filter((line) => line.startsWith('|'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toMatch(/^\| \d{4}-\d{2}-\d{2} \| `[0-9a-f]{7}` \| /);
  });

  it('RF-6 (013) · 6.2: las partes registradas son objetivos válidos de `--only`', () => {
    const valid = new Set(['hosting:apicca', 'functions', 'firestore:rules', 'firestore:indexes', 'storage']);
    const rows = read('docs/despliegues.md').split('\n').filter((line) => /^\| \d{4}-/.test(line));
    for (const row of rows) {
      const parts = (row.split('|')[3] ?? '').match(/`([^`]+)`/g) ?? [];
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) expect(valid, `${part} en «${row}»`).toContain(part.replaceAll('`', '').replace(/^functions:.*/, 'functions'));
    }
  });
});

describe('operación · CI', () => {
  it('RF-8 (013) · 8.1: el workflow corre en cada push con check y npm test', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/^on:\s*\n\s+push:/m);
    const steps = ['npm ci', 'npm --prefix functions ci', 'npm run check', 'npm test'];
    const positions = steps.map((step) => ci.indexOf(`run: ${step}`));
    for (const [i, position] of positions.entries()) expect(position, steps[i]).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('RF-8 (013) · 8.2: la CI usa Node 24, como las functions (RF-5 (014))', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(/node-version:\s*'?24'?/);
  });

  it('RNF-1 (013): la CI no usa secretos ni el proyecto de producción', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).not.toContain('secrets.');
    expect(ci).not.toContain('apicca-com');
  });

  it('RF-9 (016) · 9.3: la CI declara permisos de solo lectura', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
  });
});

describe('operación · dependencias', () => {
  const names = (path: string, key: 'dependencies' | 'devDependencies'): string[] =>
    Object.keys((JSON.parse(read(path)) as Record<string, Record<string, string>>)[key] ?? {}).sort();

  it('RNF-2 (013): las functions conservan sus tres dependencias', () => {
    expect(names('functions/package.json', 'dependencies')).toEqual(['firebase-admin', 'firebase-functions', 'sharp']);
  });

  it('RNF-2 (013): el sitio no suma dependencias de ejecución', () => {
    expect(names('package.json', 'dependencies')).toEqual(['firebase', 'leaflet', 'react', 'react-dom']);
  });
});
