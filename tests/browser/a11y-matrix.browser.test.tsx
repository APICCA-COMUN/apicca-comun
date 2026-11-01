// RNF-1 (002), D-T21 (002), plan §9.4: matriz de accesibilidad en Chromium real:
// recorre '/', '/entrar', '/prototipado', '/tablero' (con la sesión de la autora), '/documentacion', '/constitucion' y las otras cinco rutas de la constitución común (RNF-4 (004)) en la matriz de colores forzados y contraste aumentado × dos temas (claro y oscuro),
// verificando que cada control navegable con el tabulador muestra un indicador de foco visible.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, commands, page, userEvent } from 'vitest/browser';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/paths.css';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { signInAs, signOutNow } from './session';
import { AUTHOR, CONSTITUTION_IDS } from './seed-data';

interface MatrixCase {
  readonly feature: 'forced-colors' | 'prefers-contrast';
  readonly value: 'active' | 'more';
  readonly isForced: boolean;
  readonly theme: 'light' | 'dark';
  readonly label: string;
}

const MATRIX: readonly MatrixCase[] = [
  {
    feature: 'forced-colors',
    value: 'active',
    isForced: true,
    theme: 'light',
    label: 'colores forzados en tema claro',
  },
  {
    feature: 'forced-colors',
    value: 'active',
    isForced: true,
    theme: 'dark',
    label: 'colores forzados en tema oscuro',
  },
  {
    feature: 'prefers-contrast',
    value: 'more',
    isForced: false,
    theme: 'light',
    label: 'contraste aumentado en tema claro',
  },
  {
    feature: 'prefers-contrast',
    value: 'more',
    isForced: false,
    theme: 'dark',
    label: 'contraste aumentado en tema oscuro',
  },
];

/** Las seis rutas de la constitución común con ids sembrados (RNF-4 (004), T-11.1); todas piden la sesión de la autora salvo la pública. */
const CONSTITUTION_ROUTES: readonly { path: string; as?: typeof AUTHOR }[] = [
  { path: '/constitucion' },
  { path: '/constitucion/historial', as: AUTHOR },
  { path: `/constitucion/secciones/${CONSTITUTION_IDS.sections.water}`, as: AUTHOR },
  { path: `/constitucion/documentos/${CONSTITUTION_IDS.document}` },
  { path: '/constitucion/propuestas', as: AUTHOR },
  { path: `/constitucion/propuestas/${CONSTITUTION_IDS.amendments.openChange}`, as: AUTHOR },
];

/** `/tablero` pide la sesión de la autora (RNF-1 (003), T-7.4). */
const ROUTES: readonly { path: string; as?: typeof AUTHOR }[] = [
  { path: '/' },
  { path: '/entrar' },
  { path: '/prototipado' },
  { path: '/documentacion' },
  ...CONSTITUTION_ROUTES,
  { path: '/tablero', as: AUTHOR },
];

let signedInAs: string | null = null;

/** Cambia de cuenta solo si hace falta; `undefined` cierra la sesión. */
async function useAccount(account: typeof AUTHOR | undefined) {
  const wanted = account?.uid ?? null;
  if (wanted === signedInAs) return;
  if (signedInAs !== null) await signOutNow();
  if (account !== undefined) await signInAs(account);
  signedInAs = wanted;
  // La sesión llega al sitio por el observador de Auth y la escucha de la cuenta.
  await new Promise((done) => setTimeout(done, 300));
}

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

async function waitFor<T>(find: () => T | null | undefined | false, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    if (Date.now() > until) throw new Error('waitFor: se agotó la espera.');
    await new Promise((done) => setTimeout(done, 50));
  }
}

/** Resuelve un color del sistema a su valor calculado con un elemento auxiliar (como en logo.browser.test.tsx). */
function resolveSystemColor(name: string, property: 'color' | 'outlineColor' = 'outlineColor'): string {
  const probe = document.createElement('span');
  probe.style[property] = name;
  if (property === 'outlineColor') {
    probe.style.outlineStyle = 'solid';
  }
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

/** El valor calculado de una propiedad con un token, resuelto con un elemento auxiliar (como en blocks.browser.test.tsx). */
function computed(property: 'borderRadius' | 'boxShadow' | 'color', token: string): string {
  const probe = document.createElement('div');
  probe.style[property] = `var(--${token})`;
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

async function show(path: string) {
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  await waitFor(() => !host!.textContent!.includes('Cargando') && host!.querySelector('main h1, main h2'));
  // Al cambiar de tema la sombra transita (RF-9 (002)): se mide ya en reposo.
  await waitFor(() => document.getAnimations().length === 0);
}

beforeAll(async () => {
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

afterEach(async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  delete document.documentElement.dataset['theme'];
  (document.activeElement as HTMLElement | null)?.blur();
});

afterAll(async () => {
  await useAccount(undefined);
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  delete document.documentElement.dataset['theme'];
  history.replaceState(null, '', previousPath);
  await page.viewport(1280, 800);
});

/** Recorre el tabulador y exige un indicador de foco visible, de 2 px o más y del color esperado, en cada parada. */
async function expectFocusRings(expectedColor: string) {
  const seen = new Set<Element>();
  for (let stop = 0; stop < 20; stop += 1) {
    await userEvent.tab();
    const active = document.activeElement;
    if (active === null || active === document.body || seen.has(active) || !host!.contains(active)) {
      break;
    }
    seen.add(active);
    const style = getComputedStyle(active);
    const tag = active.outerHTML.slice(0, 80);
    expect(active.matches(':focus-visible'), tag).toBe(true);
    expect(style.outlineStyle, tag).not.toBe('none');
    expect(parseFloat(style.outlineWidth), tag).toBeGreaterThanOrEqual(2);
    expect(style.outlineColor, tag).toBe(expectedColor);
  }
  expect(seen.size).toBeGreaterThan(0);
}

describe.each(MATRIX)('matriz de accesibilidad · $label', ({ feature, value, isForced, theme, label }) => {
  it.each(ROUTES)(
    `RNF-1 (002), RNF-1 (003), RNF-4 (004) · en $path con ${label}: cada parada del tabulador muestra un foco visible`,
    async ({ path, as }) => {
      await cdp().send('Emulation.setEmulatedMedia', {
        features: [{ name: feature, value }],
      });
      document.documentElement.dataset['theme'] = theme;
      await page.viewport(1280, 800);
      await useAccount(as);
      await show(path);
      if (as !== undefined) expect(location.pathname).toBe(path);
      (document.activeElement as HTMLElement | null)?.blur();

      const expectedColor = isForced
        ? resolveSystemColor('Highlight', 'outlineColor')
        : computed('color', 'focus');

      await expectFocusRings(expectedColor);
    },
  );
});

/** El mismo recorrido a 360 px, el ancho de la pantalla angosta (RNF-4 (004)): el foco sigue visible y la página no se desplaza a los lados. */
describe.each(['light', 'dark'] as const)('constitución común a 360 px · tema %s', (theme) => {
  it.each(CONSTITUTION_ROUTES)('RNF-4 (004) · en $path a 360 px con teclado, foco visible y sin desplazamiento horizontal', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await useAccount(as);
    await show(path);
    if (as !== undefined) expect(location.pathname).toBe(path);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    (document.activeElement as HTMLElement | null)?.blur();
    await expectFocusRings(computed('color', 'focus'));
  });
});
