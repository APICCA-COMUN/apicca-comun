// RNF-3 (002), D-T6 (002), D-T11 (002): el sitio compilado no pide nada a terceros. Se compila `dist` en una
// carpeta temporal y se revisan el HTML, el CSS y el JS emitidos: toda URL absoluta debe estar en la lista
// permitida. La extracción y la validación son funciones puras, así que se prueban también con casos sintéticos.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../..');

interface Allowed {
  /** Host exacto, o `*.dominio` para el dominio y cualquier subdominio. */
  host: string;
  /** Si está, solo se admiten rutas que empiecen así. */
  path?: string;
  /** Por qué está permitido. */
  why: string;
}

/**
 * Lista permitida. Tres grupos: (a) hosts a los que el sitio sí pide recursos, (b) las APIs de Firebase que ya
 * usa la 001 y (c) cadenas del código de las dependencias que NO generan peticiones (espacios de nombres,
 * documentación en mensajes de error, atribución). Ninguna entrada es un comodín de `googleapis.com` entero:
 * `fonts.googleapis.com`, `fonts.gstatic.com` y similares deben fallar.
 */
export const ALLOWED: Allowed[] = [
  // (a) El propio sitio y el mapa.
  {
    host: '*.apicca.com',
    why: 'dominio propio (og:image absoluta, D-21 (002))',
  },
  {
    host: 'apicca.web.app',
    why: 'sitio de hosting propio (dominio autorizado de Auth)',
  },
  {
    host: '*.firebaseapp.com',
    why: 'authDomain propio de Firebase Auth (apicca-com y el proyecto demo de emuladores)',
  },
  {
    host: '*.tile.openstreetmap.org',
    why: 'teselas del mapa (también `{s}.tile…`); tile.openstreetmap.org entra por el comodín',
  },
  { host: 'tile.openstreetmap.org', why: 'teselas del mapa (D-T13 (002))' },
  // (b) APIs de Firebase, una por una.
  { host: 'firestore.googleapis.com', why: 'Firestore' },
  {
    host: 'identitytoolkit.googleapis.com',
    why: 'Firebase Auth (inicio de sesión)',
  },
  {
    host: 'securetoken.googleapis.com',
    why: 'Firebase Auth (renovar el token)',
  },
  {
    host: 'staging-identitytoolkit.sandbox.googleapis.com',
    why: 'cadena del SDK de Auth para entornos de prueba de Google; no se usa en producción',
  },
  {
    host: 'test-identitytoolkit.sandbox.googleapis.com',
    why: 'cadena del SDK de Auth para entornos de prueba de Google; no se usa en producción',
  },
  {
    host: 'firebasestorage.googleapis.com',
    why: 'Firebase Storage (imágenes)',
  },
  {
    host: 'storage.googleapis.com',
    why: 'Storage: cadena del SDK para URL gs:// y descargas',
  },
  { host: '*.cloudfunctions.net', why: 'callables de Functions (us-central1)' },
  {
    host: 'securetoken.google.com',
    why: 'emisor (iss) de los tokens de Auth: cadena de comparación, no se pide',
  },
  {
    host: 'apis.google.com',
    path: '/js/api.js',
    why: 'cargador gapi del SDK de Auth; solo se activa con ventanas emergentes o reCAPTCHA, que el sitio no usa',
  },
  {
    host: 'www.google.com',
    path: '/recaptcha/',
    why: 'reCAPTCHA del SDK de Auth; solo se activa si se usa, y el sitio no lo usa',
  },
  {
    host: 'www.google.com',
    path: '/images/cleardot.gif',
    why: 'píxel de sondeo del SDK de Auth (iframe gapi); no se pide en el flujo del sitio',
  },
  // (c) Cadenas que no generan peticiones.
  { host: 'manglerojo.org', why: 'enlace del apoyo en el pie (RF-2 (015)); es un enlace, no se pide nada' },
  {
    host: 'www.w3.org',
    why: 'espacios de nombres XML/SVG/MathML (`xmlns`), son identificadores, no direcciones',
  },
  {
    host: 'react.dev',
    path: '/errors/',
    why: 'enlace de documentación dentro de mensajes de error de React',
  },
  {
    host: 'firebase.google.com',
    path: '/docs/',
    why: 'enlace de documentación dentro de mensajes de error de Firebase',
  },
  {
    host: 'firebase.google.com',
    path: '/pricing',
    why: 'enlace de documentación dentro de mensajes de error de Firebase',
  },
  {
    host: 'leafletjs.com',
    why: 'enlace de la atribución de Leaflet (texto del control, no se pide)',
  },
  {
    host: 'www.openstreetmap.org',
    path: '/copyright',
    why: 'enlace de la atribución del mapa (texto del control, no se pide)',
  },
  {
    host: 'type.googleapis.com',
    path: '/google.protobuf.',
    why: 'nombre de tipo de protobuf (`@type`), no una dirección',
  },
];

export interface FoundUrl {
  raw: string;
  host: string;
  path: string;
}

type Kind = 'html' | 'css' | 'js';

const HOST = '[a-z0-9{}][a-z0-9{}.-]*\\.[a-z]{2,}';
const parse = (raw: string, host: string, path: string): FoundUrl => ({
  raw,
  host: host.toLowerCase(),
  path,
});

/**
 * Las URL absolutas de un texto emitido. En todos: `http(s)://host/ruta`. Protocolo relativo (`//host`) solo donde
 * es una dirección: `src`/`href` del HTML, `url()`/`@import` del CSS y cadenas entrecomilladas del JS (así una
 * expresión regular como `/…//i.test(e)` no cuenta). En el JS, además, los nombres de host de Google sin esquema
 * (`firestore.googleapis.com`): el SDK arma la URL con `"https://" + host`.
 */
