// RF-11 (021) · 11.2, 11.3, RF-14 (021) · 14.7, D-T22 (021) · En `/` (la página real, con la siembra parcial), con el sistema
// «E3 · Celda»: desde 900 px la columna de lectura va a la izquierda (margen + columna + hueco, sin borde) y el mapa ocupa el
// resto de la ventana bajo la cabecera, sin desplazamiento horizontal ni vertical (a 1100 y 1280 px). Por debajo de 900 px (360 px)
// el mapa va arriba, a todo el ancho y con al menos el 60 % del alto de la ventana, y la columna debajo; la página se desplaza solo
// en vertical. Con la ficha abierta el mapa no se encoge: la columna sigue a su izquierda (desde 900 px) o debajo (por debajo de 900 px).
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/piezas.css';
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

/** El ancho de la columna de lectura desde 900 px: el margen, la columna y el hueco de `Play.css` (con un píxel de redondeo). */
function columnWidth(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:calc(clamp(16px, 3.3vw, 48px) + clamp(300px, 30vw, 344px) + 24px)';
  host!.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/** Sin desplazamiento horizontal; el mapa nace bajo la cabecera del sitio (con un píxel de redondeo), pegado al borde derecho
    desde 900 px (la columna va a su izquierda) y al izquierdo en un teléfono. */
function expectUnderHeader(map: HTMLElement, wide: boolean) {
  const box = map.getBoundingClientRect();
  expect(box.width).toBeGreaterThan(0);
  if (wide) expect(Math.abs(box.right - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  else expect(Math.abs(box.left)).toBeLessThanOrEqual(1);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  const header = host!.querySelector<HTMLElement>('header')!;
  expect(Math.abs(box.top - header.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
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
  const wide = width >= 900;

  it(`RF-11 (021) · 11.2, 11.3: en / el mapa ${wide ? 'ocupa la ventana bajo la cabecera, junto al panel' : 'va arriba, con el 60 % del alto, y el panel debajo'} a ${width} px`, async () => {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/');
    await mount(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    );
    const map = await waitFor(() => host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
    expectUnderHeader(map, wide);
    const box = map.getBoundingClientRect();
    const panel = host!.querySelector<HTMLElement>('.play__panel')!.getBoundingClientRect();
    if (wide) {
      // La columna a la izquierda, sin borde, y el mapa a su derecha hasta el borde de la ventana.
      expect(Math.abs(box.left - columnWidth())).toBeLessThanOrEqual(1);
      expect(Math.abs(panel.left)).toBeLessThanOrEqual(1);
      // El mapa deja abajo la leyenda-control: el escenario (mapa y leyenda) es el que llega al pie de la ventana.
      const stage = host!.querySelector<HTMLElement>('.play__stage')!.getBoundingClientRect();
      const legend = host!.querySelector<HTMLElement>('.play__legend')!.getBoundingClientRect();
      expect(Math.abs(stage.bottom - innerHeight)).toBeLessThanOrEqual(1);
      expect(box.bottom).toBeLessThanOrEqual(legend.top + 1);
      expect(Math.abs(legend.bottom - innerHeight)).toBeLessThanOrEqual(1);
      expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(innerHeight);
      expect(Math.abs(panel.width - columnWidth())).toBeLessThanOrEqual(1);
      expect(Math.abs(panel.top - box.top)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(box.right - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(box.height).toBeGreaterThanOrEqual(innerHeight * 0.6);
      expect(panel.top).toBeGreaterThanOrEqual(box.bottom - 1);
      expect(Math.abs(panel.width - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  });

  it(`RF-14 (021) · 14.1, 14.7: con la ficha abierta el mapa no se encoge y el panel va ${wide ? 'a la derecha' : 'abajo'} a ${width} px`, async () => {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/');
    await mount(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    );
    const map = await waitFor(() => host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
    const before = map.getBoundingClientRect();
    const cell = await waitFor(() => map.querySelector<HTMLButtonElement>('button.game-map__apice'));
    await actNow(() => cell.click());
    await waitFor(() => host!.querySelector<HTMLElement>('aside.game-panel'));
    // La columna es `.play__panel`, sin borde; el panel de dentro va en ella.
    const panel = host!.querySelector<HTMLElement>('.play__panel')!;
    const after = map.getBoundingClientRect();
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    const box = panel.getBoundingClientRect();
    if (wide) {
      // Junto al mapa, pegada al borde izquierdo: la columna (margen + columna + hueco), y el mapa no cambia de lugar.
      expect(Math.abs(box.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.left - box.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - columnWidth())).toBeLessThanOrEqual(1);
      expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(1);
    } else {
      // Debajo del mapa, a todo el ancho; la página baja hasta él.
      expect(Math.abs(box.width - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(box.top).toBeGreaterThanOrEqual(after.bottom - 1);
    }
  });

  it(`QA #3, #6.1, #18.2, #18.3: a ${width} px el nombre del Ápice elegido y los rótulos caben en el lienzo, sin tapar controles ni leyenda, y los controles miden 44 px`, async () => {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/');
    await mount(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    );
    const map = await waitFor(() => host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
    const cell = await waitFor(() => map.querySelector<HTMLButtonElement>('button.game-map__apice'));
    await actNow(() => cell.click());
    const tag = await waitFor(() => cell.querySelector<HTMLElement>('.game-map__tag'));
    const canvas = map.getBoundingClientRect();
    const covers = [...map.querySelectorAll<HTMLElement>('.game-map__control, .game-map__legend')].map((node) => node.getBoundingClientRect());
    const inside = (box: DOMRect) => {
      expect(box.left, 'borde izquierdo').toBeGreaterThanOrEqual(canvas.left - 1);
      expect(box.right, 'borde derecho').toBeLessThanOrEqual(canvas.right + 1);
      expect(box.top, 'borde superior').toBeGreaterThanOrEqual(canvas.top - 1);
      expect(box.bottom, 'borde inferior').toBeLessThanOrEqual(canvas.bottom + 1);
      for (const cover of covers) {
        const apart = box.right <= cover.left + 1 || box.left >= cover.right - 1 || box.bottom <= cover.top + 1 || box.top >= cover.bottom - 1;
        expect(apart, 'bajo la leyenda o los controles').toBe(true);
      }
    };
    inside(tag.getBoundingClientRect());
    expect(getComputedStyle(tag).borderTopWidth).toBe('0px');
    for (const label of map.querySelectorAll<HTMLElement>('.game-map__label, button.game-map__path-label')) {
      const box = label.getBoundingClientRect();
      if (box.width > 0 && box.right > canvas.left && box.left < canvas.right && box.bottom > canvas.top && box.top < canvas.bottom) {
        expect(getComputedStyle(label).borderTopWidth, label.textContent ?? '').toBe('0px');
      }
    }
    for (const control of map.querySelectorAll<HTMLElement>('.game-map__control')) {
      const box = control.getBoundingClientRect();
      expect(Math.round(box.width)).toBe(44);
      expect(Math.round(box.height)).toBe(44);
    }
    // El foco del lienzo se dibuja hacia dentro: nunca fuera de su caja, que el escenario recorta.
    map.focus({ focusVisible: true } as FocusOptions);
    expect(map.matches(':focus-visible')).toBe(true);
    expect(parseFloat(getComputedStyle(map).outlineOffset)).toBeLessThan(0);
  });
});
