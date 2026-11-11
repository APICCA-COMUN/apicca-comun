// RF-3 (016), D-T6 (016): topes de instancias de las callables, leídos de su declaración.
// RF-27 (021) · 27.2, 27.3, RNF-8 (021), D-T6 (021): no queda callable de imágenes, ni llave, ni biblioteca, ni
// código que llame a un servicio de generación.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as functions from './index';

type Endpoint = { maxInstances?: number; concurrency?: number; cpu?: number | string; secretEnvironmentVariables?: { key: string }[] };
const endpointOf = (fn: unknown): Endpoint | undefined => (fn as { __endpoint?: Endpoint } | null)?.__endpoint;

// Vitest corre desde la raíz del repositorio (como `journey.emu.test.ts`, que lee de ahí las reglas).
const FUNCTIONS_DIR = resolve(process.cwd(), 'functions');

/** Fuentes de producción de `functions/src` y sus scripts: ni pruebas ni utillaje de pruebas. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'testing' ? [] : sources(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe('functions/index · topes', () => {
  it('RF-3 (016) · 3.1: api tiene un máximo de 10 instancias', () => {
    expect(endpointOf(functions.api)?.maxInstances).toBe(10);
  });
});

describe('functions/index · retiro de la imagen', () => {
  it('RF-27 (021) · 27.2: ya no existe la callable media', () => {
    expect(Object.keys(functions)).not.toContain('media');
    expect(Object.keys(functions).sort()).toEqual(['REGION', 'amendmentCloser', 'api', 'firestoreBackup', 'storageSweep']);
  });

  it('RF-27 (021) · 27.3, RNF-8 (021): ninguna función pide la llave de un servicio de generación', () => {
    const secrets = Object.values(functions).flatMap((fn) => endpointOf(fn)?.secretEnvironmentVariables?.map((s) => s.key) ?? []);
    expect(secrets).not.toContain('OPENROUTER_API_KEY');
    expect([...new Set(secrets)]).toEqual(['IP_HASH_SALT']);
  });

  it('RF-27 (021) · 27.3, RNF-8 (021): ninguna fuente del servidor nombra un servicio de generación ni la biblioteca de imágenes', () => {
    const named = [...sources(join(FUNCTIONS_DIR, 'src')), ...sources(join(FUNCTIONS_DIR, 'scripts'))].filter((path) =>
      /openrouter|imageModel|from 'sharp'/i.test(readFileSync(path, 'utf8')),
    );
    expect(named.map((path) => path.slice(FUNCTIONS_DIR.length + 1))).toEqual([]);
  });

  it('RF-27 (021) · 27.3, RNF-3 (021): las functions ya no dependen de la biblioteca de imágenes; la única nueva es h3-js', () => {
    const manifest = JSON.parse(readFileSync(join(FUNCTIONS_DIR, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies).sort()).toEqual(['firebase-admin', 'firebase-functions', 'h3-js']);
    expect(Object.keys(manifest.scripts).filter((name) => /openrouter/i.test(name))).toEqual([]);
  });
});
