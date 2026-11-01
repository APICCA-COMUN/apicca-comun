// Bloques, lotes, botones y campos en Chromium real (RF-3 (003), RF-4 (003), RF-5 (003), RNF-1 (003), D-T20 (003)): en las
// rutas que la siembra parcial permite montar, todo bloque calcula `radius-block`, sin borde y `shadow-block`
// hacia abajo y a la derecha (RF-3 (003) · 3.1, 3.4); con piezas de prueba, el lote lleva borde `line` y ninguna
// sombra (3.2), los botones, el diálogo abierto y los campos siguen RF-4 (003) y RF-5 (003), y con colores forzados y contraste
// aumentado los bordes se mantienen. Siguen vigentes de la 002: el foco de teclado se pinta con `focus` (6.4), a 360 px no hay desplazamiento horizontal (6.6) y
// el nombre de 120 caracteres y el usuario de 24 se ajustan sin cortarse ni desbordar (6.7). Con la siembra
// completa (T-8.1, RNF-5 (002)) los 360 px recorren todas las rutas de la app, con sesión donde la ruta la pide.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cdp, commands, page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/paths.css';
import { contrastRatio, hexToRgb, THEMES, TOKENS, type ThemeName, type TokenName } from '../../shared/domain/identity';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { signInAs, signOutNow } from './session';
import { APICE_IDS, AUTHOR, FACILITATOR, LONG_APICE_ID, LONG_NAME, LONG_USERNAME } from './seed-data';

/** Rutas que la siembra deja con contenido, con la cuenta que piden (`/tablero` pide la de la autora, T-7.3); la desconocida va antes. */
const PATHS: { path: string; as?: typeof AUTHOR }[] = [
  { path: '/' },
  { path: '/entrar' },
  { path: '/olvide' },
  { path: '/registro' },
  { path: '/solicitar' },
  { path: `/apices/${LONG_APICE_ID}` },
  { path: '/prototipado' },
  { path: '/documentacion' },
  { path: '/constitucion' },
  { path: '/ruta-que-no-existe' },
  { path: '/tablero', as: AUTHOR },
];

/** Todas las rutas de `ROUTES` (src/app/router.tsx) más una desconocida, con la cuenta que cada una pide (RF-6 (002) · 6.6). */
const ALL_ROUTES: { path: string; as?: typeof AUTHOR | typeof FACILITATOR }[] = [
  { path: '/' },
  { path: '/entrar' },
  { path: '/olvide' },
  { path: '/accion' },
  { path: '/registro/token-de-prueba' },
  { path: '/registro' },
  { path: '/solicitar' },
  { path: `/apices/${LONG_APICE_ID}` },
  { path: `/apices/${APICE_IDS.withImage}` },
  { path: '/ruta-que-no-existe' },
  { path: '/prototipado' },
  { path: '/documentacion' },
  { path: '/constitucion' },
  { path: '/tablero', as: AUTHOR },
  { path: '/archivados', as: AUTHOR },
  { path: '/apices/nuevo', as: AUTHOR },
  { path: `/apices/${APICE_IDS.withImage}/editar`, as: AUTHOR },
  { path: `/apices/${APICE_IDS.withImage}/historial`, as: AUTHOR },
  { path: `/apices/${APICE_IDS.private}`, as: AUTHOR },
  { path: `/apices/${APICE_IDS.withProposal}`, as: AUTHOR },
  { path: '/facilitacion/invitaciones', as: FACILITATOR },
  { path: '/facilitacion/solicitudes', as: FACILITATOR },
  { path: '/facilitacion/cuentas', as: FACILITATOR },
  { path: `/apices/${APICE_IDS.withRetractedReference}`, as: FACILITATOR },
];

let signedInAs: string | null = null;

/** Cambia de cuenta solo si hace falta; `null` cierra la sesión. */
async function useAccount(account: typeof AUTHOR | typeof FACILITATOR | undefined) {
  const wanted = account?.uid ?? null;
  if (wanted === signedInAs) return;
  if (signedInAs !== null) await signOutNow();
  if (account !== undefined) await signInAs(account);
  signedInAs = wanted;
  // La sesión llega al sitio por el observador de Auth y la escucha de la cuenta.
  await new Promise((done) => setTimeout(done, 300));
}

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
  const until = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    if (Date.now() > until) throw new Error('waitFor: se agotó la espera.');
    await new Promise((done) => setTimeout(done, 50));
  }
}

