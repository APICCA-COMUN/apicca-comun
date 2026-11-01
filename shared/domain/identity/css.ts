// Derivados de los tokens para la hoja y para `index.html` (RNF-4 (002), RNF-6 (002), D-T2 (002),
// D-T8 (002)). `scripts/gen-tokens.mjs` los escribe; una prueba de `tests/tooling/` los compara.
import { MAP_TINT, TOKEN_NAMES, TOKENS, TYPE_SCALE, type ThemeName } from './tokens';

const HEADER =
  '/* Generado por `npm run gen-tokens` desde shared/domain/identity/tokens.ts. No editar a mano. */';

const declarations = (theme: ThemeName, indent: string): string =>
  [
    `color-scheme: ${theme};`,
    ...TOKEN_NAMES.map((name) => `--${name}: ${TOKENS[theme][name]};`),
    `--map-tint: ${MAP_TINT[theme]};`,
  ]
    .map((line) => `${indent}${line}`)
    .join('\n');

/** Escala de texto (RF-1 (008) · 1.2): se declara una vez en `:root`, igual en los dos temas. */
const typeScale = (): string =>
  Object.entries(TYPE_SCALE)
    .flatMap(([name, { size, line, weight }]) => [
      `  --type-${name}-size: ${size};`,
      `  --type-${name}-line: ${line};`,
      `  --type-${name}-weight: ${weight};`,
    ])
    .join('\n');

/**
 * Variables CSS de los dos temas. Sin atributo manda `prefers-color-scheme`; con `data-theme`
 * manda la elección (D-22 (002)). El claro es el valor por defecto.
 */
export function tokensToCss(): string {
  return `${HEADER}
:root {
${typeScale()}
}

:root,
:root[data-theme='light'] {
${declarations('light', '  ')}
}

:root[data-theme='dark'] {
${declarations('dark', '  ')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${declarations('dark', '    ')}
  }
}

@media (forced-colors: active) {
  :root {
    --map-tint: none;
  }
}
`;
}

// Bloques de `index.html` que escribe `gen-tokens` entre marcas.
export const CRITICAL_MARKERS = ['/* gen-tokens:critical:start */', '/* gen-tokens:critical:end */'] as const;
export const THEME_COLOR_MARKERS = ['/* gen-tokens:theme-color:start */', '/* gen-tokens:theme-color:end */'] as const;

const critical = (theme: ThemeName): string =>
  `color-scheme: ${theme}; background: ${TOKENS[theme].background}; color: ${TOKENS[theme].text};`;

/** Tokens críticos del primer pintado, antes de que llegue la hoja (RNF-6 (002), RF-3 (002) · 3.5). */
export function criticalCss(): string {
  return [
    `:root { ${critical('light')} }`,
    `:root[data-theme='dark'] { ${critical('dark')} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ${critical('dark')} } }`,
  ].join('\n');
}

/** La constante que el guion de arranque usa para `theme-color` (RF-11 (002) · 11.3, D-T7 (002)). */
export function themeColorsScript(): string {
  const colors = { light: TOKENS.light.background, dark: TOKENS.dark.background };
  return `var THEME_COLORS = ${JSON.stringify(colors)};`;
}

/** Cambia lo que hay entre dos marcas por `content`, en su propia línea. */
export function replaceBetween(text: string, [start, end]: readonly [string, string], content: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Faltan las marcas ${start} … ${end}.`);
  const lineStart = text.lastIndexOf('\n', to) + 1;
  const indent = text.slice(lineStart, to);
  return `${text.slice(0, from + start.length)}\n${content}\n${indent}${text.slice(to)}`;
}
