// La siembra fija contra los emuladores (T-4.13, D-T13 (002)): la página de inicio, montada con
// `<App>` en el marco y con la ruta puesta con `history`, muestra el ápice de nombre largo con la
// fecha fija de la siembra (RNF-5 (002)).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { LONG_NAME, LONG_USERNAME } from './seed-data';

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

/** Espera a que `find` devuelva algo; los datos llegan del emulador, fuera de React. */
async function waitFor<T>(find: () => T | null | undefined, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== null && found !== undefined) return found;
    if (Date.now() > until) throw new Error('waitFor: se agotó la espera.');
    await new Promise((done) => setTimeout(done, 50));
  }
}

beforeAll(async () => {
  await commands.seedPartial();
  previousPath = location.pathname + location.search;
  // La lista se mudó de / a /prototipado (RF-18 (003), D-19 (003)).
  history.replaceState(null, '', '/prototipado');
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
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  history.replaceState(null, '', previousPath);
});

it('RNF-5 (002): la siembra deja en /prototipado el ápice de nombre de 120 caracteres, con la fecha fija', async () => {
  expect([...LONG_NAME]).toHaveLength(120);
  expect(LONG_USERNAME).toHaveLength(24);
  const heading = await waitFor(() => [...host!.querySelectorAll('article h2, article h3')].find((el) => el.textContent === LONG_NAME));
  const card = heading.closest('article');
  expect(card).not.toBeNull();
  // 2026-10-08T12:00:00Z en America/Bogota, con `dateStyle: 'medium'` en es-CO.
  const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date('2026-10-08T12:00:00Z'));
  expect(card!.textContent).toContain(date);
});
