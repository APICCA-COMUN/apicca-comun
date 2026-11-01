// Uso del color en Chromium real (T-4.16, plan §9.4): en las rutas que la siembra completa permite
// montar (con la sesión de la autora en `/tablero`), solo `.action-destructive` y `[role=alert]` calculan `brand-red` (RF-2 (002) · 2.3), solo
// `.action-primary` y los enlaces calculan `action-blue` (RF-2 (002) · 2.4) y solo el interior de
// `.logo` calcula un `logo-*` (RF-2 (002) · 2.3). Se miran el color, el fondo y los cuatro bordes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
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
import { signInAs, signOutNow } from './session';
import { AUTHOR, LONG_APICE_ID } from './seed-data';

/** Rutas que la siembra deja con contenido, con la cuenta que piden (`/tablero` pide la de la autora, T-7.3); la desconocida va antes. */
const PATHS: { path: string; as?: typeof AUTHOR }[] = [
  { path: '/' },
  { path: '/entrar' },
  { path: '/olvide' },
  { path: '/registro' },
  { path: '/solicitar' },
  { path: `/apices/${LONG_APICE_ID}` },
  { path: '/prototipado' },
  { path: '/documentacion' },
  { path: '/constitucion' },
  { path: '/ruta-que-no-existe' },
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

/** Dónde puede aparecer cada token reservado: el elemento o un antepasado debe coincidir. */
const ALLOWED: Record<string, string> = {
  'brand-red': '.action-destructive, [role="alert"]',
  'action-blue': '.action-primary, a',
  'logo-gray': '.logo',
  'logo-red': '.logo',
  'logo-blue': '.logo',
};

const PROPERTIES = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'] as const;

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

/** El valor calculado de cada token reservado en el tema vigente. */
function reservedColors(): Map<string, string[]> {
  const byValue = new Map<string, string[]>();
  for (const token of Object.keys(ALLOWED)) {
    const probe = document.createElement('div');
    probe.style.color = `var(--${token})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    byValue.set(value, [...(byValue.get(value) ?? []), token]);
  }
  return byValue;
}

/** Los elementos que usan un color reservado donde no les toca, con el token y la propiedad. */
function misuses(container: Element): string[] {
  const reserved = reservedColors();
  const found: string[] = [];
  for (const element of [container, ...container.querySelectorAll('*')]) {
    const style = getComputedStyle(element);
    for (const property of PROPERTIES) {
      if (property !== 'color' && property !== 'backgroundColor') {
        const side = property.replace('Color', 'Width') as 'borderTopWidth';
        if (parseFloat(style[side]) === 0) continue;
      }
      const tokens = reserved.get(style[property]);
      if (tokens === undefined) continue;
      // Un valor compartido por varios tokens basta que esté permitido para uno.
      if (tokens.some((token) => element.closest(ALLOWED[token]!) !== null)) continue;
      found.push(`${tokens.join('/')} en ${property}: ${element.outerHTML.slice(0, 100)}`);
    }
  }
  return found;
}

async function show(path: string) {
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  await waitFor(() => !host!.textContent!.includes('Cargando') && host!.querySelector('main h1, main h2'));
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

afterAll(async () => {
  await useAccount(undefined);
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  delete document.documentElement.dataset['theme'];
  history.replaceState(null, '', previousPath);
});

describe.each(THEMES)('uso del color en el tema %s', (theme) => {
  it.each(PATHS)('RF-2 (002) · 2.3, 2.4: en $path los colores reservados solo están donde les toca', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await useAccount(as);
    await show(path);
    if (as !== undefined) expect(location.pathname).toBe(path);
    expect(misuses(host!)).toEqual([]);
  });

  it('RF-2 (002) · 2.3: con el aviso de error de /entrar a la vista, el rojo sigue solo en el aviso', async () => {
    document.documentElement.dataset['theme'] = theme;
    await useAccount(undefined);
    await show('/entrar');
    // Una cuenta que no existe en el emulador de Auth: el formulario muestra su aviso de error.
    const [email, password] = [...host!.querySelectorAll<HTMLInputElement>('form input')];
    await userEvent.fill(email!, 'nadie@ejemplo.org');
    await userEvent.fill(password!, 'clave-que-no-existe');
    await userEvent.click(host!.querySelector<HTMLButtonElement>('form button[type="submit"]')!);
    await waitFor(() => host!.querySelector('[role="alert"]'));
    expect(misuses(host!)).toEqual([]);
  });
});
