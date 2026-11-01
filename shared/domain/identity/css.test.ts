// RNF-4 (002): la hoja de tokens sale de `TOKENS` y `MAP_TINT` (D-T2 (002), D-T8 (002)).
import { describe, expect, it } from 'vitest';
import { criticalCss, replaceBetween, THEME_COLOR_MARKERS, themeColorsScript, tokensToCss } from './css';
import { MAP_TINT, TOKEN_NAMES, TOKENS, TYPE_SCALE, type ThemeName } from './tokens';

/** El cuerpo de la primera regla cuyo selector coincide exactamente. */
const block = (css: string, selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

const count = (text: string, needle: string) => text.split(needle).length - 1;

const SELECTORS: Record<string, ThemeName> = {
  ":root,\n:root[data-theme='light']": 'light',
  ":root[data-theme='dark']": 'dark',
  "  :root:not([data-theme])": 'dark',
};

describe('tokensToCss', () => {
  const css = tokensToCss();

  it('RNF-4 (002): cada token y --map-tint aparecen una vez por bloque de tema, con su valor', () => {
    for (const [selector, theme] of Object.entries(SELECTORS)) {
      const body = block(css, selector);
      for (const name of TOKEN_NAMES) {
        expect(count(body, `--${name}:`), `${selector} ${name}`).toBe(1);
        expect(body).toContain(`--${name}: ${TOKENS[theme][name]};`);
      }
      expect(count(body, '--map-tint:')).toBe(1);
      expect(body).toContain(`--map-tint: ${MAP_TINT[theme]};`);
      expect(body).toContain(`color-scheme: ${theme};`);
    }
  });

  it('RNF-4 (002): hay bloque para los dos esquemas: el claro por defecto y el oscuro sin atributo', () => {
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\n {2}:root:not\(\[data-theme\]\) \{/);
    expect(css.indexOf(":root,\n:root[data-theme='light'] {")).toBeGreaterThanOrEqual(0);
  });

  it('RNF-4 (002): con colores forzados no hay tintado del mapa', () => {
    expect(css).toMatch(/@media \(forced-colors: active\) \{\n {2}:root \{\n {4}--map-tint: none;/);
  });

  it('RF-1 (008) · 1.2: la escala de texto se emite una sola vez, fuera de los temas', () => {
    for (const [name, { size, line, weight }] of Object.entries(TYPE_SCALE)) {
      expect(count(css, `--type-${name}-size: ${size};`), name).toBe(1);
      expect(count(css, `--type-${name}-line: ${line};`), name).toBe(1);
      expect(count(css, `--type-${name}-weight: ${weight};`), name).toBe(1);
    }
  });

  it('RNF-4 (002): avisa que es un archivo generado', () => {
    expect(css.startsWith('/* Generado por `npm run gen-tokens`')).toBe(true);
  });
});

describe('bloques de index.html', () => {
  it('RNF-6 (002): el bloque crítico declara fondo, texto y color-scheme de los dos temas', () => {
    const css = criticalCss();
    for (const [selector, theme] of [
      [":root", 'light'],
      [":root[data-theme='dark']", 'dark'],
      [":root:not([data-theme])", 'dark'],
    ] as const) {
      const body = block(css, selector);
      expect(body).toContain(`color-scheme: ${theme};`);
      expect(body).toContain(`background: ${TOKENS[theme].background};`);
      expect(body).toContain(`color: ${TOKENS[theme].text};`);
    }
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('RF-11 (002) · 11.3: la constante de theme-color lleva el background de cada tema', () => {
    const script = themeColorsScript();
    const match = /^var THEME_COLORS = (\{.*\});$/.exec(script);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1]!)).toEqual({ light: TOKENS.light.background, dark: TOKENS.dark.background });
  });

  it('RNF-4 (002): reemplaza solo lo que hay entre las marcas y falla si faltan', () => {
    const [start, end] = THEME_COLOR_MARKERS;
    const text = `a\n${start}\nviejo\n${end}\nb`;
    expect(replaceBetween(text, THEME_COLOR_MARKERS, 'nuevo')).toBe(`a\n${start}\nnuevo\n${end}\nb`);
    expect(() => replaceBetween('sin marcas', THEME_COLOR_MARKERS, 'x')).toThrow(/marcas/);
  });
});
