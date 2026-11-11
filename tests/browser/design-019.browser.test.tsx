// Fase 1 de la spec 019 («Sistema»), medida en Chromium sobre la siembra completa:
// - RF-2 (019) · 2.1, 2.3, D-T3 (019): todo texto visible usa un tamaño de la escala, y el h1 de cada página, `display`.
// - RF-3 (019) · 3.1, 3.2, D-T4 (019): acciones en píldora, bloques con `radius-block` y lotes con `radius-lot`.
// - RF-12 (019) · 12.1 a 12.4, D-T6 (019): el formulario del ápice.
// - RF-13 (019) · 13.1, 13.2, D-T7 (019): las filas y el enlace de Facilitación.
// - RF-15 (019) · 15.1, D-T9 (019): la inicial de la cuenta, sobre `charcoal`.
// - RF-18 (019) · 18.1, D-T12 (019): un solo h1 por página.
// - RF-20 (019) · 20.3, D-T13 (019): el aro de los nodos, en `node-ring`.
// - RF-22 (019) · 22.1, D-T15 (019): el pie, al fondo de la ventana.
// Fase 2 («Terreno»):
// - RF-4 (019) · 4.1 a 4.5, D-T19 (019), D-14 (019): el edificio crece por etapa y la ficha muestra aparte la imagen de una idea.
// - RF-9 (019) · 9.1, 9.3, D-T21 (019): el pin de necesidades, de 14 px y sin cifras.
// - RF-11 (019) · 11.1 a 11.4, D-T23 (019): la ficha como taller.
// - RF-19 (019) · 19.5, D-T22 (019): el terreno de partida en la primera pantalla a 360 px.
// - RNF-5 (019): el edificio no anima con movimiento reducido.
// El lote de Prototipado (RF-8 (019)), la franja y el panel al lado (RF-7 (019)) y los ejes del Inicio (RF-23 (019))
// dieron paso al mapa (RF-11 (021) a RF-14 (021)): sus medidas están en map.browser y map-width.browser.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cdp, commands, page, userEvent } from 'vitest/browser';
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
import { THEMES, TOKENS, TYPE_SCALE, contrastRatio, hexToRgb } from '../../shared/domain/identity';
import { signInAs, signOutNow } from './session';
import { APICE_IDS, AUTHOR, FACILITATOR, INVITED_EMAIL } from './seed-data';

type Account = typeof AUTHOR | typeof FACILITATOR;

/** Las páginas del recorrido, con la cuenta que las abre. */
const ROUTES: { path: string; as?: Account }[] = [
  { path: '/' },
  { path: '/?vista=lista' },
  { path: '/documentacion' },
  { path: '/constitucion' },
  { path: '/foro' },
  { path: '/entrar' },
  { path: '/solicitar' },
  { path: '/ruta-que-no-existe' },
  { path: `/apices/${APICE_IDS.withImage}` },
  { path: '/?mio=1', as: AUTHOR },
  { path: '/apices/nuevo', as: AUTHOR },
  { path: `/apices/${APICE_IDS.withImage}/editar`, as: AUTHOR },
  { path: `/apices/${APICE_IDS.withImage}/historial`, as: AUTHOR },
  { path: '/archivados', as: AUTHOR },
  { path: '/constitucion/propuestas', as: AUTHOR },
  { path: '/facilitacion/invitaciones', as: FACILITATOR },
  { path: '/facilitacion/solicitudes', as: FACILITATOR },
  { path: '/facilitacion/cuentas', as: FACILITATOR },
];

let signedInAs: string | null = null;
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

