// `test:browser` comprueba Chromium antes de compilar (plan 002 §9.4): sin él, un mensaje
// en español que dice cómo instalarlo, en lugar del error de Playwright.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '..', '..', 'scripts', 'check-chromium.mjs');

function run(env: NodeJS.ProcessEnv): { code: number; output: string } {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

describe('comprobación de Chromium', () => {
  it('RNF-5 (002): sin Chromium falla con el mensaje en español que indica cómo instalarlo', () => {
    const empty = mkdtempSync(join(tmpdir(), 'sin-chromium-'));
    try {
      const { code, output } = run({ PLAYWRIGHT_BROWSERS_PATH: empty });
      expect(code).toBe(1);
      expect(output).toContain('npx playwright install chromium');
      expect(output).toContain('Falta Chromium');
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('RNF-5 (002): con Chromium instalado pasa en silencio', () => {
    expect(run({}).code).toBe(0);
  });
});
