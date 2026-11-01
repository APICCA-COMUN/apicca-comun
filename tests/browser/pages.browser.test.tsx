// Capturas de página (T-8.2, RNF-5 (002); RNF-2 (003), D-T22 (003), T-7.5 (003)): con la siembra completa, cada ruta del inventario en los dos temas
// y a 360 y 1280 px. Cubren el logo en la cabecera (RF-1 (002) · 1.1), los colores de los temas (RF-3 (002) ·
// 3.1, 3.2) y la pantalla angosta (RF-6 (002) · 6.6). Las referencias viven en `__screenshots__/` con sufijo
// de plataforma y se versionan solo cuando la persona las aprueba (T-8.4). La tolerancia es la de
// `vitest.config.ts` (D-T12 (002)).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cdp, commands, page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/paths.css';
import { THEMES } from '../../shared/domain/identity';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { THEME_KEY } from '../../src/app/theme';
import { signInAs, signOutNow } from './session';
import { APICE_IDS, AUTHOR, CONSTITUTION_IDS, FACILITATOR } from './seed-data';

type Account = typeof AUTHOR | typeof FACILITATOR;

/** Las páginas de T-8.2, con un nombre estable para la referencia y la cuenta que piden. */
/** `ready`: un texto (o varios) que la página solo pinta ya cargada, cuando no muestra «Cargando» mientras lee. */
const SCREENS: { name: string; path: string; as?: Account; ready?: string | string[] }[] = [
  { name: 'inicio', path: '/' },
  { name: 'apice-con-imagen', path: `/apices/${APICE_IDS.withImage}` },
  { name: 'apice-cinco-ejes', path: `/apices/${APICE_IDS.allAxes}` },
  { name: 'apice-con-etiquetas', path: `/apices/${APICE_IDS.private}`, as: AUTHOR },
  { name: 'apice-editar', path: `/apices/${APICE_IDS.withImage}/editar`, as: AUTHOR },
  { name: 'entrar', path: '/entrar' },
  { name: 'invitaciones', path: '/facilitacion/invitaciones', as: FACILITATOR },
  { name: 'no-existe', path: '/ruta-que-no-existe' },
  // Las rutas nuevas de la 003 (RNF-2 (003), T-7.5 (003)).
  { name: 'tablero', path: '/tablero', as: AUTHOR },
  { name: 'prototipado', path: '/prototipado' },
  { name: 'documentacion', path: '/documentacion' },
  // La constitución común sembrada (T-11.1, T-11.2, RNF-4 (004)): las seis rutas con ids fijos.
  { name: 'constitucion', path: '/constitucion', ready: ['Agua compartida', 'Escuchar primero'] },
  { name: 'constitucion-historial', path: '/constitucion/historial', as: AUTHOR, ready: 'Cuidado mutuo ampliado' },
  { name: 'constitucion-seccion', path: `/constitucion/secciones/${CONSTITUTION_IDS.sections.water}`, as: AUTHOR, ready: ['Agua compartida', 'Versión 1'] },
  { name: 'constitucion-documento', path: `/constitucion/documentos/${CONSTITUTION_IDS.document}`, ready: 'Escuchar primero' },
  { name: 'propuestas', path: '/constitucion/propuestas', as: AUTHOR, ready: ['Memoria de las cosechas', 'Resultado: Aprobada'] },
  { name: 'propuesta', path: `/constitucion/propuestas/${CONSTITUTION_IDS.amendments.openChange}`, as: AUTHOR, ready: ['Agua compartida con turnos', 'Me parece bien', '1 acuerdo contado'] },
];

const WIDTHS = [360, 1280] as const;

/** La fecha fija de D-T13 (002), la misma que usan la siembra y el comando de `index.html`. */
const FIXED_NOW = new Date('2026-10-08T12:00:00Z');

let signedInAs: string | null = null;
let host: HTMLDivElement | undefined;
let root: Root | undefined;
let previousPath: string;

async function actNow(run: () => void | Promise<void>) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      await run();
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

// La hora está fija: se cuenta en intentos de 50 ms, no con `Date.now()`.
async function waitFor<T>(find: () => T | null | undefined | false, timeoutMs = 10_000): Promise<T> {
  for (let attempt = 0; attempt * 50 <= timeoutMs; attempt += 1) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('waitFor: se agotó la espera.');
}

/** Cambia de cuenta solo si hace falta; `undefined` cierra la sesión. */
async function useAccount(account: Account | undefined) {
  const wanted = account?.uid ?? null;
  if (wanted === signedInAs) return;
  if (signedInAs !== null) await signOutNow();
  if (account !== undefined) await signInAs(account);
  signedInAs = wanted;
  // La sesión llega al sitio por el observador de Auth y la escucha de la cuenta.
  await new Promise((done) => setTimeout(done, 300));
}

/** Monta la ruta y espera a que quede quieta: sin «Cargando», con las imágenes, la fuente y sin transiciones. */
async function show(path: string, ready?: string | string[]) {
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  for (const text of ready === undefined ? [] : [ready].flat()) await waitFor(() => host!.textContent!.includes(text));
  await waitFor(() => !host!.textContent!.includes('Cargando') && host!.querySelector('main h1, main h2'));
  await waitFor(() => [...host!.querySelectorAll('img')].every((img) => img.complete));
  await document.fonts.ready;
  await waitFor(() => document.getAnimations().length === 0);
}

