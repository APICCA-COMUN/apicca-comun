// Deuda de la vista en vivo (spec 020), medida en Chromium sobre la siembra completa (D-T7 (020)):
// - RF-1 (020) · 1.1, D-T1 (020): cada nodo se ve entero, por encima de sus caminos. A 6 px del centro, hacia los
//   cuatro lados, el punto cae en el nodo.
// - RF-1 (020) · 1.2, D-T2 (020): los tres nodos de la fila de pasos del Inicio quedan a la misma altura.
// - RF-2 (020) · 2.1, D-T3 (020): el zoom del selector de ubicación mide 44 × 44 px como mínimo.
// - RF-3 (020) · 3.1, D-T4 (020): cada ruta del recorrido tiene un solo `main`.
// - RF-4 (020) · 4.1, D-1 (020), D-T6 (020): ningún texto ni campo comparte la fila de un envío. Lo que va antes en el
//   DOM termina arriba y lo que va después empieza debajo.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, commands, page } from 'vitest/browser';
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
import PointPickerMap from '../../src/map/PointPickerMap';
import { signInAs, signOutNow } from './session';
import { lotColumns, lotLayout, lotTrail } from '../../shared/domain/lotLayout';
import { APICE_IDS, AUTHOR, CONSTITUTION_IDS, FACILITATOR } from './seed-data';

type Account = typeof AUTHOR | typeof FACILITATOR;

/** El recorrido de D-T7 (020). `form`: la ruta muestra al menos un formulario sin pulsar nada. */
const ROUTES: { path: string; as?: Account; form?: true }[] = [
  { path: '/' },
  { path: '/prototipado' },
  { path: '/entrar', form: true },
  { path: '/olvide', form: true },
  { path: '/registro' },
  { path: '/registro/token-de-prueba' },
  { path: '/solicitar', form: true },
  { path: '/ruta-que-no-existe' },
  { path: '/tablero', as: AUTHOR },
  { path: `/apices/${APICE_IDS.withImage}/editar`, as: AUTHOR, form: true },
  { path: '/facilitacion/invitaciones', as: FACILITATOR, form: true },
];

/** Los nodos que pide el trazado de cada lote montado: el zigzag (`lotTrail`) o la retícula (`lotLayout`), según su ancho. */
function lotNodes(): number {
  return [...host!.querySelectorAll<HTMLElement>('.apice-lot')].reduce((total, lot) => {
    const buildings = lot.querySelectorAll('.apice-lot__building').length;
    const shape = lot.classList.contains('apice-lot--trail') ? lotTrail(buildings) : lotLayout(buildings, lotColumns(lot.clientWidth));
    return total + shape.nodes.length;
  }, 0);
}

/**
 * Las rutas con nodos: los pasos y el mapa ilustrado del Inicio, el lote de Prototipado y la Constitución.
 * `ready`: textos que la página pinta solo cuando ya leyó sus datos, como en `pages.browser.test.tsx`.
 * `nodes`: dónde están los nodos de la ruta, y `count`, cuántos debe haber (QA-1 de la implementación): si faltara
 * alguno, la medida de RF-1 (020) · 1.1 no lo vería.
 */
const NODE_ROUTES: { path: string; ready?: string[]; nodes: string; count: () => number }[] = [
  // Tres pasos y los cinco nodos del mapa ilustrado (`NODES`, `src/components/MapIllustration.tsx:45-51`).
  { path: '/', nodes: '.home__step [data-testid="node"], .map-illustration [data-testid="node"]', count: () => 3 + 5 },
  { path: '/prototipado', nodes: '.apice-lot [data-testid="node"]', count: lotNodes },
  // Un nodo por sección de la constitución sembrada (RF-11 (008) · 11.5).
  { path: '/constitucion', ready: ['Agua compartida', 'Escuchar primero'], nodes: '.constitution__node [data-testid="node"]', count: () => Object.keys(CONSTITUTION_IDS.sections).length },
];

/** Los nodos del lote y sus caminos no reciben el puntero; solo para medir, esta hoja se lo devuelve. */
const HIT_TESTING = `
.apice-lot__node, .apice-lot__node *, .apice-lot__roads, .apice-lot__roads * { pointer-events: auto !important; }
`;

