// RNF-4 (002): los derivados de los tokens están al día con el dominio (D-T2 (002)). Si falla,
// corre `npm run gen-tokens` y revisa el diff.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRITICAL_MARKERS, criticalCss, THEME_COLOR_MARKERS, themeColorsScript, tokensToCss } from '../../shared/domain/identity';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

/** Lo que hay entre dos marcas, sin la sangría de cada línea ni los saltos de los bordes. */
const between = (text: string, [start, end]: readonly [string, string]): string => {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from);
  expect(from, start).toBeGreaterThanOrEqual(0);
  expect(to, end).toBeGreaterThan(from);
  return text
    .slice(from + start.length, to)
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
};

describe('gen-tokens · sincronía', () => {
  it('RNF-4 (002): src/styles/tokens.css es igual a lo que genera el dominio', () => {
    expect(read('src/styles/tokens.css')).toBe(tokensToCss());
  });

  it('RNF-4 (002): el <style> crítico de index.html es el que genera el dominio', () => {
    const html = read('index.html');
    expect(between(html, CRITICAL_MARKERS)).toBe(criticalCss());
    // El bloque vive dentro de un <style> del <head>, antes de cualquier hoja.
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head.lastIndexOf('<style>')).toBeGreaterThanOrEqual(0);
    expect(head.indexOf(CRITICAL_MARKERS[0])).toBeGreaterThan(head.lastIndexOf('<style>'));
  });

  it('RNF-4 (002): la constante de theme-color del guion de arranque es la que genera el dominio', () => {
    expect(between(read('index.html'), THEME_COLOR_MARKERS)).toBe(themeColorsScript());
  });
});