/** El valor calculado de una propiedad con un token, resuelto con un elemento auxiliar. */
function computed(property: 'borderRadius' | 'boxShadow' | 'color', token: string): string {
  const probe = document.createElement('div');
  probe.style[property] = `var(--${token})`;
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

async function show(path: string) {
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  await waitFor(() => !host!.textContent!.includes('Cargando') && host!.querySelector('main h1, main h2'));
  // Al cambiar de tema la sombra transita (RF-9 (002)): se mide ya en reposo.
  await waitFor(() => document.getAnimations().length === 0);
}

/** El borde derecho visible de un elemento: lo que un antepasado recorta no desplaza la página. */
function visibleRight(element: Element): number {
  let right = element.getBoundingClientRect().right;
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowX !== 'visible') right = Math.min(right, parent.getBoundingClientRect().right);
  }
  return right;
}

/**
 * Los bloques que RF-3 (003) · 3.1 describe tal cual: los deshabilitados o en curso llevan su propia forma
 * (RF-6 (002) · 6.5), los campos y la acción destructiva llevan su borde (RF-5 (003) · 5.1, RF-4 (003) · 4.4).
 */
/** El ojo de Entrar va dentro del campo, sin sombra propia (RF-5 (005) · 5.1). */
const activeBlocks = () =>
  [...host!.querySelectorAll<HTMLElement>('.block')].filter(
    (el) =>
      !el.matches(':disabled, [aria-disabled="true"], [aria-busy="true"], input, select, textarea, .action-destructive, .sign-in-form__reveal'),
  );

/** El elemento con el texto exacto más interno dentro de `main`. */
function innermostWith(text: string): HTMLElement {
  const all = [...host!.querySelectorAll<HTMLElement>('main *')].filter((el) => el.textContent!.includes(text));
  return all.find((el) => ![...el.children].some((child) => child.textContent!.includes(text)))!;
}

/** Comprueba que el texto se ajuste en varias líneas, completo y dentro de su bloque. */
function expectWrappedInside(element: HTMLElement, text: string, minLines: number) {
  expect(element.textContent).toContain(text);
  expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
  const box = element.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
  expect(Math.round(box.height / lineHeight)).toBeGreaterThanOrEqual(minLines);
  const block = (element.closest('.block') ?? element.closest('main'))!.getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(block.left - 0.5);
  expect(box.right).toBeLessThanOrEqual(block.right + 0.5);
  expect(box.right).toBeLessThanOrEqual(innerWidth + 0.5);
}

beforeAll(async () => {
  await commands.seedFull();
  previousPath = location.pathname + location.search;
  history.replaceState(null, '', '/');
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
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  delete document.documentElement.dataset['theme'];
  history.replaceState(null, '', previousPath);
  await page.viewport(1280, 800);
});

