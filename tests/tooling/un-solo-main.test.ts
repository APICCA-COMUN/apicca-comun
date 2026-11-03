// RF-3 (020) · 3.1, D-T4 (020): el único `main` del sitio lo pinta `src/App.tsx`. Ninguna página ni componente
// escribe otro, así que la regla cubre también las páginas futuras. Los comentarios se quitan antes de buscar,
// porque algunas cabeceras nombran `<main>` en el texto.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../../src');

/** Los `.tsx` de `src/` que no son pruebas. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

/** El código sin comentarios de bloque ni de línea (los `//` dentro de un texto con `://` se conservan). */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('un solo main', () => {
  it('RF-3 (020) · 3.1: fuera de App.tsx, ningún .tsx de src/ escribe <main', () => {
    const files = sources(SRC);
    expect(files.length).toBeGreaterThan(0);
    const app = resolve(SRC, 'App.tsx');
    expect(withoutComments(readFileSync(app, 'utf8')).match(/<main\b/g)).toHaveLength(1);
    const offenders = files.filter((file) => file !== app && /<main\b/.test(withoutComments(readFileSync(file, 'utf8'))));
    expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
  });
});