/** Elige el tema como lo haría otra pestaña, para que el conmutador del sitio lo refleje (RF-3 (002) · 3.4). */
async function chooseTheme(theme: string) {
  await actNow(() => {
    dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: theme }));
  });
}

/** Saca el puntero de la ventana: un `:hover` heredado de otra prueba cambiaría la sombra de un botón (RF-9 (002)). */
async function parkPointer() {
  await cdp().send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -1, y: -1 });
}

/**
 * Alarga la ventana hasta el alto del sitio montado: lo que queda fuera de ella saldría en blanco. Se mide el
 * contenedor que se captura y no `scrollHeight` del documento, al que un elemento con posición absoluta que
 * sobresale (según lo que dejó la prueba anterior) le suma unos píxeles y cambia la escala de la captura.
 */
async function fitHeight(width: number) {
  // Lo que se monta tarde (el mapa del selector) puede alargar la página: se repite hasta que el alto se quede quieto.
  for (let attempt = 0, height = 0; attempt < 5; attempt += 1) {
    const next = Math.max(800, Math.ceil(host!.getBoundingClientRect().height));
    if (next === height) break;
    height = next;
    await page.viewport(width, height);
    await new Promise((done) => setTimeout(done, 200));
    await waitFor(() => [...host!.querySelectorAll('img')].every((img) => img.complete));
    await waitFor(() => document.getAnimations().length === 0);
  }
}

beforeAll(async () => {
  vi.setSystemTime(FIXED_NOW);
  // Sin transiciones (D-T13 (002)): la captura no depende de cuándo termina una animación.
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await commands.seedFull();
  previousPath = location.pathname + location.search;
  history.replaceState(null, '', '/');
  host = document.createElement('div');
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() =>
    created.render(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    ),
  );
});

afterAll(async () => {
  await useAccount(undefined);
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  vi.useRealTimers();
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  delete document.documentElement.dataset['theme'];
  try {
    localStorage.removeItem(THEME_KEY);
  } catch {
    // Sin almacenamiento no queda nada que limpiar.
  }
  history.replaceState(null, '', previousPath);
  await page.viewport(1280, 800);
});

describe.each(THEMES)('páginas en el tema %s', (theme) => {
  describe.each(WIDTHS)('a %i px', (width) => {
    it.each(SCREENS)('RNF-5 (002), RNF-2 (003), RF-1 (003) · 1.1, 1.2, RF-2 (003) · 2.2, 2.3, RF-3 (003) · 3.1, 3.2, RF-7 (003) · 7.8, RF-13 (003) · 13.1: la página $name coincide con su referencia', async ({ name, path, as, ready }) => {
      await chooseTheme(theme);
      await page.viewport(width, 800);
      await useAccount(as);
      await show(path, ready);
      await fitHeight(width);
      await parkPointer();
      await expect.element(page.elementLocator(host!)).toMatchScreenshot(`${name}-${theme}-${width}`);
    });
  });
});

/** Las rutas nuevas y las de acceso que no deben desplazarse a los lados a 360 px (T-5.19, T-6.24, T-7.3). */
const NARROW_ROUTES: { path: string; as?: Account }[] = [
  { path: '/' },
  { path: '/prototipado' },
  { path: '/entrar' },
  { path: '/olvide' },
  { path: '/registro' },
  { path: '/solicitar' },
  { path: '/documentacion' },
  { path: '/constitucion' },
  { path: '/constitucion/historial', as: AUTHOR },
  { path: `/constitucion/secciones/${CONSTITUTION_IDS.sections.water}`, as: AUTHOR },
  { path: `/constitucion/documentos/${CONSTITUTION_IDS.document}` },
  { path: '/constitucion/propuestas', as: AUTHOR },
  { path: `/constitucion/propuestas/${CONSTITUTION_IDS.amendments.openChange}`, as: AUTHOR },
  { path: '/tablero', as: AUTHOR },
];

/** El borde derecho visible de un elemento: lo que un antepasado recorta no desplaza la página. */
function visibleRight(element: Element): number {
  let right = element.getBoundingClientRect().right;
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowX !== 'visible') right = Math.min(right, parent.getBoundingClientRect().right);
  }
  return right;
}

describe.each(THEMES)('pantalla angosta en el tema %s', (theme) => {
  it.each(NARROW_ROUTES)('RF-16 (003) · 16.3; RF-3 (003) · 3.2: en $path a 360 px no hay desplazamiento horizontal', async ({ path, as }) => {
    await chooseTheme(theme);
    await page.viewport(360, 800);
    await useAccount(as);
    await show(path);
    // Con cuenta, la ruta se monta sin redirigir ni caer en la pantalla de acceso.
    if (as !== undefined) expect(location.pathname).toBe(path);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    const wide = [...host!.querySelectorAll<HTMLElement>('*')]
      .filter((el) => visibleRight(el) > innerWidth + 0.5)
      .map((el) => el.outerHTML.slice(0, 100));
    expect(wide).toEqual([]);
  });
});