let signedInAs: string | null = null;
let host: HTMLDivElement | undefined;
let root: Root | undefined;
let sheet: HTMLStyleElement | undefined;
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
  for (let attempt = 0; attempt * 50 <= timeoutMs; attempt += 1) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('waitFor: se agotó la espera.');
}

/** Cambia de cuenta solo si hace falta; `undefined` cierra la sesión. */
async function useAccount(account: Account | undefined) {
  const wanted = account?.uid ?? null;
  if (wanted === signedInAs) return;
  if (signedInAs !== null) await signOutNow();
  if (account !== undefined) await signInAs(account);
  signedInAs = wanted;
  await new Promise((done) => setTimeout(done, 300));
}

/** Monta la ruta y espera a que quede quieta: sin «Cargando», con las imágenes y la fuente. */
async function show(path: string, ready: readonly string[] = []) {
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  for (const text of ready) await waitFor(() => host!.textContent!.includes(text));
  await waitFor(() => !host!.textContent!.includes('Cargando') && host!.querySelector('main h1, main h2'));
  await waitFor(() => [...host!.querySelectorAll('img')].every((img) => img.complete));
  await document.fonts.ready;
  await waitFor(() => document.getAnimations().length === 0);
  await new Promise((done) => setTimeout(done, 100));
}

async function at(width: number) {
  await page.viewport(width, 800);
  await new Promise((done) => setTimeout(done, 100));
}

