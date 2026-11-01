// Genera `src/styles/tokens.css` y los bloques de `index.html` desde `shared/domain/identity/`
// (T-2.2, T-2.3, RNF-4 (002), D-T2 (002)). Carga el TypeScript con Vite, que ya es dependencia.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const server = await createServer({ root, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { tokensToCss, criticalCss, themeColorsScript, replaceBetween, CRITICAL_MARKERS, THEME_COLOR_MARKERS } =
    await server.ssrLoadModule('/shared/domain/identity/css.ts');

  const cssPath = resolve(root, 'src/styles/tokens.css');
  mkdirSync(dirname(cssPath), { recursive: true });
  writeFileSync(cssPath, tokensToCss());

  // Cada bloque toma la sangría de su marca final.
  const htmlPath = resolve(root, 'index.html');
  const indent = (text, marker) => text.slice(text.lastIndexOf('\n', text.indexOf(marker)) + 1, text.indexOf(marker));
  const indented = (text, markers, content) =>
    content
      .split('\n')
      .map((line) => `${indent(text, markers[1])}${line}`)
      .join('\n');
  let html = readFileSync(htmlPath, 'utf8');
  html = replaceBetween(html, CRITICAL_MARKERS, indented(html, CRITICAL_MARKERS, criticalCss()));
  html = replaceBetween(html, THEME_COLOR_MARKERS, indented(html, THEME_COLOR_MARKERS, themeColorsScript()));
  writeFileSync(htmlPath, html);
  console.log('gen-tokens: escritos src/styles/tokens.css y los bloques de index.html.');
} finally {
  await server.close();
}
