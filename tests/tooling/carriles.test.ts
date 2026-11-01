// RF-9 (017) · D-2 (017), D-T6 (017): las dos vías de pruebas arrancan igual y las capturas no dependen de la máquina.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const scripts = (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;

describe('carriles de pruebas', () => {
  it('RF-9 (017) · 9.1: test:emu y test:emu:par arrancan los emuladores con el proyecto de prueba demo-apicca', () => {
    for (const name of ['test:emu', 'test:emu:par', 'test:browser', 'test:browser:par']) {
      expect(scripts[name], name).toMatch(/firebase emulators:exec --project demo-apicca\b/);
    }
  });

  it('RF-9 (017) · 9.2: `code` usa una pila monoespaciada explícita, no el genérico que elige el sistema (D-2 (017))', () => {
    const css = readFileSync(resolve(root, 'src/styles/base.css'), 'utf8');
    const rule = /(?:^|\n)code\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/font-family:\s*ui-monospace,\s*SFMono-Regular,\s*Menlo,\s*monospace;/);
  });
});
