// RNF-4 (003), D-T24 (003), D-T16 (003), D-T9 (009): la documentación, la constitución y el foro no viajan en el trozo de entrada.
// Se compila el sitio en una carpeta temporal y se busca un texto distintivo de cada una: el trozo de
// entrada no lo tiene y algún otro trozo sí. Los textos se toman de los archivos reales, no se fijan aquí,
// para que la prueba siga valiendo cuando la persona reescriba los artículos (D-26 (003)).
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../..');

/** El tramo ASCII más largo de una línea: evita depender de cómo el build escapa las tildes. */
function asciiRun(line: string): string {
  const runs = line.match(/[A-Za-z0-9 ,.:;()-]+/g) ?? [];
  return runs.reduce((a, b) => (b.trim().length > a.trim().length ? b : a), '').trim();
}

/** Texto distintivo de la página de la constitución (el archivo `docs/constitution.md` ya no viaja en el sitio, RF-15 (003) · 15.2). */
function constitutionMarker(): string {
  return asciiRun('Las propuestas de cambio llegan con la apertura de la constitución.');
}

/** Texto distintivo de la página de un hilo del foro (D-T9 (009)). */
function forumMarker(): string {
  return asciiRun('Puede que se haya archivado o que el enlace no sea correcto.');
}

/** Texto distintivo del cuerpo del primer artículo de la documentación (sin su título). */
function documentationMarker(): string {
  const index = JSON.parse(readFileSync(join(root, 'docs/documentacion/indice.json'), 'utf8')) as {
    secciones: { articulos: { archivo: string }[] }[];
  };
  const file = index.secciones[0]!.articulos[0]!.archivo;
  const body = readFileSync(join(root, 'docs/documentacion', file), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'));
  return body.map(asciiRun).reduce((a, b) => (b.length > a.length ? b : a), '');
}

const outDir = mkdtempSync(join(tmpdir(), 'apicca-lazy-'));
const chunks = new Map<string, string>();
let entry = '';

beforeAll(async () => {
  const savedEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await build({ root, mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  } finally {
    process.env.NODE_ENV = savedEnv;
  }
  const html = readFileSync(join(outDir, 'index.html'), 'utf8');
  entry = /<script type="module"[^>]*src="\/assets\/([^"]+\.js)"/.exec(html)![1]!;
  for (const name of readdirSync(join(outDir, 'assets')).filter((n) => n.endsWith('.js'))) {
    chunks.set(name, readFileSync(join(outDir, 'assets', name), 'utf8'));
  }
}, 120_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('carga diferida de documentación, constitución y foro', () => {
  it.each([
    ['la constitución', constitutionMarker],
    ['la documentación', documentationMarker],
    ['el foro', forumMarker],
  ])('RNF-4 (003): el trozo de entrada no contiene %s y otro trozo sí', (_name, marker) => {
    const text = marker();
    expect(text.length).toBeGreaterThan(15);
    expect(chunks.get(entry)).toBeDefined();
    expect(chunks.get(entry)!.includes(text)).toBe(false);
    const holders = [...chunks].filter(([name, code]) => name !== entry && code.includes(text));
    expect(holders.length).toBeGreaterThan(0);
  });
});