/** Monta la ruta y espera a que quede quieta: sin «Cargando», con un título, las imágenes y la fuente. */
async function show(path: string, as?: Account, ready: readonly string[] = []) {
  await useAccount(as);
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  for (const text of ready) await waitFor(() => host!.textContent!.includes(text));
  await waitFor(() => !host!.textContent!.includes('Cargando') && host!.querySelector('main h1, main h2'));
  await waitFor(() => [...host!.querySelectorAll('img')].every((img) => img.complete));
  await document.fonts.ready;
  await waitFor(() => document.getAnimations().length === 0);
  await new Promise((done) => setTimeout(done, 100));
}

async function at(width: number, height = 800) {
  await page.viewport(width, height);
  await new Promise((done) => setTimeout(done, 100));
}

function visible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function name(element: Element): string {
  const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const className = typeof element.className === 'string' && element.className ? `.${element.className.split(' ').join('.')}` : '';
  return `${element.tagName.toLowerCase()}${className} «${text}»`;
}

/** El valor calculado de una variable de longitud, medido sobre un elemento de prueba. */
function measure(property: 'fontSize' | 'borderTopLeftRadius', value: string): string {
  const probe = document.createElement('div');
  probe.style[property] = value;
  document.body.append(probe);
  const computed = getComputedStyle(probe)[property];
  probe.remove();
  return computed;
}

/** Los tamaños de la escala en píxeles, al ancho actual de la ventana. */
function scaleSizes(): Map<string, string> {
  return new Map(Object.keys(TYPE_SCALE).map((token) => [measure('fontSize', `var(--type-${token}-size)`), token]));
}

/** Los elementos visibles con texto propio, más los campos y botones, fuera de los mapas de Leaflet y de los SVG. */
function textElements(): HTMLElement[] {
  return [...host!.querySelectorAll<HTMLElement>('*')].filter((element) => {
    if (element.closest('.leaflet-container, svg') !== null || !visible(element)) return false;
    if (element.matches('input:not([type="checkbox"], [type="radio"], [type="hidden"]), select, textarea, button')) return true;
    return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '');
  });
}

const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;
const px = (value: string) => Number.parseFloat(value);
const corners = (element: Element) => {
  const style = getComputedStyle(element);
  return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius];
};

beforeAll(async () => {
  // Sin transiciones: las medidas no dependen de cuándo termina una animación.
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await commands.seedFull();
  previousPath = location.pathname + location.search;
  history.replaceState(null, '', '/');
  host = document.createElement('div');
  // Como en `index.html`: las reglas de `#root` (RF-22 (019), D-T15 (019)) se aplican al contenedor de la app.
  host.id = 'root';
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
  delete document.documentElement.dataset['theme'];
  scrollTo(0, 0);
  history.replaceState(null, '', previousPath);
  await page.viewport(1280, 800);
});

describe('RF-2 (019) · escala tipográfica', () => {
  describe.each([360, 1100, 1280])('a %i px', (width) => {
    it.each(ROUTES)('RF-2 (019) · 2.1, 2.3: en $path todo texto usa la escala y el h1 usa display', async ({ path, as }) => {
      await at(width);
      await show(path, as);
      // Algunas páginas (la Documentación en su primera visita) pintan el h1 después del primer título: se espera.
      await waitFor(() => host!.querySelector('h1')).catch(() => undefined);
      const scale = scaleSizes();
      const outside = textElements()
        .filter((element) => !scale.has(getComputedStyle(element).fontSize))
        .map((element) => `${name(element)}: ${getComputedStyle(element).fontSize}`);
      expect(outside).toEqual([]);
      const h1 = host!.querySelector<HTMLElement>('h1');
      expect(h1, 'h1').not.toBeNull();
      // En el panel del mapa el h1 usa `title`, porque el panel es angosto (D-T23 (021)).
      const size = h1!.closest('aside.game-panel') !== null ? 'title' : 'display';
      expect(getComputedStyle(h1!).fontSize).toBe(measure('fontSize', `var(--type-${size}-size)`));
    });
  });
});