describe.each(THEMES)('bloques en el tema %s', (theme) => {
  it.each(PATHS)('RF-3 (003) · 3.1, 3.4: en $path todo bloque calcula radius-block, sin borde y shadow-block, hacia abajo y a la derecha', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await useAccount(as);
    await show(path);
    if (as !== undefined) expect(location.pathname).toBe(path);
    const shadow = computed('boxShadow', 'shadow-block');
    const [x, y] = [...shadow.matchAll(/(-?[\d.]+)px/g)].map((match) => parseFloat(match[1]!));
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    // Los edificios del zigzag son ilustración (radio 10 y sombra elevada del canvas): se miden en design-005 (RF-6 (005) · 6.10).
    const blocks = activeBlocks().filter((el) => !el.matches('.apice-lot__building--trail'));
    expect(blocks.length).toBeGreaterThan(0);
    const odd = blocks
      .filter((el) => {
        const style = getComputedStyle(el);
        const pill = el.matches('button, a');
        const sides = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth];
        return (
          (pill ? parseFloat(style.borderTopLeftRadius) < el.getBoundingClientRect().height / 2 : style.borderRadius !== TOKENS[theme]['radius-block']) ||
          style.boxShadow !== shadow ||
          sides.some((width) => width !== '0px')
        );
      })
      .map((el) => `${getComputedStyle(el).boxShadow} ${el.outerHTML.slice(0, 100)}`);
    expect(odd).toEqual([]);
  });

  it.each(PATHS)('RF-6 (002) · 6.4: en $path cada parada del tabulador muestra el indicador con el token focus', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await useAccount(as);
    await show(path);
    if (as !== undefined) expect(location.pathname).toBe(path);
    (document.activeElement as HTMLElement | null)?.blur();
    // El punto de partida del tabulador queda donde estaba el último foco de la ruta anterior; con rutas de más
    // de 12 paradas (la constitución sembrada, RNF-4 (004)) caería fuera de `host`. Se devuelve al inicio del documento.
    const start = document.createElement('span');
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
    start.remove();
    const focus = computed('color', 'focus');
    const seen = new Set<Element>();
    for (let stop = 0; stop < 12; stop += 1) {
      await userEvent.tab();
      const active = document.activeElement;
      if (active === null || active === document.body || seen.has(active) || !host!.contains(active)) break;
      seen.add(active);
      const style = getComputedStyle(active);
      expect(active.matches(':focus-visible')).toBe(true);
      expect(style.outlineStyle, active.outerHTML.slice(0, 80)).not.toBe('none');
      expect(style.outlineColor, active.outerHTML.slice(0, 80)).toBe(focus);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it.each(ALL_ROUTES)('RF-6 (002) · 6.6: en $path a 360 px no hay desplazamiento horizontal', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await useAccount(as);
    await show(path);
    // Con cuenta, la ruta se monta sin redirigir ni caer en la pantalla de acceso.
    if (as !== undefined) expect(location.pathname).toBe(path);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    const wide = [...host!.querySelectorAll<HTMLElement>('*')]
      .filter((el) => visibleRight(el) > innerWidth + 0.5)
      .map((el) => el.outerHTML.slice(0, 100));
    expect(wide).toEqual([]);
  });

  // La lista se mudó de / a /prototipado (RF-18 (003), D-19 (003)).
  it.each(['/prototipado', `/apices/${LONG_APICE_ID}`])('RF-6 (002) · 6.7: en %s a 360 px el nombre de 120 caracteres se ajusta sin cortarse ni desbordar su bloque', async (path) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(path);
    const heading = await waitFor(() => [...host!.querySelectorAll<HTMLElement>('main h1, main h2, main h3')].find((el) => el.textContent === LONG_NAME));
    expect(getComputedStyle(heading).textOverflow).not.toBe('ellipsis');
    expectWrappedInside(heading, LONG_NAME, 2);
  });

  it.each(['/prototipado', `/apices/${LONG_APICE_ID}`])('RF-7 (002) · 7.1, 7.2, D-T10 (002): en %s a 360 px todo edificio deja al menos 64 px para la imagen', async (path) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(path);
    const buildings = await waitFor(() => {
      const found = [...host!.querySelectorAll<HTMLElement>('.building')];
      return found.length > 0 ? found : null;
    });
    for (const building of buildings) {
      const style = getComputedStyle(building);
      const inner = building.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      expect(inner).toBeGreaterThanOrEqual(64);
      expect(building.querySelector<HTMLElement>('.pixel-image')!.getBoundingClientRect().width).toBe(64 * Math.min(Math.floor(inner / 64), path === '/prototipado' ? 2 : 4));
    }
  });

  it('RF-6 (002) · 6.7: a 360 px el usuario de 24 caracteres se muestra completo sin desbordar su bloque', async () => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(`/apices/${LONG_APICE_ID}`);
    const author = await waitFor(() => innermostWith(LONG_USERNAME));
    expectWrappedInside(author, LONG_USERNAME, 1);
  });
});

// --- Piezas de prueba: lotes, botones, diálogo y campos (el DOM real de las páginas llega en H2 a H5). ---

const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;
const token = (theme: ThemeName, name: TokenName) => rgb(TOKENS[theme][name]);

let bench: HTMLDivElement | undefined;

/** Monta HTML de prueba aparte de la app y devuelve el contenedor. */
function mount(html: string): HTMLDivElement {
  bench?.remove();
  bench = document.createElement('div');
  bench.innerHTML = html;
  document.body.append(bench);
  return bench;
}

async function emulate(feature: 'forced-colors' | 'prefers-contrast', value: string) {
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: feature, value }] });
}

async function settle() {
  await waitFor(() => document.getAnimations().length === 0);
}

