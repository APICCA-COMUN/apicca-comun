// RF-13 (003) · 13.1, RF-16 (003) · 16.3 · Lote de acceso en Chromium real: en cada una de las seis rutas de entrar y
// registro el lote mide 440 px como máximo, queda centrado y no hay desplazamiento horizontal, a 360 y 1280 px.
// Las rutas montan la aplicación sin sesión; el lote aparece desde el primer pintado (D-T19 (003)).
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

const ROUTES = ['/entrar', '/olvide', '/accion?mode=resetPassword&oobCode=x', '/registro', '/registro/token-de-prueba', '/solicitar'];

describe.each(WIDTHS)('lote de acceso a %i px', (width) => {
  it.each(ROUTES)(`RF-13 (003) · 13.1: %s mide 440 px como máximo y queda centrado a ${width} px`, async (path) => {
    await page.viewport(width, 800);
    await open(path);
    const lot = await waitFor(() => host!.querySelector<HTMLElement>('main .lot.lot--access'));
    expect(host!.querySelectorAll('main .lot')).toHaveLength(1);
    const box = lot.getBoundingClientRect();
    const view = document.documentElement.clientWidth;
    expect(box.width).toBeLessThanOrEqual(440 + 0.5);
    // Con 360 px el lote llena el ancho disponible; con 1280 px sobra espacio y se reparte a los dos lados.
    expect(Math.abs(box.left - (view - box.right))).toBeLessThanOrEqual(1);
    if (width >= 480) expect(box.width).toBeGreaterThan(400);
  });

  it.each(ROUTES)(`RF-16 (003) · 16.3: %s no se desplaza en horizontal a ${width} px`, async (path) => {
    await page.viewport(width, 800);
    await open(path);
    await waitFor(() => host!.querySelector('main .lot.lot--access'));
    const doc = document.documentElement;
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
  });
});

/** Las rutas de acceso que siempre muestran un formulario sin sesión. */
const FORM_ROUTES = ['/entrar', '/olvide', '/solicitar'];

/** El rectángulo del texto propio de una etiqueta, sin el campo que envuelve. */
function labelTextBox(label: HTMLLabelElement): DOMRect | null {
  const range = document.createRange();
  const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
  let first: Text | null = null;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.parentElement?.closest('input, select, textarea') || node.textContent!.trim() === '') continue;
    first = node as Text;
    break;
  }
  if (first === null) return null;
  range.selectNodeContents(first);
  return range.getBoundingClientRect();
}

describe.each(WIDTHS)('campos de acceso a %i px', (width) => {
  it.each(FORM_ROUTES)(`RF-5 (003) · 5.2: en %s cada campo tiene su etiqueta visible encima a ${width} px`, async (path) => {
    await page.viewport(width, 800);
    await open(path);
    const lot = await waitFor(() => host!.querySelector<HTMLElement>('main .lot.lot--access form'));
    // El campo trampa de `/solicitar` está fuera de la vista y del orden de tabulación: no es un campo para personas.
    const controls = [
      ...lot.querySelectorAll<HTMLElement>('input:not([type="checkbox"], [type="radio"], [type="hidden"]), select, textarea'),
    ].filter((control) => control.tabIndex >= 0);
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const label = (control as HTMLInputElement).labels?.[0];
      expect(label, control.outerHTML.slice(0, 80)).toBeDefined();
      const text = labelTextBox(label!);
      expect(text, label!.outerHTML.slice(0, 80)).not.toBeNull();
      const box = control.getBoundingClientRect();
      expect(text!.bottom, label!.textContent!).toBeLessThanOrEqual(box.top + 0.5);
      expect(text!.left, label!.textContent!).toBeLessThanOrEqual(box.left + 0.5);
    }
    // El envío va debajo del último campo, no a su lado.
    const submit = lot.querySelector<HTMLElement>('button[type="submit"]')!;
    const last = controls.at(-1)!.getBoundingClientRect();
    expect(submit.getBoundingClientRect().top).toBeGreaterThanOrEqual(last.bottom - 0.5);
  });
});
