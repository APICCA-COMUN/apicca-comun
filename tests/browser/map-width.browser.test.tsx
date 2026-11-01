// RF-12 (003) · 12.2 · El mapa ocupa todo el ancho del contenido de su lote, a 360 y a 1280 px: en `/prototipado` (la
// página real, con la siembra parcial) y dentro de un lote con la forma de la ficha (la ficha no trae mapa hoy;
// si lo trae, el lote es el mismo). El ancho del contenido es el del lote sin borde ni relleno.
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
import { ApiceMap } from '../../src/components/ApiceMap';
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

async function mount(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() => created.render(node));
}

/** El ancho del contenido de un lote: sin borde ni relleno. */
function contentWidth(lot: HTMLElement): number {
  const style = getComputedStyle(lot);
  return lot.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

/** El mapa mide el ancho del contenido de su lote (con la tolerancia de un píxel de redondeo). */
function expectFullWidth(map: HTMLElement, lot: HTMLElement) {
  expect(map.getBoundingClientRect().width).toBeGreaterThan(0);
  expect(Math.abs(map.getBoundingClientRect().width - contentWidth(lot))).toBeLessThanOrEqual(1);
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
  it(`RF-12 (003) · 12.2: en /prototipado el mapa mide el ancho del contenido del lote a ${width} px`, async () => {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/prototipado');
    await mount(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    );
    const map = await waitFor(() => host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
    await waitFor(() => map.querySelector('.leaflet-container'));
    const lot = map.closest<HTMLElement>('.prototyping')!;
    expect(lot).not.toBeNull();
    expectFullWidth(map, lot);
    expectFullWidth(map.querySelector<HTMLElement>('.leaflet-container')!, lot);
  });

  it(`RF-12 (003) · 12.2: en un lote como el de la ficha con ubicación el mapa mide el ancho del contenido a ${width} px`, async () => {
    await page.viewport(width, 800);
    await mount(
      <main>
        <article className="lot apice-view">
          <h2>Ápice con ubicación</h2>
          <ApiceMap apices={[{ id: 'a', name: 'Huerta', axes: ['agua'], location: { lat: 4.6, lng: -74.08, precision: 'exact' } }]} />
        </article>
      </main>,
    );
    const map = await waitFor(() => host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
    await waitFor(() => map.querySelector('.leaflet-container'));
    expectFullWidth(map, map.closest<HTMLElement>('.lot')!);
    expectFullWidth(map.querySelector<HTMLElement>('.leaflet-container')!, map.closest<HTMLElement>('.lot')!);
  });
});