describe('RF-3 (019) · radios', () => {
  it.each(ROUTES)('RF-3 (019) · 3.1, 3.2: en $path las acciones son píldoras, los bloques usan radius-block y los lotes radius-lot', async ({ path, as }) => {
    await at(1280);
    await show(path, as);
    const block = measure('borderTopLeftRadius', 'var(--radius-block)');
    const lot = measure('borderTopLeftRadius', 'var(--radius-lot)');
    const failures: string[] = [];
    // El contador del mapa es una píldora, como las acciones (D-T22 (021)). Los edificios del mapa no son acciones de texto:
    // llevan radius-building (RF-4 (021) · 4.4) y quedan a la vista cuando el mapa encuadra al elegido (RF-20 (021) · 20.4).
    for (const action of [...host!.querySelectorAll<HTMLElement>('button.block:not(.game-map__building), a.block, .icon-button, .play__count')].filter(visible)) {
      const half = action.getBoundingClientRect().height / 2;
      if (corners(action).some((radius) => px(radius) < half - 0.5)) failures.push(`acción ${name(action)}: ${corners(action).join(' ')}`);
    }
    const containers = [...host!.querySelectorAll<HTMLElement>('.block')].filter(
      (element) => visible(element) && !element.matches('button, a, input, select, textarea, .icon-button, .leaflet-bar, .play__count'),
    );
    for (const element of containers) {
      const radii = corners(element);
      if (!radii.every((radius) => radius === block || radius === '0px') || !radii.includes(block)) failures.push(`bloque ${name(element)}: ${radii.join(' ')}`);
    }
    const building = measure('borderTopLeftRadius', 'var(--radius-building)');
    for (const element of [...host!.querySelectorAll<HTMLElement>('button.block.game-map__building')].filter(visible)) {
      if (!corners(element).every((radius) => radius === building)) failures.push(`edificio ${name(element)}: ${corners(element).join(' ')}`);
    }
    for (const element of [...host!.querySelectorAll<HTMLElement>('.lot')].filter(visible)) {
      const radii = corners(element);
      if (!radii.every((radius) => radius === lot || radius === '0px') || !radii.includes(lot)) failures.push(`lote ${name(element)}: ${radii.join(' ')}`);
    }
    expect(failures).toEqual([]);
  });
});