function hasBox(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/** Dónde está un nodo, para el mensaje del fallo. */
function place(node: Element): string {
  const owner = node.closest('.home__step, .map-illustration, .apice-lot, .constitution__item');
  return owner?.classList[0] ?? node.parentElement?.className ?? '?';
}

function describeHit(hit: Element | null): string {
  if (hit === null) return 'nada';
  const name = typeof hit.className === 'string' ? hit.className : hit.getAttribute('class');
  return `${hit.tagName.toLowerCase()}${name ? `.${name.split(' ').join('.')}` : ''}`;
}

/** Los puntos a 6 px del centro de cada nodo, hacia los cuatro lados, que no caen en el nodo. */
function coveredNodes(): string[] {
  const failures: string[] = [];
  const nodes = [...host!.querySelectorAll<HTMLElement>('[data-testid="node"]')].filter(hasBox);
  nodes.forEach((node, index) => {
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
    const box = node.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    for (const [dx, dy, side] of [[6, 0, 'derecha'], [-6, 0, 'izquierda'], [0, 6, 'abajo'], [0, -6, 'arriba']] as const) {
      const hit = document.elementFromPoint(cx + dx, cy + dy);
      if (hit !== node) failures.push(`nodo ${index + 1} (${place(node)}), ${side}: ${describeHit(hit)}`);
    }
  });
  scrollTo(0, 0);
  return failures;
}

const SUBMITS = 'button[type="submit"], button:not([type]), input[type="submit"]';
const ROW_ITEMS = 'label, input, select, textarea, p, fieldset, legend';

/** Los textos y campos que comparten la franja vertical de un envío del formulario (D-T6 (020)). */
function sharedRows(form: HTMLFormElement): string[] {
  const failures: string[] = [];
  const items = [...form.querySelectorAll<HTMLElement>(ROW_ITEMS)].filter(
    (item) => hasBox(item) && item.closest('[aria-hidden="true"]') === null && !item.matches('input[type="submit"]'),
  );
  for (const submit of [...form.querySelectorAll<HTMLElement>(SUBMITS)].filter(hasBox)) {
    const row = submit.getBoundingClientRect();
    for (const item of items) {
      if (item.contains(submit)) continue;
      const box = item.getBoundingClientRect();
      const before = (item.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const overlaps = before ? box.bottom > row.top + 0.5 : box.top < row.bottom - 0.5;
      if (overlaps) {
        const text = (item.textContent ?? '').trim().slice(0, 40);
        failures.push(`«${submit.textContent?.trim()}» comparte fila con ${item.tagName.toLowerCase()} ${before ? 'anterior' : 'posterior'} «${text}» (${Math.round(box.top)}–${Math.round(box.bottom)} frente a ${Math.round(row.top)}–${Math.round(row.bottom)})`);
      }
    }
  }
  return failures;
}

beforeAll(async () => {
  // Sin transiciones: las medidas no dependen de cuándo termina una animación.
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await commands.seedFull();
  previousPath = location.pathname + location.search;
  history.replaceState(null, '', '/');
  sheet = document.createElement('style');
  sheet.textContent = HIT_TESTING;
  document.head.append(sheet);
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
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  sheet?.remove();
  scrollTo(0, 0);
  history.replaceState(null, '', previousPath);
  await page.viewport(1280, 800);
});

describe('RF-1 (020) · nodos legibles', () => {
  describe.each([360, 1100, 1280])('a %i px', (width) => {
    it.each(NODE_ROUTES)('RF-1 (020) · 1.1: en $path cada nodo se ve entero, por encima de sus caminos', async ({ path, ready, nodes, count }) => {
      await at(width);
      await useAccount(undefined);
      await show(path, ready);
      const shown = () => [...host!.querySelectorAll(nodes)].filter(hasBox).length;
      // El lote llega con los datos y se acomoda a su ancho: se espera a que pinte los nodos que pide.
      await waitFor(() => count() > 0 && shown() === count()).catch(() => undefined);
      await waitFor(() => document.getAnimations().length === 0);
      expect(count()).toBeGreaterThan(0);
      expect(shown()).toBe(count());
      expect(coveredNodes()).toEqual([]);
    });
  });

  it.each([900, 1000, 1100, 1200, 1280, 1440])('RF-1 (020) · 1.2: a %i px los nodos de los pasos quedan a la misma altura', async (width) => {
    await at(width);
    await useAccount(undefined);
    await show('/');
    const tops = [...host!.querySelectorAll('.home__step [data-testid="node"]')].map((node) => node.getBoundingClientRect().top);
    expect(tops).toHaveLength(3);
    for (const top of tops) expect(Math.abs(top - tops[0]!)).toBeLessThanOrEqual(0.5);
  });
});

describe('RF-2 (020) · zoom del selector de ubicación', () => {
  let picker: HTMLDivElement | undefined;
  let pickerRoot: Root | undefined;

  afterEach(async () => {
    const mounted = pickerRoot;
    if (mounted !== undefined) await actNow(() => mounted.unmount());
    picker?.remove();
    picker = undefined;
    pickerRoot = undefined;
  });

  it('RF-2 (020) · 2.1, D-T3 (020): acercar y alejar del selector miden al menos 44 × 44 px', async () => {
    await at(1280);
    picker = document.createElement('div');
    picker.style.width = '640px';
    document.body.append(picker);
    const created = createRoot(picker);
    pickerRoot = created;
    await actNow(() => created.render(<PointPickerMap point={null} onPick={() => undefined} />));
    const controls = await waitFor(() => {
      const found = [...picker!.querySelectorAll<HTMLElement>('.leaflet-control-zoom-in, .leaflet-control-zoom-out')];
      return found.length === 2 ? found : null;
    });
    for (const control of controls) {
      const box = control.getBoundingClientRect();
      expect(box.width, control.className).toBeGreaterThanOrEqual(44);
      expect(box.height, control.className).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('RF-3 (020) y RF-4 (020) · recorrido', () => {
  describe.each([360, 1280])('a %i px', (width) => {
    it.each(ROUTES)('RF-3 (020) · 3.1: $path tiene un solo main', async ({ path, as }) => {
      await at(width);
      await useAccount(as);
      await show(path);
      expect(location.pathname).toBe(path);
      expect(host!.querySelectorAll('main')).toHaveLength(1);
    });
  });

  const FORM_CASES = [
    ...ROUTES.filter((route) => route.form).flatMap((route) => [360, 1280].map((width) => ({ ...route, width }))),
    { path: '/solicitar', width: 1100 },
  ];

  it.each(FORM_CASES)('RF-4 (020) · 4.1, D-1 (020): en $path a $width px el envío ocupa su propia fila', async ({ path, as, width }) => {
    await at(width);
    await useAccount(as);
    await show(path);
    const forms = [...host!.querySelectorAll<HTMLFormElement>('form')].filter(hasBox);
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) expect(form.querySelectorAll(SUBMITS).length).toBeGreaterThan(0);
    expect(forms.flatMap(sharedRows)).toEqual([]);
  });
});
