// RF-17 (003) · 17.3, D-T21 (003): línea base de nombres accesibles. Monta la `App` real en cada ruta del router,
// como facilitador y como visitante, con dobles en memoria, y compara el conjunto `{ role, name }` de `<main>`
// con `fixtures/names-002.json`. Con `GEN_NAMES=1` escribe el fixture en lugar de compararlo (solo en H0, antes
// de cambiar piel alguna).
import './appDoubles';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { ROUTES, isMapPage, matchRoute } from '../app/router';
import { SessionProvider, VISITOR, type SessionState } from '../app/session';
import { accessibleNames, type AccessibleName } from './accessibleNames';

const FIXTURE = resolve(process.cwd(), 'src/testing/fixtures/names-002.json');
const GENERATE = process.env.GEN_NAMES === '1';

/** Cada patrón con parámetros de ejemplo, más la ruta desconocida. */
const ALL_PATHS = [...ROUTES.map((route) => route.pattern.replace(/:[a-z]+/gi, 'ejemplo')), '/ruta-que-no-existe'];

const FACILITATOR: SessionState = { status: 'person', uid: 'fab', role: 'facilitator', username: 'fabi' };
const SESSIONS: Array<[string, SessionState]> = [
  ['facilitador', FACILITATOR],
  ['visitante', VISITOR],
];

type Fixture = Record<string, Record<string, AccessibleName[]>>;
const baseline: Fixture = GENERATE ? {} : (JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture);
const generated: Fixture = {};

/**
 * Al comparar, solo las rutas que ya existían en la 002; las nuevas las cubren el inventario y T-5.17 (003).
 * RF-11 (021), D-T21 (021): `/` y los paneles del ápice son ahora el mapa, con su barra dentro de `<main>`; sus nombres los
 * fijan `Play.test.tsx` y el inventario, así que no se comparan con la 002. Tampoco `/entrar` con sesión, que lleva al
 * mapa con lo propio (RF-17 (021) · 17.2).
 */
const isMapPath = (path: string): boolean => isMapPage(matchRoute(path).page);
const PATHS = GENERATE ? ALL_PATHS : ALL_PATHS.filter((path) => path in baseline && !isMapPath(path));
const compared = (path: string, who: string): boolean => GENERATE || !(path === '/entrar' && who === 'facilitador');

/** Sin sesión, `/entrar` enlaza a «Solicitar inscripción» (RF-13 (003) · 13.3) y suma «Mostrar contraseña» (RF-5 (005)). */
const ADDED: Record<string, AccessibleName[]> = {
  '/entrar · visitante': [{ role: 'link', name: 'Pide tu inscripción' }, { role: 'button', name: 'Mostrar contraseña' }],
  // Sin sesión, Facilitación ofrece «Entrar» dentro de `<main>` (RF-9 (024) · 9.1).
  '/facilitacion/invitaciones · visitante': [{ role: 'link', name: 'Entrar' }], // RF-9 (024) · 9.1
  '/facilitacion/solicitudes · visitante': [{ role: 'link', name: 'Entrar' }], // RF-9 (024) · 9.1
  '/facilitacion/cuentas · visitante': [{ role: 'link', name: 'Entrar' }], // RF-9 (024) · 9.1
};
/** Nombres que la 008 sustituye por los del lienzo en `/entrar` (RF-7 (008) · 7.5, 7.6, D-10 (008)). */
const RENAMED: Record<string, string> = { 'Correo electrónico': 'Correo', '¿Olvidaste tu contraseña?': 'Olvidé mi contraseña' };
/** RF-17 (019) · 17.1, 17.2, D-T11 (019): en toda ruta, «Estado» se llama «Etapa» y las etapas van con mayúscula inicial. */
const STAGE_RENAMED: Record<string, string> = { Estado: 'Etapa', idea: 'Idea', prototipo: 'Prototipo', 'en marcha': 'En marcha' };
const withRenames = (names: AccessibleName[], path: string): AccessibleName[] =>
  names.map((entry) => {
    const name = path === '/entrar' ? (RENAMED[entry.name] ?? entry.name) : entry.name;
    return { ...entry, name: STAGE_RENAMED[name] ?? name };
  });

const expectedNames = (path: string, who: string): AccessibleName[] | undefined => {
  const base = baseline[path]?.[who];
  if (base === undefined) return base;
  const added = ADDED[`${path} · ${who}`] ?? [];
  return withRenames([...base, ...added], path).sort((a, b) => a.role.localeCompare(b.role, 'es') || a.name.localeCompare(b.name, 'es'));
};

/** Algunas piezas (el mapa tras una redirección) se pintan tarde: espera a que el conjunto no cambie. */
async function settledNames(): Promise<AccessibleName[]> {
  let last = '';
  for (let round = 0; round < 40; round++) {
    const current = JSON.stringify(accessibleNames(document.body));
    if (current === last) return JSON.parse(current) as AccessibleName[];
    last = current;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('Los nombres accesibles no se asientan.');
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

afterAll(() => {
  if (GENERATE) writeFileSync(FIXTURE, `${JSON.stringify(generated, null, 2)}\n`);
});

describe.each(PATHS)('nombres accesibles en %s', (path) => {
  it.each(SESSIONS.filter(([who]) => compared(path, who)))('RF-17 (003) · 17.3: como %s, los nombres de <main> son los de la línea base', async (who, session) => {
    window.history.replaceState(null, '', path);
    render(
      <SessionProvider initial={session}>
        <App />
      </SessionProvider>,
    );
    // La CI corre en un runner lento: 1 s por defecto no siempre alcanza para que termine la carga (R6 (013)).
    await waitFor(() => expect(screen.queryByText(/Cargando/)).toBeNull(), { timeout: 5000 });
    expect(document.body.querySelector('main')).not.toBeNull();
    if (GENERATE) (generated[path] ??= {})[who] = await settledNames();
    else await waitFor(() => expect(accessibleNames(document.body)).toEqual(expectedNames(path, who)), { timeout: 5000 });
  });
});

describe('accessibleNames', () => {
  it('RF-17 (003) · 17.3: toma etiqueta, aria-label y texto; omite lo oculto y lo que está fuera de <main>', () => {
    document.body.innerHTML = `
      <nav><a href="/fuera">Fuera</a></nav>
      <main>
        <label for="n">Nombre</label><input id="n">
        <button aria-label="Cerrar">×</button>
        <a href="/x">Ir <span aria-hidden="true">→</span></a>
        <button hidden>Oculto</button>
        <input type="hidden" name="h">
        <button>Ir</button><button>Ir</button>
      </main>`;
    expect(accessibleNames(document.body)).toEqual([
      { role: 'button', name: 'Cerrar' },
      { role: 'button', name: 'Ir' },
      { role: 'link', name: 'Ir' },
      { role: 'textbox', name: 'Nombre' },
    ]);
  });
});
