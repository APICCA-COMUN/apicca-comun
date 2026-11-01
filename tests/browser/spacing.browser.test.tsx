// RF-16 (003) · 16.1 · Aire entre secciones en Chromium real: en `/` la separación entre las secciones y en
// `/prototipado` el espacio bajo el lote salen de la escala de `lots.css` (`--section-gap`, de 64 a 140 px), a 360 y
// 1280 px. D-T19 (003).
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

const WIDTHS = [360, 1280];

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

/** Monta la aplicación en la ruta y la deja con el estado inicial de la siembra parcial. */
async function open(path: string) {
  history.replaceState(null, '', path);
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
  await page.viewport(1280, 800);
});

const MIN = 64;
const MAX = 140;

/** Un píxel de tolerancia por el redondeo del diseño. */
function expectInScale(value: number) {
  expect(value).toBeGreaterThanOrEqual(MIN - 1);
  expect(value).toBeLessThanOrEqual(MAX + 1);
}

describe.each(WIDTHS)('aire entre secciones a %i px', (width) => {
  it(`RF-16 (003) · 16.1: la escala --section-gap queda entre 64 y 140 px a ${width} px`, async () => {
    await page.viewport(width, 800);
    await open('/');
    const probe = document.createElement('div');
    probe.style.height = 'var(--section-gap)';
    host!.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    expectInScale(height);
    // A 360 px la escala está en su mínimo y a 1280 px en la parte alta, sin salir del rango.
    if (width === 360) expect(Math.abs(height - MIN)).toBeLessThanOrEqual(1);
    if (width === 1280) expect(height).toBeGreaterThan(MIN + 20);
  });

  it(`RF-16 (003) · 16.1: en / la separación entre dos secciones va de 64 a 140 px a ${width} px`, async () => {
    await page.viewport(width, 800);
    await open('/');
    const sections = await waitFor(() => {
      const found = [...host!.querySelectorAll<HTMLElement>('main > .home__section')];
      return found.length >= 2 && found;
    });
    for (let index = 1; index < sections.length; index += 1) {
      const gap = sections[index]!.getBoundingClientRect().top - sections[index - 1]!.getBoundingClientRect().bottom;
      expectInScale(gap);
    }
  });

  it(`RF-16 (003) · 16.1: en /prototipado el contenido deja de 64 a 140 px de aire debajo a ${width} px`, async () => {
    await page.viewport(width, 800);
    await open('/prototipado');
    const lot = await waitFor(() => host!.querySelector<HTMLElement>('main > .prototyping'));
    expectInScale(parseFloat(getComputedStyle(lot).marginBlockEnd));
  });
});
