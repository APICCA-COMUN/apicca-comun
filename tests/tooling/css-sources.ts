// Lectura de las hojas de `src/` para las pruebas de la escala y de los radios (RF-2 (019) · 2.2, RF-3 (019) · 3.3).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const SRC = resolve(import.meta.dirname, '../../src');

/** Las hojas `.css` de `src/`, salvo `tokens.css`, que se genera desde el contrato. */
export function cssSources(dir: string = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssSources(path);
    return entry.name.endsWith('.css') && entry.name !== 'tokens.css' ? [path] : [];
  });
}

export interface Declaration {
  /** `archivo:línea`, relativo a `src/`. */
  where: string;
  property: string;
  value: string;
}

/** Las declaraciones cuya propiedad cumple `property`, sin comentarios y con su línea. */
export function declarations(property: RegExp): Declaration[] {
  return cssSources().flatMap((file) => {
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
    const found: Declaration[] = [];
    for (const match of code.matchAll(/(^|[;{\s])([a-z-]+)\s*:\s*([^;{}]+);/g)) {
      const [, lead = '', name = '', value = ''] = match;
      if (!property.test(name)) continue;
      const line = code.slice(0, match.index + lead.length).split('\n').length;
      found.push({ where: `${relative(SRC, file)}:${line}`, property: name, value: value.trim() });
    }
    return found;
  });
}
