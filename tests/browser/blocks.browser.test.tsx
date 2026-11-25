// Bloques, lotes, botones y campos en Chromium real (RF-3 (003), RF-4 (003), RF-5 (003), RNF-1 (003), D-T20 (003)), con
// «E3 · Celda» (24-11-2026): sin cajas. En las rutas que la siembra parcial permite montar, ningún elemento es una caja
// (los cuatro lados con borde) salvo los campos y la acción principal, y todo bloque calcula radio 0 y ninguna sombra
// (RF-3 (003) · 3.1, 3.4); con piezas de prueba, el lote abre con un filete de tinta de 1,5 px (3.2), el bloque con uno
// suave, los botones (principal en barra de tinta, secundario y destructivo como texto subrayado), el diálogo abierto y
// los campos siguen RF-4 (003) y RF-5 (003), y con colores forzados y contraste aumentado los filetes se mantienen. Siguen
// vigentes de la 002: el foco de teclado se pinta con `focus` (6.4), a 360 px no hay desplazamiento horizontal (6.6) y
// el nombre de 120 caracteres y el usuario de 24 se ajustan sin cortarse ni desbordar (6.7; en la lista del mapa y en la ficha). Con la siembra
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
import '../../src/styles/piezas.css';
import { contrastRatio, hexToRgb, THEMES, TOKENS, type ThemeName, type TokenName } from '../../shared/domain/identity';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { signInAs, signOutNow } from './session';
import { APICE_IDS, AUTHOR, FACILITATOR, LONG_APICE_ID, LONG_NAME, LONG_USERNAME } from './seed-data';