describe('RF-12 (019) · formulario del ápice', () => {
  const FORMS = [`/apices/nuevo`, `/apices/${APICE_IDS.withImage}/editar`];

  describe.each([360, 1280])('a %i px', (width) => {
    it.each(FORMS)('RF-12 (019) · 12.1: en %s cada etiqueta queda encima de su campo', async (path) => {
      await at(width);
      await show(path, AUTHOR);
      const form = host!.querySelector<HTMLFormElement>('aside.game-panel form')!;
      const failures: string[] = [];
      for (const label of [...form.querySelectorAll<HTMLLabelElement>('label')].filter(visible)) {
        const control = label.control;
        if (control === null || control.matches('input[type="checkbox"], input[type="radio"]') || !visible(control)) continue;
        const range = document.createRange();
        const text = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '');
        if (text === undefined) continue;
        range.selectNodeContents(text);
        const words = range.getBoundingClientRect();
        if (words.bottom > control.getBoundingClientRect().top + 0.5) failures.push(`«${text.textContent!.trim()}» termina en ${Math.round(words.bottom)} y su campo empieza en ${Math.round(control.getBoundingClientRect().top)}`);
      }
      for (const fieldset of [...form.querySelectorAll('fieldset')].filter(visible)) {
        const legend = fieldset.querySelector('legend');
        const first = [...fieldset.querySelectorAll<HTMLElement>('input, button, select, textarea')].find(visible);
        if (legend !== null && first !== undefined && legend.getBoundingClientRect().bottom > first.getBoundingClientRect().top + 0.5) {
          failures.push(`leyenda «${legend.textContent}» al lado de su primer control`);
        }
      }
      expect(failures).toEqual([]);
    });

    it.each(FORMS)('RF-12 (019) · 12.3: en %s los grupos de campos son lotes, sin el borde del navegador', async (path) => {
      await at(width);
      await show(path, AUTHOR);
      const lot = measure('borderTopLeftRadius', 'var(--radius-lot)');
      const fieldsets = [...host!.querySelectorAll<HTMLFieldSetElement>('aside.game-panel form fieldset')].filter(visible);
      expect(fieldsets.length).toBeGreaterThan(0);
      for (const fieldset of fieldsets) {
        const style = getComputedStyle(fieldset);
        expect(style.borderTopStyle, name(fieldset)).not.toBe('groove');
        expect(corners(fieldset), name(fieldset)).toEqual([lot, lot, lot, lot]);
        if (style.borderTopStyle !== 'none') expect(style.borderTopColor, name(fieldset)).toBe(rgb(TOKENS.light.line));
      }
    });

    it.each(FORMS)('RF-12 (019) · 12.4: en %s el contador va al final de su campo, separado del campo siguiente', async (path) => {
      await at(width);
      await show(path, AUTHOR);
      const form = host!.querySelector<HTMLFormElement>('aside.game-panel form')!;
      const counters = [...form.querySelectorAll<HTMLElement>('*')].filter((element) => element.children.length === 0 && /^\d+ \/ \d+$/.test(element.textContent!.trim()));
      expect(counters).toHaveLength(4);
      for (const counter of counters) {
        const field = counter.parentElement!.querySelector<HTMLElement>('input, textarea')!;
        const box = counter.getBoundingClientRect();
        const fieldBox = field.getBoundingClientRect();
        expect(Math.abs(box.right - fieldBox.right), counter.textContent!).toBeLessThanOrEqual(1);
        expect(box.top, counter.textContent!).toBeGreaterThanOrEqual(fieldBox.bottom - 0.5);
        const next = [...form.querySelectorAll<HTMLElement>('label, legend')].find(
          (item) => visible(item) && (counter.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        );
        if (next !== undefined) expect(next.getBoundingClientRect().top - box.bottom, counter.textContent!).toBeGreaterThanOrEqual(8);
      }
    });
  });

  it('RF-12 (019) · 12.2, D-T6 (019): los ejes del formulario son botones de ícono con aria-pressed, como los filtros', async () => {
    await at(1280);
    await show('/apices/nuevo', AUTHOR);
    const legend = [...host!.querySelectorAll('aside.game-panel form legend')].find((item) => item.textContent?.trim() === 'Ejes');
    expect(legend, 'leyenda «Ejes»').toBeDefined();
    const group = legend!.closest('fieldset')!;
    expect(group.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    const buttons = [...group.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Agua', 'Alimento', 'Cobijo', 'Energía', 'Comunicación']);
    for (const button of buttons) {
      expect(button.querySelector('svg.axis-icon'), button.textContent!).not.toBeNull();
      expect(button.getBoundingClientRect().height, button.textContent!).toBeGreaterThanOrEqual(44);
    }
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(buttons[0]!);
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(buttons[0]!);
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('RF-13 (019) · Facilitación', () => {
  it.each(['/facilitacion/invitaciones', '/facilitacion/cuentas'])('RF-13 (019) · 13.1, D-T7 (019): en %s las filas son bloques sin viñeta', async (path) => {
    await at(1280);
    await show(path, FACILITATOR, path.endsWith('invitaciones') ? [INVITED_EMAIL] : [AUTHOR.username]);
    const rows = [...host!.querySelectorAll<HTMLLIElement>('main ul > li')].filter(visible);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.classList.contains('block'), name(row)).toBe(true);
      expect(getComputedStyle(row).listStyleType, name(row)).toBe('none');
      expect(getComputedStyle(row.parentElement!).paddingInlineStart, name(row)).toBe('0px');
    }
  });

  it('RF-13 (019) · 13.2, D-T7 (019): a 360 px el enlace de la invitación va abreviado y «Copiar enlace» lo copia entero', async () => {
    await at(360);
    await show('/facilitacion/invitaciones', FACILITATOR, [INVITED_EMAIL]);
    const row = [...host!.querySelectorAll<HTMLLIElement>('main ul > li')].find((item) => item.textContent!.includes(INVITED_EMAIL))!;
    const full = `${location.origin}/registro/invitacion-fija`;
    expect(row.textContent).not.toContain(full);
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const clipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const copy = [...row.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Copiar enlace')!;
      await userEvent.click(copy);
      expect(writeText).toHaveBeenCalledWith(full);
      const status = await waitFor(() => row.querySelector('[role="status"]'));
      expect(status.textContent?.trim()).toBe('Enlace copiado.');
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
      if (clipboard !== undefined) Object.defineProperty(Navigator.prototype, 'clipboard', clipboard);
    }
  });
});

describe('RF-18 (019) · un h1', () => {
  it.each(ROUTES)('RF-18 (019) · 18.1, D-T12 (019): $path tiene un solo h1', async ({ path, as }) => {
    await at(1280);
    await show(path, as);
    expect([...host!.querySelectorAll('h1')].map((h1) => h1.textContent)).toHaveLength(1);
  });
});

describe.each(THEMES)('tema %s', (theme) => {
  afterEach(() => {
    delete document.documentElement.dataset['theme'];
  });

  it('RF-15 (019) · 15.1, D-T9 (019): la inicial va sobre charcoal, con la letra en on-charcoal y un aro de 2 px en node-ring', async () => {
    document.documentElement.dataset['theme'] = theme;
    await at(1280);
    await show('/documentacion', AUTHOR);
    const initial = host!.querySelector<HTMLElement>('.account-entry .account-initial')!;
    const style = getComputedStyle(initial);
    expect(style.backgroundColor).toBe(rgb(TOKENS[theme].charcoal));
    expect(style.color).toBe(rgb(TOKENS[theme]['on-charcoal']));
    expect(style.borderTopWidth).toBe('2px');
    expect(style.borderTopStyle).toBe('solid');
    expect(style.borderTopColor).toBe(rgb(TOKENS[theme]['node-ring']));
  });

  it.each(['/constitucion'])('RF-20 (019) · 20.3, D-T13 (019): en %s el aro de cada nodo usa node-ring y contrasta 3:1 con el fondo', async (path) => {
    document.documentElement.dataset['theme'] = theme;
    await at(1280);
    await show(path, undefined, path === '/constitucion' ? ['Agua compartida'] : []);
    const nodes = [...host!.querySelectorAll<HTMLElement>('[data-testid="node"]')].filter(visible);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) expect(getComputedStyle(node).borderTopColor).toBe(rgb(TOKENS[theme]['node-ring']));
    expect(contrastRatio(TOKENS[theme]['node-ring'], TOKENS[theme].background)).toBeGreaterThanOrEqual(3);
  });
});

describe('RF-22 (019) · pie al fondo', () => {
  it.each([
    { path: '/ruta-que-no-existe', width: 1100, height: 875 },
    { path: '/foro', width: 360, height: 780 },
  ])('RF-22 (019) · 22.1, D-T15 (019): en $path a $width × $height el pie llega al fondo de la ventana', async ({ path, width, height }) => {
    await at(width, height);
    await show(path);
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((done) => setTimeout(done, 50));
    const footer = host!.querySelector<HTMLElement>('footer')!;
    expect(document.documentElement.scrollHeight).toBeGreaterThanOrEqual(innerHeight);
    expect(Math.abs(footer.getBoundingClientRect().bottom - innerHeight)).toBeLessThanOrEqual(1);
    scrollTo(0, 0);
  });
});

// Fase 2 · Terreno. Siembra completa: «Huerta con imagen» es prototipo con necesidades, «Los cinco ejes» está en marcha
// y «Referencia retirada» es una idea con imagen y sin necesidades. Las imágenes siguen en la siembra como evidencia de
// RF-27 (021) · 27.4: se conservan y no se muestran.

/**
 * La tarjeta de la lista del mapa con el nombre `apiceName` (RF-10 (021)). En la siembra completa el mapa abre alejado,
 * con grupos (RF-7 (021)): el edificio entero, con su etapa en texto, se mide en la lista.
 */
async function buildingFor(apiceName: string): Promise<HTMLElement> {
  return waitFor(() => [...host!.querySelectorAll<HTMLElement>('main article.block')].find((card) => card.querySelector('h3')?.textContent === apiceName));
}

/** Un color de token, calculado sobre un elemento de prueba. */
function colorOf(value: string): string {
  const probe = document.createElement('div');
  probe.style.backgroundColor = value;
  document.body.append(probe);
  const computed = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return computed;
}

/** Las partes del dibujo, de arriba abajo (RF-3 (021) · 3.1 a 3.3). */
const parts = (building: Element) => ['roof', 'body', 'base'].filter((part) => building.querySelector(`.building__drawing .building__${part}`) !== null);

describe('RF-4 (019) · el edificio crece', () => {
  it.each([
    { apiceName: 'Referencia retirada', stage: 'idea', label: 'Idea', expected: ['base'], axis: 'agua' },
    { apiceName: 'Huerta con imagen', stage: 'prototipo', label: 'Prototipo', expected: ['body', 'base'], axis: 'alimento' },
    { apiceName: 'Los cinco ejes', stage: 'en marcha', label: 'En marcha', expected: ['roof', 'body', 'base'], axis: 'agua' },
  ])('RF-4 (019) · 4.1, 4.4, RF-3 (021) · 3.1 a 3.3, RF-2 (021) · 2.2, D-T19 (019): «$apiceName» ($stage) muestra $expected, la base del primer eje y el texto «$label» en la lista', async ({ apiceName, stage, label, expected, axis }) => {
    await at(1280);
    await show('/?vista=lista');
    const button = await buildingFor(apiceName);
    const building = button.querySelector<HTMLElement>('.building')!;
    expect(building.dataset['stage']).toBe(stage);
    expect(parts(building)).toEqual(expected);
    expect(getComputedStyle(building.querySelector('.building__base')!).fill).toBe(colorOf(`var(--axis-${axis}-fill)`));
    // RF-1 (021) · 1.1, RF-27 (021) · 27.4: ningún edificio muestra imagen, aunque el ápice guarde una.
    expect(building.querySelector('img, canvas')).toBeNull();
    const text = building.querySelector<HTMLElement>('.building__stage')!;
    expect(visible(text)).toBe(true);
    expect(text.textContent).toBe(label);
  });

  it('RF-27 (021) · 27.4, RF-1 (021) · 1.1: la ficha de un ápice que guarda una imagen aceptada ya no la muestra, ni dentro ni fuera del edificio', async () => {
    await at(1280);
    for (const id of [APICE_IDS.withRetractedReference, APICE_IDS.withImage]) {
      await show(`/apices/${id}`);
      await waitFor(() => host!.querySelector('.apice-view__head .building__drawing'));
      // El panel: el logo de apoyo del menú de juego también es una imagen (RF-13 (021) · 13.5).
      const main = host!.querySelector<HTMLElement>('aside.game-panel')!;
      expect(main.querySelectorAll('img, canvas, input[type="file"]')).toHaveLength(0);
      expect(main.querySelector('.apice-view__image')).toBeNull();
    }
  });
});

describe('RF-9 (019) · necesidades a la vista', () => {
  it('RF-9 (019) · 9.1, 9.3, D-T21 (019): el pin es un círculo de 14 px del primer eje, sin texto, y solo está si hay necesidades', async () => {
    await at(1280);
    await show('/?vista=lista');
    const withNeeds = await buildingFor('Huerta con imagen');
    const pin = withNeeds.querySelector<HTMLElement>('.building__pin')!;
    const box = pin.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([14, 14]);
    expect(pin.textContent).toBe('');
    expect(pin.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(pin).backgroundColor).toBe(colorOf('var(--axis-alimento-fill)'));
    expect((await buildingFor('Referencia retirada')).querySelector('.building__pin')).toBeNull();
  });
});

describe('RF-11 (019) · la ficha como taller', () => {
  it.each([360, 1280])('RF-11 (019) · 11.1 a 11.4, D-T23 (019): a %i px la ficha lleva el edificio con el h1, ejes sin viñetas, los lotes juntos y la fecha larga', async (width) => {
    await at(width);
    await show(`/apices/${APICE_IDS.withImage}`);
    const head = host!.querySelector<HTMLElement>('.apice-view__head')!;
    const building = head.querySelector<HTMLElement>('.building')!;
    const h1 = head.querySelector('h1')!;
    expect(h1.textContent).toBe('Huerta con imagen');
    expect(building.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(building.querySelector('.building__stage')!.textContent).toBe('Prototipo');
    const axes = host!.querySelector<HTMLElement>('ul.apice-view__axes')!;
    expect(getComputedStyle(axes).listStyleType).toBe('none');
    expect(px(getComputedStyle(axes).paddingLeft)).toBe(0);
    const [needs, offers] = [...host!.querySelectorAll<HTMLElement>('.apice-view__workshop > section.lot')];
    expect([needs!.querySelector('h2')!.textContent, offers!.querySelector('h2')!.textContent]).toEqual(['Necesidades', 'Aportes']);
    expect(needs!.nextElementSibling).toBe(offers);
    const location = [...host!.querySelectorAll('h2')].find((heading) => heading.textContent === 'Ubicación')!;
    expect(offers!.compareDocumentPosition(location) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host!.textContent).toMatch(/Última edición el \d{1,2} de [a-z]+ de \d{4}/);
  });
});

describe('RF-19 (019) · terreno de partida', () => {
  it('RF-19 (019) · 19.5, D-T22 (019): a 360 × 780 px Mi tablero vacío muestra el terreno de partida y su invitación sin desplazarse', async () => {
    await at(360, 780);
    await show('/tablero', FACILITATOR, ['Todavía no tienes ápices en el terreno.']);
    scrollTo(0, 0);
    const terrain = host!.querySelector<HTMLElement>('section.starting-terrain')!;
    const action = [...terrain.querySelectorAll<HTMLElement>('a')].find((link) => link.textContent === 'Propón tu primer ápice')!;
    expect(terrain.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight);
    expect(action.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight);
    expect(terrain.querySelectorAll('.starting-terrain__base')).toHaveLength(5);
  });
});

describe('RNF-5 (019) · movimiento', () => {
  afterEach(async () => {
    await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  });

  it.each([
    { reduce: true, expected: 'none' },
    { reduce: false, expected: 'building-grow' },
  ])('RNF-5 (019): con movimiento reducido $reduce, el techo y el cuerpo animan con «$expected»', async ({ reduce, expected }) => {
    await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
    await at(1280);
    // Sin `show`: la lista puede dejar edificios fuera de lo que pinta el navegador de prueba, y Chromium no arranca su
    // animación, así que esperar a que no quede ninguna no terminaría. Basta el nombre calculado.
    await useAccount(undefined);
    history.replaceState(null, '', '/?vista=lista');
    dispatchEvent(new PopStateEvent('popstate'));
    const building = (await buildingFor('Los cinco ejes')).querySelector<HTMLElement>('.building')!;
    for (const part of building.querySelectorAll('.building__roof, .building__body')) expect(getComputedStyle(part).animationName).toBe(expected);
  });
});
