// RF-6 (016), D-T13 (016): encabezados de seguridad del hosting. La CSP admite el script en línea del tema solo por su hash.
// RF-5 (017), D-T5 (017): el HTML de las rutas se revalida siempre; los recursos con hash se guardan un año.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const config = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
const entries = config.hosting.headers as Array<{ source?: string; regex?: string; headers: Array<{ key: string; value: string }> }>;
const all = entries.find((entry) => entry.source === '**')?.headers ?? [];
const header = (key: string): string | undefined => all.find((h) => h.key === key)?.value;
const csp = header('Content-Security-Policy') ?? '';
const directive = (name: string): string[] =>
  csp
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name)
    ?.slice(1) ?? [];

/** Hash de cada `<script>` en línea (sin `src`) de un HTML, en el formato de la CSP. */
function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, body]) => `'sha256-${createHash('sha256').update(body ?? '').digest('base64')}'`,
  );
}

const htmlFiles = ['index.html', 'dist/index.html'].map((file) => resolve(root, file)).filter((file) => existsSync(file));

describe('hosting-headers · Firebase Hosting', () => {
  it('RF-6 (016) · 6.1: cada respuesta lleva una CSP con frame-ancestors none y sin unsafe-inline para scripts', () => {
    expect(csp).not.toBe('');
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('script-src')).not.toContain("'unsafe-eval'");
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('default-src')).toEqual(["'self'"]);
  });

  it('RF-6 (016) · 6.1: la CSP admite por su hash cada script en línea de index.html (y del build, si existe)', () => {
    const hashes = htmlFiles.flatMap((file) => inlineScriptHashes(readFileSync(file, 'utf8')));
    expect(hashes.length).toBeGreaterThan(0);
    for (const hash of hashes) expect(directive('script-src')).toContain(hash);
  });

  it('RF-6 (016) · 6.1: la CSP deja pasar los servicios de Firebase y las teselas del mapa', () => {
    expect(directive('connect-src')).toEqual(
      expect.arrayContaining([
        'https://firestore.googleapis.com',
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        'https://firebasestorage.googleapis.com',
        'https://us-central1-apicca-com.cloudfunctions.net',
      ]),
    );
    expect(directive('img-src')).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org']));
  });

  it('RF-6 (016) · 6.2: cada respuesta lleva X-Content-Type-Options: nosniff', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
  });

  it('RF-6 (016) · 6.3: cada respuesta lleva Referrer-Policy: strict-origin-when-cross-origin', () => {
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  // Firebase compara los encabezados con la ruta pedida, no con el archivo servido: `/foro` recibe index.html por la
  // reescritura, pero no la regla de `/index.html`. Las rutas del sitio no llevan punto; los archivos, sí.
  const cacheOf = (path: string): string[] =>
    entries
      .filter((entry) => (entry.regex !== undefined ? new RegExp(entry.regex).test(path) : entry.source === path || (entry.source?.endsWith('/**') === true && path.startsWith(entry.source.slice(0, -2)))))
      .flatMap((entry) => entry.headers.filter((h) => h.key === 'Cache-Control').map((h) => h.value));

  it('RF-5 (017): el HTML de toda ruta del sitio lleva Cache-Control: no-cache', () => {
    for (const path of ['/', '/foro', '/foro/abc123', '/documentacion/01-que-es', '/mi-tablero', '/index.html', '/ruta-que-no-existe']) {
      expect(cacheOf(path), path).toEqual(['no-cache']);
    }
  });

  it('RF-5 (017): /assets/** conserva immutable y no recibe no-cache', () => {
    expect(cacheOf('/assets/index-C65DHrFX.js')).toEqual(['public, max-age=31536000, immutable']);
    expect(cacheOf('/brand/manglerojo.svg')).toEqual(['public, max-age=86400']);
  });
});
