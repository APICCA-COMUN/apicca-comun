// Medidas de la spec 005 en Chromium real (RF-1 (005), RF-2 (005), RF-10 (005) y RF-11 (005)): columna de la página, piel
// de los lotes, documentación sin lote y tarjetas de la constitución, a 360 y 1280 px. El inicio (RF-4 (005)) y el lote de
// Prototipado (RF-6 (005) a RF-8 (005)) dieron paso al mapa (RF-11 (021)): sus medidas salieron con ellos.
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

/** Monta la aplicación en la ruta con el estado inicial de la siembra parcial. */
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
  document.documentElement.removeAttribute('data-theme');
  await page.viewport(1280, 800);
});

/** Caja del contenido de `main`, sin su relleno lateral. */
function contentBox(main: HTMLElement) {
  const box = main.getBoundingClientRect();
  const style = getComputedStyle(main);
  const left = box.left + parseFloat(style.paddingLeft);
  const right = box.right - parseFloat(style.paddingRight);
  return { left, right, width: right - left };
}

describe('columna de la página', () => {
  it('RF-1 (005) · 1.1, 1.2: a 1280 px el contenido mide 1200 px como máximo, centrado, con 16 a 48 px a cada lado', async () => {
    await page.viewport(1280, 800);
    await open('/foro');
    const main = await waitFor(() => host!.querySelector<HTMLElement>('main'));
    const content = contentBox(main);
    expect(content.width).toBeLessThanOrEqual(1200.5);
    const leftGap = content.left;
    const rightGap = document.documentElement.clientWidth - content.right;
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
    expect(leftGap).toBeGreaterThanOrEqual(16 - 0.5);
    expect(leftGap).toBeLessThanOrEqual(48.5);
  });

  it('RF-1 (005) · 1.2: a 360 px el margen a cada lado es de 16 px y no hay desplazamiento horizontal', async () => {
    await page.viewport(360, 800);
    await open('/foro');
    const main = await waitFor(() => host!.querySelector<HTMLElement>('main'));
    const content = contentBox(main);
    expect(Math.abs(content.left - 16)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(document.documentElement.clientWidth - content.right - 16)).toBeLessThanOrEqual(0.5);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });
});

describe.each(['light', 'dark'] as const)('lotes en tema %s', (theme) => {
  it(`RF-2 (005) · 2.1: el lote tiene fondo surface, un filete de tinta arriba y ningún borde en los otros lados, radio 0 y ninguna sombra (${theme})`, async () => {
    document.documentElement.setAttribute('data-theme', theme);
    await open('/entrar');
    const lot = await waitFor(() => host!.querySelector<HTMLElement>('main .lot'));
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--surface)';
    probe.style.borderColor = 'var(--text)';
    host!.append(probe);
    const expected = getComputedStyle(probe);
    const style = getComputedStyle(lot);
    expect(style.backgroundColor).toBe(expected.backgroundColor);
    expect(style.borderTopColor).toBe(expected.borderTopColor);
    probe.remove();
    expect(['1px', '1.5px']).toContain(style.borderTopWidth);
    for (const side of ['borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const) expect(style[side], side).toBe('0px');
    expect(style.borderTopLeftRadius).toBe('0px');
    expect(style.boxShadow).toBe('none');
  });
});

/** Color calculado de una expresión CSS, p. ej. `var(--surface)`. */
function resolved(property: 'color' | 'backgroundColor', value: string): string {
  const probe = document.createElement('div');
  probe.style[property] = value;
  host!.append(probe);
  const out = getComputedStyle(probe)[property];
  probe.remove();
  return out;
}

describe('documentación y constitución', () => {
  it('RF-10 (005) · 10.1: el artículo de la documentación va sobre el fondo, sin lote ni recuadro', async () => {
    await open('/documentacion');
    const article = await waitFor(() => host!.querySelector<HTMLElement>('.documentation__article h1')?.closest('article'));
    expect(article.closest('.lot')).toBeNull();
    const wrapper = article.closest<HTMLElement>('.documentation')!;
    expect(getComputedStyle(wrapper).borderTopWidth).toBe('0px');
    expect(getComputedStyle(wrapper).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('RF-11 (005) · 11.1, 11.2: las secciones son filas con un filete arriba, sin caja ni sombra, y su número va en tinta', async () => {
    await open('/constitucion');
    const cards = await waitFor(() => {
      const found = [...host!.querySelectorAll<HTMLElement>('article.section-block')];
      return found.length >= 3 && found;
    });
    expect(cards[0]!.closest('.lot')).toBeNull();
    cards.slice(0, 3).forEach((card, index) => {
      const style = getComputedStyle(card);
      expect(style.boxShadow).toBe('none');
      expect(['1px', '1.5px']).toContain(style.borderTopWidth);
      for (const side of ['borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const) expect(style[side], side).toBe('0px');
      expect(style.borderTopLeftRadius).toBe('0px');
      const number = card.querySelector<HTMLElement>('.section-block__number')!;
      expect(number.textContent).toBe(String(index + 1));
      // RF-15 (019) · 15.2, D-T9 (019): el número va en `text`, sin color de eje.
      expect(getComputedStyle(number).color).toBe(resolved('color', 'var(--text)'));
      expect(parseFloat(getComputedStyle(number).fontSize)).toBeGreaterThanOrEqual(32);
    });
  });
});
