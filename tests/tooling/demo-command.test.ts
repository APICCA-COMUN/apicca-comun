// RF-1 (022), RNF-1 (022), D-T6 (022): el comando de demostración arranca los emuladores de `demo-apicca` con Functions,
// siembra y abre el sitio; la sal del hash de IP de los emuladores es local, aleatoria y queda fuera de git.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureDemoSecret } from '../../scripts/demo-secret.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const scripts = (path: string) => (JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as { scripts: Record<string, string> }).scripts;

let dir: string | undefined;
afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('npm run demo', () => {
  it('RF-1 (022) · 1.1, 1.2: arranca Auth, Firestore, Storage y Functions con demo-apicca, siembra y después abre el sitio', () => {
    const demo = scripts('package.json')['demo'];
    expect(demo).toBeDefined();
    expect(demo).toContain('--project demo-apicca');
    expect(demo).toContain('--only auth,firestore,storage,functions');
    expect(demo).not.toContain('apicca-com');
    const seed = demo!.indexOf('seed-demo');
    const site = demo!.indexOf('VITE_USE_EMULATORS=true vite');
    expect(seed).toBeGreaterThan(-1);
    expect(site).toBeGreaterThan(seed);
    // La sal y la compilación de functions van antes de los emuladores.
    expect(demo!.indexOf('demo-secret')).toBeLessThan(demo!.indexOf('emulators:exec'));
    expect(demo!.indexOf('functions run build')).toBeLessThan(demo!.indexOf('emulators:exec'));
    expect(scripts('functions/package.json')['seed-demo']).toContain('lib-scripts/functions/scripts/seed-demo.js');
  });

  it('RF-4 (022) · 4.3: la siembra y el sitio van unidos con `&&`, así que si la siembra falla el sitio no se sirve', () => {
    const demo = scripts('package.json')['demo']!;
    const quoted = /--ui "([^"]*)"/.exec(demo)?.[1];
    expect(quoted).toBeDefined();
    // Entre la siembra y `vite` solo puede haber `&&`: ni `;`, ni `||`, ni `&` solo.
    expect(quoted).toMatch(/seed-demo && VITE_USE_EMULATORS=true vite$/);
    expect(quoted).not.toMatch(/[;|]/);
    expect(quoted!.replace(/&&/g, '')).not.toContain('&');
  });

  it('RNF-1 (022): la sal de los emuladores se crea si falta, es aleatoria y local, y no se pisa', () => {
    dir = mkdtempSync(join(tmpdir(), 'apicca-demo-'));
    const file = join(dir, '.secret.local');
    expect(ensureDemoSecret(file)).toBe(true);
    const first = readFileSync(file, 'utf8');
    expect(first).toMatch(/^IP_HASH_SALT=solo-local-[0-9a-f]{32}\n$/);
    expect(ensureDemoSecret(file)).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(first);
    const other = join(dir, 'otra.local');
    ensureDemoSecret(other);
    expect(readFileSync(other, 'utf8')).not.toBe(first);
    writeFileSync(file, 'IP_HASH_SALT=propia\n');
    expect(ensureDemoSecret(file)).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe('IP_HASH_SALT=propia\n');
  });

  it('RNF-1 (022): git ignora la sal local', () => {
    const ignored = readFileSync(resolve(ROOT, '.gitignore'), 'utf8').split('\n');
    expect(ignored).toContain('.secret.local');
  });
});