export function extractUrls(kind: Kind, text: string): FoundUrl[] {
  const found = new Map<string, FoundUrl>();
  const add = (raw: string, host: string, path: string) => found.set(raw, parse(raw, host, path));
  for (const m of text.matchAll(new RegExp(`https?://(${HOST})(/[^"'\`\\s)<>\\\\]*)?`, 'gi'))) add(m[0], m[1]!, m[2] ?? '');
  const relative: Record<Kind, RegExp> = {
    html: new RegExp(`(?:src|href|srcset|content)\\s*=\\s*["']\\s*//(${HOST})(/[^"'\\s]*)?`, 'gi'),
    css: new RegExp(`(?:url\\(\\s*|@import\\s+)["']?//(${HOST})(/[^"')\\s]*)?`, 'gi'),
    js: new RegExp(`["'\`]//(${HOST})(/[^"'\`\\s)]*)?`, 'gi'),
  };
  for (const m of text.matchAll(relative[kind])) add(m[0], m[1]!, m[2] ?? '');
  if (kind === 'js') {
    const bare = new RegExp(
      `([a-z0-9{}][a-z0-9{}.-]*\\.(?:googleapis\\.com|gstatic\\.com|cloudfunctions\\.net))(/[^"'\`\\s)<>\\\\]*)?`,
      'gi',
    );
    for (const m of text.matchAll(bare)) add(m[0], m[1]!, m[2] ?? '');
  }
  return [...found.values()];
}

const hostMatches = (pattern: string, host: string): boolean =>
  pattern.startsWith('*.') ? host === pattern.slice(2) || host.endsWith(pattern.slice(1)) : host === pattern;

/** Las URL que no están en la lista permitida. */
export function disallowed(urls: FoundUrl[], allowed: Allowed[] = ALLOWED): FoundUrl[] {
  return urls.filter(
    ({ host, path }) => !allowed.some((a) => hostMatches(a.host, host) && (a.path === undefined || path.startsWith(a.path))),
  );
}

const outs: string[] = [];
afterAll(() => {
  for (const dir of outs) rmSync(dir, { recursive: true, force: true });
});

describe('sin terceros: extracción y validación', () => {
  it('RNF-3 (002): un HTML que enlaza fonts.googleapis.com no pasa la validación', () => {
    const html = '<link href="https://fonts.googleapis.com/css2?family=Nunito" rel="stylesheet" />';
    expect(disallowed(extractUrls('html', html)).map((u) => u.host)).toEqual(['fonts.googleapis.com']);
  });

  it('RNF-3 (002): fonts.gstatic.com y un @import o url() con protocolo relativo tampoco pasan', () => {
    const css = '@import "//fonts.googleapis.com/css"; a { background: url(https://fonts.gstatic.com/s/x.woff2) }';
    expect(
      disallowed(extractUrls('css', css))
        .map((u) => u.host)
        .sort(),
    ).toEqual(['fonts.googleapis.com', 'fonts.gstatic.com']);
  });

  it('RNF-3 (002): en el JS cuentan las cadenas con host de Google sin esquema', () => {
    expect(disallowed(extractUrls('js', 'const h = "fonts.googleapis.com";')).map((u) => u.host)).toEqual(['fonts.googleapis.com']);
    expect(disallowed(extractUrls('js', 'const h = "firestore.googleapis.com";'))).toEqual([]);
  });

  it('RNF-3 (002): los hosts propios y las teselas de OpenStreetMap pasan', () => {
    const js =
      'a("https://tile.openstreetmap.org/{z}/{x}/{y}.png"); b("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"); c("https://apicca.com/brand/og-image.png")';
    expect(disallowed(extractUrls('js', js))).toEqual([]);
  });

  it('RNF-3 (002): una expresión regular con // no se toma por una URL', () => {
    expect(extractUrls('js', 'if(/^\\d+$|\\/\\/i.test(e))x();/a//i.test(e)')).toEqual([]);
  });
});

describe('sin terceros: el build', () => {
  it('RNF-3 (002): el HTML, el CSS y el JS emitidos solo nombran hosts de la lista permitida', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'apicca-third-party-'));
    outs.push(outDir);
    // Vitest fija NODE_ENV=test y React compilaría su versión de desarrollo, con cientos de enlaces de
    // advertencias que el sitio publicado no lleva: se compila con el entorno de producción.
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({
        root,
        mode: 'production',
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true },
      });
    } finally {
      process.env.NODE_ENV = savedEnv;
    }
    const files = (readdirSync(outDir, { recursive: true }) as string[]).map((name) => name.split('\\').join('/'));
    const kinds: [Kind, RegExp][] = [
      ['html', /\.html$/],
      ['css', /\.css$/],
      ['js', /\.js$/],
    ];
    const violations: string[] = [];
    let scanned = 0;
    for (const [kind, pattern] of kinds) {
      for (const name of files.filter((file) => pattern.test(file))) {
        scanned += 1;
        for (const url of disallowed(extractUrls(kind, readFileSync(join(outDir, name), 'utf8')))) violations.push(`${name}: ${url.raw}`);
      }
    }
    expect(scanned, 'se revisó al menos el HTML, una hoja y un script').toBeGreaterThanOrEqual(3);
    expect(violations).toEqual([]);
  }, 180_000);
});