/** Resuelve un color del sistema (`CanvasText`) a su valor calculado. */
function systemColor(name: string): string {
  const probe = document.createElement('span');
  probe.style.color = name;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

const get = (container: ParentNode, selector: string) => container.querySelector<HTMLElement>(selector)!;

describe.each(THEMES)('lotes, botones, diálogo y campos en el tema %s', (theme) => {
  beforeAll(() => {
    document.documentElement.dataset['theme'] = theme;
  });

  afterAll(async () => {
    bench?.remove();
    bench = undefined;
    await emulate('forced-colors', 'none');
    await emulate('prefers-contrast', 'no-preference');
  });

  it('RF-3 (003) · 3.2, RF-2 (005) · 2.1: todo lote calcula fondo surface, radius-lot, borde line de 1 px y ninguna sombra', async () => {
    const box = mount('<section class="lot"><p>Lote</p></section><div class="lot">Otro</div>');
    await settle();
    for (const lot of box.querySelectorAll<HTMLElement>('.lot')) {
      const style = getComputedStyle(lot);
      expect(style.borderRadius).toBe(TOKENS[theme]['radius-lot']);
      expect(style.backgroundColor).toBe(token(theme, 'surface'));
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        expect(style[`border${side}Width`]).toBe('1px');
        expect(style[`border${side}Style`]).toBe('solid');
        expect(style[`border${side}Color`]).toBe(token(theme, 'line'));
      }
      expect(style.boxShadow).toBe('none');
    }
  });

  it('RF-4 (003) · 4.1: todo botón y enlace con forma de botón es una píldora de al menos 44 px de alto', async () => {
    const box = mount(`
      <button class="block action-primary">Principal</button>
      <button class="block action-secondary">Secundario</button>
      <button class="block action-destructive">Destructivo</button>
      <a class="block action-secondary" href="#x">Enlace</a>
      <a class="block action-primary" href="#x">Enlace azul</a>`);
    await settle();
    const all = [...box.querySelectorAll<HTMLElement>('button, a')];
    expect(all).toHaveLength(5);
    for (const el of all) {
      const height = el.getBoundingClientRect().height;
      expect(height, el.outerHTML).toBeGreaterThanOrEqual(44);
      expect(parseFloat(getComputedStyle(el).borderTopLeftRadius), el.outerHTML).toBeGreaterThanOrEqual(height / 2);
    }
  });

  it('RF-4 (003) · 4.2: el botón principal se rellena con action-blue y deja el texto en on-accent', async () => {
    const box = mount('<button class="block action-primary">Principal</button>');
    await settle();
    const style = getComputedStyle(get(box, 'button'));
    expect(style.backgroundColor).toBe(token(theme, 'action-blue'));
    expect(style.color).toBe(token(theme, 'on-accent'));
    expect(style.boxShadow).toBe(computed('boxShadow', 'shadow-block'));
  });

  it('RF-4 (003) · 4.3: el botón secundario tiene fondo surface, sin borde y shadow-block', async () => {
    const box = mount('<button class="block action-secondary">Secundario</button><a class="block action-secondary" href="#x">Enlace</a>');
    await settle();
    for (const el of box.querySelectorAll<HTMLElement>('button, a')) {
      const style = getComputedStyle(el);
      expect(style.backgroundColor).toBe(token(theme, 'surface'));
      expect(style.borderTopWidth).toBe('0px');
      expect(style.borderBottomWidth).toBe('0px');
      expect(style.boxShadow).toBe(computed('boxShadow', 'shadow-block'));
    }
  });

  it('RF-4 (003) · 4.4: el botón destructivo tiene fondo surface, texto brand-red y borde de 2 px brand-red', async () => {
    const box = mount('<button class="block action-destructive">Descartar</button>');
    await settle();
    const style = getComputedStyle(get(box, 'button'));
    expect(style.backgroundColor).toBe(token(theme, 'surface'));
    expect(style.color).toBe(token(theme, 'brand-red'));
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      expect(style[`border${side}Width`]).toBe('2px');
      expect(style[`border${side}Style`]).toBe('solid');
      expect(style[`border${side}Color`]).toBe(token(theme, 'brand-red'));
    }
  });

  it.each([['icon-button'], ['block icon-button']])('RF-4 (003) · 4.5: el botón de ícono «%s» mide 44 × 44 y es redondo', async (classes) => {
    const box = mount(`<button class="${classes}" aria-label="Cambiar tema">T</button><a class="${classes}" href="#x" aria-label="Mi tablero">M</a>`);
    await settle();
    for (const el of box.querySelectorAll<HTMLElement>('button, a')) {
      const rect = el.getBoundingClientRect();
      expect(rect.width, el.outerHTML).toBe(44);
      expect(rect.height, el.outerHTML).toBe(44);
      expect(parseFloat(getComputedStyle(el).borderTopLeftRadius), el.outerHTML).toBeGreaterThanOrEqual(22);
      expect(getComputedStyle(el).backgroundColor).toBe(token(theme, 'surface'));
    }
  });

  it('RF-4 (003) · 4.3: al pasar el cursor, el botón secundario se eleva a shadow-raised', async () => {
    const box = mount('<button class="block action-secondary">Secundario</button>');
    await settle();
    const button = get(box, 'button');
    await userEvent.hover(button);
    await settle();
    expect(getComputedStyle(button).boxShadow).toBe(computed('boxShadow', 'shadow-raised'));
    await userEvent.unhover(button);
  });

  it('RF-4 (003) · 4.7: con un diálogo abierto, el principal de fuera se ve secundario, el de dentro sigue azul y al cerrarlo el de fondo vuelve a azul', async () => {
    const box = mount('<button class="block action-primary" id="outside">Guardar</button>');
    const outside = get(box, '#outside');
    await settle();
    expect(getComputedStyle(outside).backgroundColor).toBe(token(theme, 'action-blue'));

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.className = 'block';
    dialog.innerHTML = '<button class="block action-primary" id="inside">Volver a entrar</button>';
    box.append(dialog);
    await settle();
    const secondary = getComputedStyle(outside);
    expect(secondary.backgroundColor).toBe(token(theme, 'surface'));
    expect(secondary.color).toBe(token(theme, 'text'));
    expect(secondary.borderTopWidth).toBe('0px');
    expect(getComputedStyle(get(box, '#inside')).backgroundColor).toBe(token(theme, 'action-blue'));

    dialog.remove();
    await settle();
    expect(getComputedStyle(outside).backgroundColor).toBe(token(theme, 'action-blue'));
  });

  it.each([['input type="text"'], ['textarea'], ['select']])('RF-5 (003) · 5.1: «%s» se muestra sobre background, sin borde salvo uno inferior de 2 px field-border', async (tag) => {
    const name = tag.split(' ')[0]!;
    const box = mount(`<${tag} class="block" aria-label="Campo">${name === 'input' ? '' : `</${name}>`}`);
    await settle();
    const style = getComputedStyle(get(box, name));
    expect(style.backgroundColor).toBe(token(theme, 'background'));
    for (const side of ['Top', 'Right', 'Left'] as const) expect(style[`border${side}Width`]).toBe('0px');
    expect(style.borderBottomWidth).toBe('2px');
    expect(style.borderBottomStyle).toBe('solid');
    expect(style.borderBottomColor).toBe(token(theme, 'field-border'));
    expect(style.boxShadow).toBe('none');
  });

  it('RF-5 (003) · 5.1: field-border sobre background pasa 3:1', () => {
    expect(contrastRatio(TOKENS[theme]['field-border'], TOKENS[theme].background)).toBeGreaterThanOrEqual(3);
  });

  it('RF-5 (003) · 5.3: un campo con aria-invalid marca su borde inferior con brand-red', async () => {
    const box = mount('<input class="block" aria-label="Campo" aria-invalid="true" />');
    await settle();
    const style = getComputedStyle(get(box, 'input'));
    expect(style.borderBottomColor).toBe(token(theme, 'brand-red'));
    expect(style.borderBottomWidth).toBe('2px');
    expect(style.borderTopWidth).toBe('0px');
  });

  it('RF-3 (003) · 3.1; D-T20 (003): con colores forzados el bloque lleva un borde de 1 px CanvasText y el lote conserva el suyo', async () => {
    const box = mount('<article class="block">Bloque</article><section class="lot">Lote</section>');
    await emulate('forced-colors', 'active');
    try {
      expect(matchMedia('(forced-colors: active)').matches).toBe(true);
      await settle();
      const canvasText = systemColor('CanvasText');
      const block = getComputedStyle(get(box, '.block'));
      const lot = getComputedStyle(get(box, '.lot'));
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        expect(block[`border${side}Width`]).toBe('1px');
        expect(block[`border${side}Style`]).toBe('solid');
        expect(block[`border${side}Color`]).toBe(canvasText);
        expect(lot[`border${side}Width`]).toBe('1px');
        expect(lot[`border${side}Style`]).toBe('solid');
      }
    } finally {
      await emulate('forced-colors', 'none');
    }
  });

  it('RF-3 (003) · 3.1, 3.2; RNF-1 (003); D-T20 (003): con contraste aumentado, bloques y lotes llevan bordes de 2 px del color text', async () => {
    const box = mount('<article class="block">Bloque</article><section class="lot">Lote</section>');
    await emulate('prefers-contrast', 'more');
    try {
      expect(matchMedia('(prefers-contrast: more)').matches).toBe(true);
      await settle();
      for (const el of box.querySelectorAll<HTMLElement>('.block, .lot')) {
        const style = getComputedStyle(el);
        for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
          expect(style[`border${side}Width`], el.className).toBe('2px');
          expect(style[`border${side}Style`], el.className).toBe('solid');
          expect(style[`border${side}Color`], el.className).toBe(token(theme, 'text'));
        }
      }
    } finally {
      await emulate('prefers-contrast', 'no-preference');
    }
  });
});
