// RF-11 (021) · 11.2, 11.3, RF-14 (021) · 14.7, D-T22 (021) · En `/` (la página real, con la siembra parcial) el mapa
// ocupa toda la ventana bajo la barra de juego, a 360, 1100 y 1280 px, sin desplazamiento horizontal ni vertical. Con un
// panel abierto, por debajo de 900 px el panel sube desde abajo y desde 900 px va a la derecha; el mapa no se encoge.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';

const WIDTHS = [360, 1100, 1280];

let host: HTMLDivElement | undefined;
let root: Root | undefined;
let previousPath = '';

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

async function mount(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() => created.render(node));
}

/** El mapa llena la ventana a lo ancho y hasta abajo, sin desplazamiento (con un píxel de redondeo). */
function expectFullWindow(map: HTMLElement) {
  const box = map.getBoundingClientRect();
  expect(box.width).toBeGreaterThan(0);
  expect(Math.abs(box.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.right - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.bottom - innerHeight)).toBeLessThanOrEqual(1);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(innerHeight);
}

beforeAll(async () => {
  await commands.seedPartial();
  previousPath = location.pathname + location.search;
});

afterEach(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  history.replaceState(null, '', previousPath);
});

describe.each(WIDTHS)('mapa a %i px', (width) => {
  it(`RF-11 (021) · 11.2, 11.3: en / el mapa ocupa la ventana bajo la barra de juego a ${width} px`, async () => {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/');
    await mount(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    );
    const map = await waitFor(() => host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
    expectFullWindow(map);
    const hud = host!.querySelector<HTMLElement>('.play__hud')!;
    expect(Math.abs(map.getBoundingClientRect().top - hud.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
  });

  it(`RF-14 (021) · 14.1, 14.7: con la ficha abierta el mapa no se encoge y el panel va ${width < 900 ? 'abajo' : 'a la derecha'} a ${width} px`, async () => {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/');
    await mount(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    );
    const building = await waitFor(() => host!.querySelector<HTMLButtonElement>('section[aria-label="Mapa de ápices"] button[aria-pressed]'));
    await actNow(() => building.click());
    const panel = await waitFor(() => host!.querySelector<HTMLElement>('aside.game-panel'));
    const map = host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]')!;
    expectFullWindow(map);
    const box = panel.getBoundingClientRect();
    if (width < 900) {
      expect(Math.abs(box.bottom - innerHeight)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    } else {
      // A 12 px del borde derecho, como una tarjeta sobre el mapa (GamePanel.css).
      expect(Math.abs(document.documentElement.clientWidth - box.right - 12)).toBeLessThanOrEqual(1);
      expect(box.width).toBeLessThan(width / 2);
    }
  });
});