/** Rutas que la siembra deja con contenido, con la cuenta que piden («Lo mío» pide la de la autora, RF-15 (021)); la desconocida va antes. */
const PATHS: { path: string; as?: typeof AUTHOR }[] = [
  { path: '/' },
  { path: '/entrar' },
  { path: '/olvide' },
  { path: '/registro' },
  { path: '/solicitar' },
  { path: `/apices/${LONG_APICE_ID}` },
  { path: '/?vista=lista' },
  { path: '/documentacion' },
  { path: '/constitucion' },
  { path: '/ruta-que-no-existe' },
  { path: '/?mio=1', as: AUTHOR },
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
  { path: '/documentacion' },
  { path: '/constitucion' },
  { path: '/?mio=1', as: AUTHOR },
  { path: '/?vista=lista' },
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

/** El filete de 1,5 px (`--stroke-divider`): Chromium lo calcula como 1 px con densidad 1 y como 1,5 px con densidad 1,5. */
const FILETE = ['1px', '1.5px'];

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

/** Lo que un `clip-path` de SVG recorta no se ve ni desplaza la página, aunque su caja (`getBoundingClientRect`) sea mayor:
    las celdas con superficie recortan sus franjas al hexágono. */
function clippedByPath(element: Element): boolean {
  return element.closest('[clip-path]') !== null || element.querySelector('[clip-path]') !== null;
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
 * (RF-6 (002) · 6.5), los campos y la acción destructiva llevan su forma (RF-5 (003) · 5.1, RF-4 (003) · 4.4), el campo con
 * error suma una barra (5.3), el que está bajo el puntero se invierte (RF-9 (002)) y el botón presionado también. Las
 * celdas, los grupos y los rótulos de Arco del mapa son marcadores del mapa; los diálogos cerrados (el menú plegado,
 * RF-13 (021)) no se pintan.
 */
const activeBlocks = () =>
  [...host!.querySelectorAll<HTMLElement>('.block')].filter(
    (el) =>
      el.getClientRects().length > 0 &&
      !el.matches(
        ':disabled, [aria-disabled="true"], [aria-busy="true"], [aria-invalid="true"], :hover, input, select, textarea, .action-destructive, .sign-in-form__reveal, .game-map__cell, .game-map__group, .game-map__path-label, button[aria-pressed="true"]',
      ),
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
  it.each(PATHS)('RF-3 (003) · 3.1, 3.4: en $path no hay cajas: todo bloque calcula radio 0 y ninguna sombra, sin borde a los lados ni abajo y con a lo sumo un filete arriba', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await useAccount(as);
    await show(path);
    if (as !== undefined) expect(location.pathname + location.search).toBe(path);
    // Los botones de ícono de la cabecera van sin borde (`.ap-boton-icono` del sistema): se comprueban aparte.
    const inHeader = (el: HTMLElement) => el.matches('.site-header .icon-button');
    for (const el of activeBlocks().filter(inHeader)) {
      expect(getComputedStyle(el).borderTopWidth, el.outerHTML.slice(0, 100)).toBe('0px');
      expect(getComputedStyle(el).borderRadius).toBe('0px');
    }
    const blocks = activeBlocks().filter((el) => !inHeader(el));
    const ink = token(theme, 'text');
    const soft = token(theme, 'trama');
    const odd = blocks
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.borderRadius !== '0px' || style.boxShadow !== 'none') return true;
        // La acción principal es la barra de tinta: su contorno de 2 px es del color de su relleno.
        if (el.matches('.action-primary')) return style.borderTopWidth !== '2px' || style.borderTopColor !== ink;
        const sides = [style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth];
        const top = style.borderTopWidth === '0px' || ([...FILETE, '2px'].includes(style.borderTopWidth) && style.borderTopStyle === 'solid' && [soft, ink].includes(style.borderTopColor));
        return sides.some((width) => width !== '0px') || !top;
      })
      .map((el) => `${getComputedStyle(el).borderTopWidth} ${getComputedStyle(el).boxShadow} ${el.outerHTML.slice(0, 100)}`);
    expect(odd).toEqual([]);
    // Ningún elemento de la página es una caja: ninguno lleva borde por sus cuatro lados, salvo los campos, la acción principal y
    // la superficie de patrón de un Ápice (su contorno de 2 px es parte del dibujo, no una caja que contiene).
    const boxes = [...host!.querySelectorAll<HTMLElement>('*')]
      .filter((el) => !(el instanceof SVGElement) && el.getClientRects().length > 0)
      .filter((el) => !el.matches('input, select, textarea, .action-primary, .superficie, .leaflet-container *, [role="dialog"]'))
      .filter((el) => {
        const style = getComputedStyle(el);
        return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].every((width) => width !== '0px');
      })
      .map((el) => el.outerHTML.slice(0, 100));
    expect(boxes).toEqual([]);
  });

  it.each(PATHS)('RF-6 (002) · 6.4: en $path cada parada del tabulador muestra el indicador con el token focus', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await useAccount(as);
    await show(path);
    if (as !== undefined) expect(location.pathname + location.search).toBe(path);
    (document.activeElement as HTMLElement | null)?.blur();
    // El punto de partida del tabulador queda donde estaba el último foco de la ruta anterior; con rutas de más
    // de 12 paradas (la constitución sembrada, RNF-4 (004)) caería fuera de `host`. Se devuelve al inicio del documento.
    const start = document.createElement('span');
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
    start.remove();
    const focus = computed('color', 'focus');
    // El pie es de tinta en el tema claro: ahí el foco del enlace de apoyo es `on-charcoal` (papel), porque `focus` es tinta sobre tinta.
    const onFooter = computed('color', 'on-charcoal');
    const seen = new Set<Element>();
    for (let stop = 0; stop < 12; stop += 1) {
      await userEvent.tab();
      const active = document.activeElement;
      if (active === null || active === document.body || seen.has(active) || !host!.contains(active)) break;
      seen.add(active);
      const style = getComputedStyle(active);
      expect(active.matches(':focus-visible')).toBe(true);
      expect(style.outlineStyle, active.outerHTML.slice(0, 80)).not.toBe('none');
      const expected = theme === 'light' && active.matches('.site-footer__support-link') ? onFooter : focus;
      expect(style.outlineColor, active.outerHTML.slice(0, 80)).toBe(expected);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it.each(ALL_ROUTES)('RF-6 (002) · 6.6: en $path a 360 px no hay desplazamiento horizontal', async ({ path, as }) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await useAccount(as);
    await show(path);
    // Con cuenta, la ruta se monta sin redirigir ni caer en la pantalla de acceso.
    if (as !== undefined) expect(location.pathname + location.search).toBe(path);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    const wide = [...host!.querySelectorAll<HTMLElement>('*')]
      .filter((el) => !clippedByPath(el) && visibleRight(el) > innerWidth + 0.5)
      .map((el) => el.outerHTML.slice(0, 100));
    expect(wide).toEqual([]);
  });

  // La lista es la vista de lista del mapa (RF-10 (021)).
  it.each(['/?vista=lista', `/apices/${LONG_APICE_ID}`])('RF-6 (002) · 6.7: en %s a 360 px el nombre de 120 caracteres se ajusta sin cortarse ni desbordar su bloque', async (path) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(path);
    // En la lista el nombre va en su tarjeta; en la ficha, en el h1.
    const heading = await waitFor(() =>
      [...host!.querySelectorAll<HTMLElement>('main h1, main h2, main h3')].find((el) => el.textContent === LONG_NAME),
    );
    expect(getComputedStyle(heading).textOverflow).not.toBe('ellipsis');
    expectWrappedInside(heading, LONG_NAME, 2);
  });

  it.each(['/?vista=lista', `/apices/${LONG_APICE_ID}`])('RF-7 (002) · 7.2, D-T10 (002), RF-2 (021) · 2.1, D-T4 (021): en %s a 360 px toda superficie deja al menos 64 px para su patrón, con contorno de 0 o 2 px y dentro de su bloque', async (path) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(path);
    // La superficie es la celda de la fila de la lista (`.apice-card__celda`, de 56 px) o la celda grande de la ficha (`.celda-grande`, E3 · Celda).
    const surfaces = await waitFor(() => {
      // La miniatura de la fila de la columna (`.apice-row`, 30 px) no cuenta: no es una superficie de lectura.
      const found = [...host!.querySelectorAll<HTMLElement | SVGElement>('main .apice-card__celda .celda-superficie, main .superficie, main .celda-grande')].filter(
        (surface) => surface.getBoundingClientRect().width > 0 && surface.closest('.apice-row') === null,
      );
      return found.length > 0 ? found : null;
    });
    for (const surface of surfaces) {
      const box = surface.getBoundingClientRect();
      expect(box.width, surface.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(surface.matches('.celda-superficie') ? 56 : 64);
      expect(box.right).toBeLessThanOrEqual(innerWidth + 0.5);
      const owner = surface.closest('.block, .lot');
      if (owner !== null) expect(box.right).toBeLessThanOrEqual(owner.getBoundingClientRect().right + 0.5);
      // El contorno de la superficie: el borde de la fila o el trazo del hexágono de la celda.
      const outline = surface.matches('.celda-grande, .celda-superficie') ? getComputedStyle(surface.querySelector('.celda__contorno')!).strokeWidth : getComputedStyle(surface).borderTopWidth;
      expect(['0px', '2px']).toContain(outline);
      expect(surface.querySelector('img, canvas')).toBeNull();
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

  it('RF-3 (003) · 3.2, RF-2 (005) · 2.1: todo lote calcula fondo surface, radio 0, un filete de tinta de 1,5 px arriba, sin borde en los otros lados y ninguna sombra', async () => {
    const box = mount('<section class="lot"><p>Lote</p></section><div class="lot">Otro</div>');
    await settle();
    for (const lot of box.querySelectorAll<HTMLElement>('.lot')) {
      const style = getComputedStyle(lot);
      expect(style.borderRadius).toBe('0px');
      expect(style.backgroundColor).toBe(token(theme, 'surface'));
      expect(FILETE).toContain(style.borderTopWidth);
      expect(style.borderTopStyle).toBe('solid');
      expect(style.borderTopColor).toBe(token(theme, 'text'));
      for (const side of ['Right', 'Bottom', 'Left'] as const) expect(style[`border${side}Width`]).toBe('0px');
      expect(style.boxShadow).toBe('none');
    }
  });

  it('RF-3 (003) · 3.1: un bloque que contiene no es una caja: abre con un filete suave (trama) de 1,5 px y el aviso lo lleva de tinta', async () => {
    const box = mount('<article class="block">Fila</article><p class="block" role="status">Aviso</p><p class="block" role="alert">Error</p>');
    await settle();
    const [row, status, alert] = [...box.querySelectorAll<HTMLElement>('.block')].map((el) => getComputedStyle(el));
    expect(FILETE).toContain(row!.borderTopWidth);
    expect(row!.borderTopColor).toBe(token(theme, 'trama'));
    expect(status!.borderTopColor).toBe(token(theme, 'text'));
    // El error: filete de 2 px en tinta; la palabra lo nombra, no el color.
    expect(alert!.borderTopWidth).toBe('2px');
    expect(alert!.borderTopColor).toBe(token(theme, 'text'));
    for (const style of [row!, status!, alert!]) {
      expect(style.borderRadius).toBe('0px');
      expect(style.boxShadow).toBe('none');
      for (const side of ['Right', 'Bottom', 'Left'] as const) expect(style[`border${side}Width`]).toBe('0px');
    }
  });

  it('RF-4 (003) · 4.1: todo botón y enlace con forma de botón es recto, mide al menos 44 px de alto (la principal, 52), en mayúsculas', async () => {
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
      const style = getComputedStyle(el);
      expect(el.getBoundingClientRect().height, el.outerHTML).toBeGreaterThanOrEqual(el.matches('.action-primary') ? 52 : 44);
      expect(style.borderTopLeftRadius, el.outerHTML).toBe('0px');
      expect(style.textTransform, el.outerHTML).toBe('uppercase');
      expect(style.fontWeight, el.outerHTML).toBe('800');
    }
  });

  it('RF-4 (003) · 4.2: el botón principal es la barra de tinta: se rellena con action-blue (tinta), deja el texto en on-accent y su contorno de 2 px es de tinta', async () => {
    const box = mount('<button class="block action-primary">Principal</button>');
    await settle();
    const style = getComputedStyle(get(box, 'button'));
    expect(style.backgroundColor).toBe(token(theme, 'action-blue'));
    expect(style.color).toBe(token(theme, 'on-accent'));
    expect(style.borderTopWidth).toBe('2px');
    expect(style.borderTopColor).toBe(token(theme, 'text'));
    expect(style.boxShadow).toBe('none');
    expect(contrastRatio(TOKENS[theme]['on-accent'], TOKENS[theme]['action-blue'])).toBeGreaterThanOrEqual(4.5);
  });

  it('RF-4 (003) · 4.3: el botón secundario es texto subrayado de 2 px, sin fondo, sin borde y sin sombra, en tinta', async () => {
    const box = mount('<button class="block action-secondary">Secundario</button><a class="block action-secondary" href="#x">Enlace</a>');
    await settle();
    for (const el of box.querySelectorAll<HTMLElement>('button, a')) {
      const style = getComputedStyle(el);
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) expect(style[`border${side}Width`]).toBe('0px');
      expect(style.textDecorationLine).toBe('underline');
      expect(style.textDecorationStyle).toBe('solid');
      expect(style.textDecorationThickness).toBe('2px');
      expect(style.color).toBe(token(theme, 'text'));
      expect(style.boxShadow).toBe('none');
    }
  });

  it('RF-4 (003) · 4.4: el botón destructivo es el mismo texto subrayado con la raya discontinua, en tinta y sin borde', async () => {
    const box = mount('<button class="block action-destructive">Descartar</button>');
    await settle();
    const style = getComputedStyle(get(box, 'button'));
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.color).toBe(token(theme, 'brand-red'));
    expect(style.textDecorationLine).toBe('underline');
    // La forma lo distingue del secundario: la raya va discontinua (el color no es la única señal).
    expect(style.textDecorationStyle).toBe('dashed');
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) expect(style[`border${side}Width`]).toBe('0px');
  });

  it.each([['icon-button'], ['block icon-button']])('RF-4 (003) · 4.5: el botón de ícono «%s» mide 44 × 44, es cuadrado, sin borde ni caja, y pulsado lleva una raya de tinta de 4 px debajo', async (classes) => {
    const box = mount(`<button class="${classes}" aria-label="Cambiar tema">T</button><a class="${classes}" href="#x" aria-label="Mi tablero">M</a><button class="${classes}" aria-pressed="true" aria-label="Elegido">E</button>`);
    await settle();
    for (const el of box.querySelectorAll<HTMLElement>('button, a')) {
      const rect = el.getBoundingClientRect();
      expect(rect.width, el.outerHTML).toBe(44);
      expect(rect.height, el.outerHTML).toBe(44);
      const style = getComputedStyle(el);
      expect(style.borderTopLeftRadius, el.outerHTML).toBe('0px');
      expect(style.borderTopWidth, el.outerHTML).toBe('0px');
      expect(style.borderLeftWidth, el.outerHTML).toBe('0px');
      expect(style.backgroundColor, el.outerHTML).toBe('rgba(0, 0, 0, 0)');
      expect(style.borderBottomWidth, el.outerHTML).toBe(el.matches('[aria-pressed="true"]') ? '4px' : '0px');
      if (el.matches('[aria-pressed="true"]')) expect(style.borderBottomColor).toBe(token(theme, 'text'));
    }
  });

  it('RF-4 (003) · 4.3: al pasar el cursor, el texto subrayado engorda su raya (de 2 a 4 px) sin invertirse', async () => {
    const box = mount('<button class="block action-secondary">Secundario</button>');
    await settle();
    const button = get(box, 'button');
    await userEvent.hover(button);
    await settle();
    expect(getComputedStyle(button).textDecorationThickness).toBe('4px');
    expect(getComputedStyle(button).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(button).color).toBe(token(theme, 'text'));
    await userEvent.unhover(button);
  });

  it('RF-4 (003) · 4.7: con un diálogo abierto, el principal de fuera se ve secundario (papel con letra de tinta), el de dentro sigue en tinta y al cerrarlo el de fondo vuelve a tinta', async () => {
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
    // Conserva el contorno de 2 px de la barra: sin él la principal de fuera perdería su forma.
    expect(secondary.borderTopWidth).toBe('2px');
    expect(getComputedStyle(get(box, '#inside')).backgroundColor).toBe(token(theme, 'action-blue'));

    dialog.remove();
    await settle();
    expect(getComputedStyle(outside).backgroundColor).toBe(token(theme, 'action-blue'));
  });

  it.each([['input type="text"'], ['textarea'], ['select']])('RF-5 (003) · 5.1: «%s» se muestra sobre surface, con borde completo de 3 px field-border, sin radio y sin sombra', async (tag) => {
    const name = tag.split(' ')[0]!;
    const box = mount(`<${tag} class="block" aria-label="Campo">${name === 'input' ? '' : `</${name}>`}`);
    await settle();
    const style = getComputedStyle(get(box, name));
    expect(style.backgroundColor).toBe(token(theme, 'surface'));
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      expect(style[`border${side}Width`]).toBe('3px');
      expect(style[`border${side}Style`]).toBe('solid');
      expect(style[`border${side}Color`]).toBe(token(theme, 'field-border'));
    }
    expect(style.borderTopLeftRadius).toBe('0px');
    expect(style.boxShadow).toBe('none');
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(48);
  });

  it('RF-5 (003) · 5.1: field-border sobre background pasa 3:1', () => {
    expect(contrastRatio(TOKENS[theme]['field-border'], TOKENS[theme].background)).toBeGreaterThanOrEqual(3);
  });

  it('RF-5 (003) · 5.3: un campo con aria-invalid marca su borde con brand-red y una barra de 12 px a la izquierda', async () => {
    const box = mount('<input class="block" aria-label="Campo" aria-invalid="true" />');
    await settle();
    const style = getComputedStyle(get(box, 'input'));
    expect(style.borderBottomColor).toBe(token(theme, 'brand-red'));
    expect(style.borderBottomWidth).toBe('3px');
    expect(style.borderLeftWidth).toBe('12px');
    expect(style.borderTopWidth).toBe('3px');
  });

  it('RF-3 (003) · 3.1; D-T20 (003): con colores forzados el filete del bloque y del lote y la raya del ícono pulsado toman CanvasText', async () => {
    const box = mount('<article class="block">Bloque</article><section class="lot">Lote</section><button class="icon-button" aria-pressed="true" aria-label="Cerrar">x</button>');
    await emulate('forced-colors', 'active');
    try {
      expect(matchMedia('(forced-colors: active)').matches).toBe(true);
      await settle();
      const canvasText = systemColor('CanvasText');
      for (const element of box.querySelectorAll<HTMLElement>('.block, .lot')) {
        const style = getComputedStyle(element);
        expect(FILETE, element.className).toContain(style.borderTopWidth);
        expect(style.borderTopStyle, element.className).toBe('solid');
        expect(style.borderTopColor, element.className).toBe(canvasText);
        for (const side of ['Right', 'Bottom', 'Left'] as const) expect(style[`border${side}Width`], element.className).toBe('0px');
      }
      const icon = getComputedStyle(get(box, '.icon-button'));
      expect(icon.borderBottomWidth).toBe('4px');
      expect(icon.borderBottomStyle).toBe('solid');
      expect(icon.borderBottomColor).toBe(canvasText);
    } finally {
      await emulate('forced-colors', 'none');
    }
  });

  it('RF-3 (003) · 3.1, 3.2; RNF-1 (003); D-T20 (003): con contraste aumentado, el filete suave del bloque pasa a tinta, el del lote sigue en tinta y el campo deshabilitado pasa a tinta', async () => {
    const box = mount('<article class="block">Bloque</article><section class="lot">Lote</section><input class="block" aria-label="Quieto" disabled />');
    await emulate('prefers-contrast', 'more');
    try {
      expect(matchMedia('(prefers-contrast: more)').matches).toBe(true);
      await settle();
      for (const el of box.querySelectorAll<HTMLElement>('.block, .lot')) {
        const style = getComputedStyle(el);
        const field = el.matches('input');
        if (field) expect(style.borderTopWidth, el.className).toBe('3px');
        else expect(FILETE, el.className).toContain(style.borderTopWidth);
        expect(style.borderTopColor, el.className).toBe(token(theme, 'text'));
      }
    } finally {
      await emulate('prefers-contrast', 'no-preference');
    }
  });
});
