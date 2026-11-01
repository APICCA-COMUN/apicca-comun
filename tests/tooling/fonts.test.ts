// RF-5 (002) · 5.1, 5.3: Nunito servida desde el propio sitio, con su licencia y un respaldo
// medido para que el cambio de fuente no desplace el texto (D-20 (002), D-T11 (002)).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const FONT = 'src/assets/fonts/nunito-latin-var.woff2';

/** Las reglas `@font-face` de una hoja, por familia. */
function faces(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = /font-family:\s*['"]([^'"]+)['"]/.exec(body!)?.[1];
    if (family !== undefined) found.set(family, body!);
  }
  return found;
}

describe('fuente', () => {
  it('RF-5 (002) · 5.1: el woff2 de Nunito y su OFL.txt están en src/assets/fonts', () => {
    const font = readFileSync(resolve(root, FONT));
    expect(font.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(readFileSync(resolve(root, 'src/assets/fonts/OFL.txt'), 'utf8')).toMatch(/SIL Open Font License, Version 1\.1/);
  });

  it('RF-5 (002) · 5.3: fonts.css declara Nunito con swap y el respaldo medido sobre Arial', () => {
    const css = readFileSync(resolve(root, 'src/styles/fonts.css'), 'utf8');
    const declared = faces(css);
    const nunito = declared.get('Nunito');
    expect(nunito).toMatch(/font-display:\s*swap/);
    expect(nunito).toMatch(/url\(['"]?\.\.\/assets\/fonts\/nunito-latin-var\.woff2['"]?\)\s*format\(['"]woff2['"]\)/);
    expect(nunito).toMatch(/font-weight:\s*200 1000/);
    const fallback = declared.get('Nunito Fallback');
    expect(fallback).toMatch(/src:\s*local\(['"]?Arial['"]?\)/);
    expect(fallback).toMatch(/size-adjust:\s*\d+(\.\d+)?%/);
    expect(fallback).toMatch(/ascent-override:\s*\d+(\.\d+)?%/);
  });

  it('RF-5 (002) · 5.3: el respaldo, ya escalado por size-adjust, toma el ascendente y el descendente de Nunito', () => {
    // `hhea` del woff2: ascendente 1011 y descendente 353 sobre 1000. Los `*-override` se escalan con
    // `size-adjust`, así que el valor efectivo es override × size-adjust.
    const fallback = faces(readFileSync(resolve(root, 'src/styles/fonts.css'), 'utf8')).get('Nunito Fallback')!;
    const percent = (name: string) => parseFloat(new RegExp(`${name}:\\s*([\\d.]+)%`).exec(fallback)![1]!) / 100;
    const size = percent('size-adjust');
    expect(percent('ascent-override') * size * 1000).toBeCloseTo(1011, 0);
    expect(percent('descent-override') * size * 1000).toBeCloseTo(353, 0);
  });

  it('RF-5 (002) · 5.3: index.html precarga el woff2 de Nunito', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const preload = /<link\s+rel="preload"[^>]*>/.exec(head)?.[0] ?? '';
    expect(preload).toContain(`href="/${FONT}"`);
    expect(preload).toContain('as="font"');
    expect(preload).toContain('type="font/woff2"');
    // Sin `crossorigin`, la precarga de una fuente se descarta y se pide dos veces.
    expect(preload).toContain('crossorigin');
  });

  it('RF-3 (002) · 3.1: main.tsx importa tokens, fuentes y base, en ese orden', () => {
    const main = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');
    const order = ['./styles/tokens.css', './styles/fonts.css', './styles/base.css'].map((sheet) =>
      main.indexOf(`import '${sheet}';`),
    );
    for (const at of order) expect(at).toBeGreaterThanOrEqual(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
