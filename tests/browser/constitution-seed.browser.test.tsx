// RNF-4 (004), D-T18 (004) · La siembra de la constitución común (T-11.2) contra los emuladores: `seedPartial` la
// deja leíble en `/constitucion` sin cuenta, y con la sesión de la autora (`seedFull`) `/constitucion/propuestas`
// lista las dos abiertas y la cerrada. Las ids y los títulos vienen de `seed-data.ts`.
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
import { AUTHOR, CONSTITUTION_TITLES } from './seed-data';

let host: HTMLDivElement | undefined;
let root: Root | undefined;
let previousPath: string;
let signedIn = false;

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

/** Espera a que `find` devuelva algo; los datos llegan del emulador, fuera de React. */
async function waitFor<T>(find: () => T | null | undefined | false, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    if (Date.now() > until) throw new Error('waitFor: se agotó la espera.');
    await new Promise((done) => setTimeout(done, 50));
  }
}

async function visit(path: string, expected: string) {
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  await waitFor(() => host!.textContent!.includes(expected));
}

async function mountApp() {
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
}

afterEach(async () => {
  if (signedIn) await signOutNow();
  signedIn = false;
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  root = undefined;
  history.replaceState(null, '', previousPath);
});

afterAll(() => {
  history.replaceState(null, '', previousPath);
});

describe('constitución sembrada', () => {
  it('RNF-4 (004): seedPartial deja las tres secciones en /constitucion para quien no tiene cuenta', async () => {
    await commands.seedPartial();
    await mountApp();
    await visit('/constitucion', CONSTITUTION_TITLES.water);
    const text = host!.textContent!;
    for (const title of [CONSTITUTION_TITLES.water, CONSTITUTION_TITLES.care, CONSTITUTION_TITLES.exchange, CONSTITUTION_TITLES.document]) {
      expect(text).toContain(title);
    }
    // Las propuestas son solo de cuentas activas (RF-9 (004) · 9.4): el visitante no ve sus títulos.
    expect(text).not.toContain(CONSTITUTION_TITLES.openChange);
  });

  it('RNF-4 (004): con la sesión de la autora, /constitucion/propuestas lista dos abiertas y una cerrada', async () => {
    await commands.seedFull();
    await mountApp();
    await signInAs(AUTHOR);
    signedIn = true;
    await visit('/constitucion/propuestas', CONSTITUTION_TITLES.openAdd);
    await waitFor(() => host!.textContent!.includes(CONSTITUTION_TITLES.openChange));
    await waitFor(() => host!.textContent!.includes(CONSTITUTION_TITLES.closed));
    expect(location.pathname).toBe('/constitucion/propuestas');
  });
});
