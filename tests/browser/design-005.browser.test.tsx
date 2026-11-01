// Medidas de la spec 005 en Chromium real (RF-1 (005), RF-2 (005), RF-4 (005), RF-10 (005) y RF-11 (005)): columna de la página, piel de los
// lotes, encabezado y pasos del inicio, documentación sin lote y tarjetas de la constitución, a 360 y 1280 px.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
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
    await open('/prototipado');
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
    await open('/prototipado');
    const main = await waitFor(() => host!.querySelector<HTMLElement>('main'));
    const content = contentBox(main);
    expect(Math.abs(content.left - 16)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(document.documentElement.clientWidth - content.right - 16)).toBeLessThanOrEqual(0.5);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });
});

describe.each(['light', 'dark'] as const)('lotes en tema %s', (theme) => {
  it(`RF-2 (005) · 2.1: el lote tiene fondo surface, borde line de 1 px, radio de 18 px y ninguna sombra (${theme})`, async () => {
    document.documentElement.setAttribute('data-theme', theme);
    await open('/entrar');
    const lot = await waitFor(() => host!.querySelector<HTMLElement>('main .lot'));
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--surface)';
    probe.style.borderColor = 'var(--line)';
    host!.append(probe);
    const expected = getComputedStyle(probe);
    const style = getComputedStyle(lot);
    expect(style.backgroundColor).toBe(expected.backgroundColor);
    expect(style.borderTopColor).toBe(expected.borderTopColor);
    probe.remove();
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderTopLeftRadius).toBe('18px');
    expect(style.boxShadow).toBe('none');
  });
});

