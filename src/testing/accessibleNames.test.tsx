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
import { ROUTES } from '../app/router';
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
 * Lo que la 002 mostraba en el inicio vive ahora en `/prototipado` (RF-18 (003), D-19 (003)); también la
 * visita a `/entrar` con sesión, que antes caía en el mapa del inicio.
 */
const PATHS = GENERATE ? ALL_PATHS : ALL_PATHS.filter((path) => path in baseline);
const RELOCATED: Record<string, string> = { '/': '/prototipado', '/entrar · facilitador': '/prototipado' };
const visitedPath = (path: string, who: string): string =>
  GENERATE ? path : (RELOCATED[`${path} · ${who}`] ?? RELOCATED[path] ?? path);

/**
 * Lo único nuevo: con sesión, Prototipado suma «Nuevo ápice» (RF-18 (003) · 18.2); sin sesión, `/entrar`
 * enlaza a «Solicitar inscripción» (RF-13 (003) · 13.3). Con la 005 (RF-12 (005) · 12.1), Prototipado suma un
 * edificio del lote por ápice (RF-6 (005) · 6.1) y `/entrar`, «Mostrar contraseña» (RF-5 (005)). Con la 005 v0.4
 * (RF-7 (005) · 7.12), el panel está siempre a la vista con el primer ápice: «Ver ficha» y, para quien puede editar,
 * su edición rápida; los botones de eje del panel repiten los nombres de los filtros.
 */
/**
 * Con la 019, el edificio suma la etapa a su nombre (D-T19 (019)), la franja suma «Ver como lista» (RF-6 (019) · 6.2) y
 * la lista ya no se ve junto al terreno, así que sale el enlace de su tarjeta (RF-6 (019) · 6.3). El mapa queda detrás de
 * «Ver en el mapa» (RF-10 (019) · 10.5): sale su pin y entra el control.
 */
const BUILDING: AccessibleName = { role: 'button', name: 'Huerta del barrio, Idea' };
const VIEW_TOGGLE: AccessibleName = { role: 'button', name: 'Ver como lista' };
const LIST_CARD: AccessibleName = { role: 'link', name: 'Huerta del barrio' };
const MAP_TOGGLE: AccessibleName = { role: 'button', name: 'Ver en el mapa' };
const MAP_PIN: AccessibleName = { role: 'button', name: 'Huerta del barrio: agua, alimento' };
const PANEL_VIEW: AccessibleName[] = [{ role: 'link', name: 'Ver ficha' }];
const PANEL_EDIT: AccessibleName[] = [
  { role: 'button', name: 'Guardar cambios' },
  { role: 'link', name: 'Editar todo' },
  { role: 'link', name: 'Ver historial' },
  { role: 'radio', name: 'en marcha' },
  { role: 'radio', name: 'idea' },
  { role: 'radio', name: 'prototipo' },
  { role: 'textbox', name: 'Descripción' },
  { role: 'textbox', name: 'Nombre' },
];
const ADDED: Record<string, AccessibleName[]> = {
  '/prototipado · facilitador': [{ role: 'link', name: 'Nuevo ápice' }, BUILDING, VIEW_TOGGLE, MAP_TOGGLE, ...PANEL_VIEW, ...PANEL_EDIT],
  '/prototipado · visitante': [BUILDING, VIEW_TOGGLE, MAP_TOGGLE, ...PANEL_VIEW],
  '/entrar · visitante': [{ role: 'link', name: 'Pide tu inscripción' }, { role: 'button', name: 'Mostrar contraseña' }],
};
/** Nombres que la 008 sustituye por los del lienzo en `/entrar` (RF-7 (008) · 7.5, 7.6, D-10 (008)). */
const RENAMED: Record<string, string> = { 'Correo electrónico': 'Correo', '¿Olvidaste tu contraseña?': 'Olvidé mi contraseña' };
/** RF-17 (019) · 17.1, 17.2, D-T11 (019): en toda ruta, «Estado» se llama «Etapa» y las etapas van con mayúscula inicial. */
const STAGE_RENAMED: Record<string, string> = { Estado: 'Etapa', idea: 'Idea', prototipo: 'Prototipo', 'en marcha': 'En marcha' };
const withRenames = (names: AccessibleName[], visited: string): AccessibleName[] =>
  names.map((entry) => {
    const name = visited === '/entrar' ? (RENAMED[entry.name] ?? entry.name) : entry.name;
    return { ...entry, name: STAGE_RENAMED[name] ?? name };
  });
/** Única excepción de rol (RF-17 (003) · 17.1, D-23 (003)): en Prototipado los filtros de eje pasan de casilla a botón; RF-12 (019) · 12.2: lo mismo con el selector de ejes del formulario. */
const AXIS_FILTERS = new Set(['Agua', 'Alimento', 'Cobijo', 'Comunicación', 'Energía']);
const withAxisButtons = (names: AccessibleName[], visited: string): AccessibleName[] =>
  !['/prototipado', '/apices/nuevo', '/apices/ejemplo/editar'].includes(visited)
    ? names
    : names.map((entry) => (entry.role === 'checkbox' && AXIS_FILTERS.has(entry.name) ? { ...entry, role: 'button' } : entry));

const expectedNames = (path: string, who: string): AccessibleName[] | undefined => {
  const base = baseline[path]?.[who];
  if (base === undefined) return base;
  const visited = visitedPath(path, who);
  const added = ADDED[`${visited} · ${who}`] ?? [];
  const hidden = [LIST_CARD, MAP_PIN];
  const shown = visited === '/prototipado' ? base.filter((entry) => !hidden.some((gone) => entry.role === gone.role && entry.name === gone.name)) : base;
  return withRenames([...withAxisButtons(shown, visited), ...added], visited).sort((a, b) => a.role.localeCompare(b.role, 'es') || a.name.localeCompare(b.name, 'es'));
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
  it.each(SESSIONS)('RF-17 (003) · 17.3: como %s, los nombres de <main> son los de la línea base', async (who, session) => {
    window.history.replaceState(null, '', visitedPath(path, who));
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