describe('inicio', () => {
  it('RF-4 (005) · 4.1, 4.2: a 1280 px el texto y el mapa cuadrado van en dos columnas', async () => {
    await page.viewport(1280, 800);
    await open('/');
    const map = await waitFor(() => host!.querySelector<HTMLElement>('.map-illustration'));
    const text = host!.querySelector<HTMLElement>('.home__hero-text')!;
    const mapBox = map.getBoundingClientRect();
    expect(mapBox.left).toBeGreaterThanOrEqual(text.getBoundingClientRect().right - 0.5);
    expect(Math.abs(mapBox.width - mapBox.height)).toBeLessThanOrEqual(1);
    expect(mapBox.width).toBeGreaterThan(200);
  });

  it('RF-4 (005) · 4.1: a 360 px el mapa va debajo del texto, sin desbordar', async () => {
    await page.viewport(360, 800);
    await open('/');
    const map = await waitFor(() => host!.querySelector<HTMLElement>('.map-illustration'));
    const text = host!.querySelector<HTMLElement>('.home__hero-text')!;
    expect(map.getBoundingClientRect().top).toBeGreaterThanOrEqual(text.getBoundingClientRect().bottom - 0.5);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  it('RF-4 (005) · 4.3: las hebras se pintan al 55 % de opacidad', async () => {
    await open('/');
    const strands = await waitFor(() => {
      const found = [...host!.querySelectorAll<SVGPathElement>('.map-illustration__strand')];
      return found.length === 2 && found;
    });
    for (const strand of strands) expect(getComputedStyle(strand).strokeOpacity).toBe('0.55');
  });

  it('RF-4 (005) · 4.4: a 1280 px los pasos van en una fila y a 360 px en una columna', async () => {
    for (const [width, row] of [[1280, true], [360, false]] as const) {
      await page.viewport(width, 800);
      await open('/');
      const steps = await waitFor(() => {
        const found = [...host!.querySelectorAll<HTMLElement>('.home__step')];
        return found.length === 3 && found;
      });
      const tops = steps.map((step) => step.getBoundingClientRect().top);
      if (row) expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
      else expect(tops[1]! > tops[0]! && tops[2]! > tops[1]!).toBe(true);
      const mounted = root!;
      await actNow(() => mounted.unmount());
      host!.remove();
      root = undefined;
    }
  });

  it('RF-4 (005) · 4.5: el cierre del inicio va centrado', async () => {
    await open('/');
    const closing = await waitFor(() => host!.querySelector<HTMLElement>('.home__closing'));
    expect(getComputedStyle(closing).textAlign).toBe('center');
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

  it('RF-11 (005) · 11.1, 11.2: las secciones son tarjetas surface con sombra y número del color cíclico de los ejes', async () => {
    await open('/constitucion');
    const cards = await waitFor(() => {
      const found = [...host!.querySelectorAll<HTMLElement>('article.section-block')];
      return found.length >= 3 && found;
    });
    expect(cards[0]!.closest('.lot')).toBeNull();
    const keys = ['agua', 'alimento', 'cobijo'];
    cards.slice(0, 3).forEach((card, index) => {
      const style = getComputedStyle(card);
      expect(style.backgroundColor).toBe(resolved('backgroundColor', 'var(--surface)'));
      expect(style.boxShadow).not.toBe('none');
      const number = card.querySelector<HTMLElement>('.section-block__number')!;
      expect(number.textContent).toBe(String(index + 1));
      expect(getComputedStyle(number).color).toBe(resolved('color', `var(--axis-${keys[index]}-stroke)`));
      expect(parseFloat(getComputedStyle(number).fontSize)).toBeGreaterThanOrEqual(32);
    });
  });
});

describe('Prototipado de escritorio', () => {
  // Con un solo ápice el recorrido no dibuja caminos ni nodos: se necesita la siembra completa.
  beforeAll(async () => {
    await commands.seedFull();
  });

  it('RF-7 (005) · 7.12, RF-8 (005) · 8.5: a 1280 px el panel mide 320 px o más, a la derecha del lote, separado 32 px', async () => {
    await page.viewport(1280, 800);
    await open('/prototipado');
    const panel = await waitFor(() => host!.querySelector<HTMLElement>('aside[aria-label="Ápice elegido"]'));
    const stage = host!.querySelector<HTMLElement>('.apice-lot-section__stage')!;
    const panelBox = panel.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    expect(panelBox.width).toBeGreaterThanOrEqual(319.5);
    expect(panelBox.left).toBeGreaterThanOrEqual(stageBox.right + 31.5);
    expect(Math.abs(panelBox.left - stageBox.right - 32)).toBeLessThanOrEqual(1);
    expect(stageBox.height).toBeGreaterThanOrEqual(559.5);
    expect(getComputedStyle(panel).borderTopLeftRadius).toBe('14px');
    expect(getComputedStyle(panel).backgroundColor).toBe(resolved('backgroundColor', 'var(--surface)'));
  });

  it('RF-6 (005) · 6.10, 6.11: a 1280 px el lote va en zigzag, con caminos de 14 px en surface, nodos de 18 px y el elegido con anillo doble', async () => {
    await page.viewport(1280, 800);
    await open('/prototipado');
    const lot = await waitFor(() => host!.querySelector<HTMLElement>('.apice-lot--trail'));
    const road = lot.querySelector('.apice-lot__roads line');
    expect(road).not.toBeNull();
    const roadStyle = getComputedStyle(road!);
    expect(roadStyle.strokeWidth).toBe('14px');
    expect(roadStyle.stroke).toBe(resolved('color', 'var(--surface)'));
    const node = lot.querySelector<HTMLElement>('.node')!;
    expect(node).not.toBeNull();
    expect(node.getBoundingClientRect().width).toBeCloseTo(18, 0);
    expect(getComputedStyle(node).borderTopWidth).toBe('4px');
    const chosen = lot.querySelector<HTMLElement>('.apice-lot__building[aria-pressed="true"]')!;
    expect(chosen).not.toBeNull();
    const chosenStyle = getComputedStyle(chosen);
    expect(chosenStyle.position).toBe('absolute');
    expect(chosenStyle.borderTopLeftRadius).toBe('10px');
    // Anillo doble (fondo y foco) más la sombra elevada: tres sombras.
    expect(chosenStyle.boxShadow.split(/,\s*(?=rgb)/)).toHaveLength(3);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  it('RF-8 (005) · 8.3: el contador va a la derecha del título', async () => {
    await page.viewport(1280, 800);
    await open('/prototipado');
    const status = await waitFor(() => host!.querySelector<HTMLElement>('.prototyping__head [role="status"]'));
    const heading = host!.querySelector<HTMLElement>('.prototyping__head h1')!;
    expect(status.getBoundingClientRect().left).toBeGreaterThan(heading.getBoundingClientRect().right);
  });
});

