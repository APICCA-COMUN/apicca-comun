// Cabecera en Chromium real (RF-7 (003) · 7.1, 7.4, 7.8): sin sombra ni recuadro sobre el fondo, enlace vigente con
// peso 800 y subrayado de 3 px, y a 360 px (y al 200 %) todos los enlaces y botones visibles, sin desplazamiento
// horizontal ni texto cortado, aunque pase a varias líneas. Monta `SiteHeader` con sesión de prueba, sin siembra.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { THEMES, TOKENS, hexToRgb } from '../../shared/domain/identity';
import { SessionProvider, type SessionState } from '../../src/app/session';
import { SiteHeader } from '../../src/components/SiteHeader';
import { MAIN_MENU } from '../../shared/domain/navigation';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'usuaria_con_nombre_largo_24' };
const VISITOR: SessionState = { status: 'visitor' };

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

/** Monta la cabecera con la sesión dada en la ruta dada. */
async function show(session: SessionState, path: string) {
  history.replaceState(null, '', path);
  const mounted = root!;
  // Desde cero en cada caso: el estado del menú («Menú» abierto) no pasa de una prueba a otra.
  await actNow(() => mounted.render(<></>));
  await actNow(() =>
    mounted.render(
      <SessionProvider initial={session}>
        <SiteHeader />
      </SessionProvider>,
    ),
  );
  await new Promise((done) => setTimeout(done, 50));
}

const header = () => host!.querySelector<HTMLElement>('header')!;
const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;

beforeAll(() => {
  previousPath = location.pathname + location.search;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  document.documentElement.style.fontSize = '';
});

afterAll(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  delete document.documentElement.dataset['theme'];
  history.replaceState(null, '', previousPath);
  await page.viewport(1280, 800);
});

describe.each(THEMES)('cabecera en el tema %s', (theme) => {
  it('RF-7 (003) · 7.1: la cabecera va sobre el fondo de la página, sin sombra ni recuadro', async () => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await show(PERSON, '/documentacion');
    const style = getComputedStyle(header());
    expect(style.boxShadow).toBe('none');
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      expect(style[`border${side}Width`], side).toBe('0px');
    }
    expect(['rgba(0, 0, 0, 0)', 'transparent', rgb(TOKENS[theme]['background'])]).toContain(style.backgroundColor);
  });

  it('RF-7 (003) · 7.4: el enlace vigente calcula peso 800 y subrayado de 3 px; los demás no', async () => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await show(PERSON, '/documentacion/etica');
    const current = header().querySelector<HTMLElement>('nav a[aria-current="page"]')!;
    expect(current.textContent).toBe('Documentación');
    const style = getComputedStyle(current);
    expect(style.fontWeight).toBe('800');
    expect(style.textDecorationLine).toContain('underline');
    expect(style.textDecorationThickness).toBe('3px');
    for (const other of header().querySelectorAll<HTMLElement>('nav a:not([aria-current])')) {
      expect(getComputedStyle(other).fontWeight, other.textContent!).not.toBe('800');
      expect(getComputedStyle(other).textDecorationLine, other.textContent!).not.toContain('underline');
    }
  });

  it.each([
    ['con sesión', PERSON],
    ['sin sesión', VISITOR],
  ])('RF-7 (003) · 7.8, RF-21 (019) · 21.1: a 360 px %s los controles visibles y, tras abrir «Menú», los destinos se ven completos, sin desplazamiento horizontal', async (_name, session) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(session, '/constitucion');
    const toggle = [...header().querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Menú');
    await actNow(() => toggle?.click());
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    const controls = [...header().querySelectorAll<HTMLElement>('a, button')].filter((control) => control.getBoundingClientRect().width > 0);
    expect(controls.length).toBeGreaterThanOrEqual(6);
    for (const control of controls) {
      const box = control.getBoundingClientRect();
      expect(box.width, control.outerHTML.slice(0, 80)).toBeGreaterThan(0);
      expect(box.left, control.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(-0.5);
      expect(box.right, control.outerHTML.slice(0, 80)).toBeLessThanOrEqual(innerWidth + 0.5);
      expect(control.scrollWidth, control.outerHTML.slice(0, 80)).toBeLessThanOrEqual(control.clientWidth + 1);
    }
  });

  it('RF-7 (003) · 7.8: al 200 % (ventana de 640 px con letra al doble) la cabecera no desborda', async () => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(640, 800);
    document.documentElement.style.fontSize = '200%';
    await show(PERSON, '/prototipado');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    for (const control of header().querySelectorAll<HTMLElement>('a, button')) {
      expect(control.getBoundingClientRect().right, control.outerHTML.slice(0, 80)).toBeLessThanOrEqual(innerWidth + 0.5);
    }
  });
});

// RF-21 (019), D-12 (019), D-T14 (019): la cabecera cabe en una fila desde 360 px. Por debajo de 1024 px, los destinos
// se reúnen tras el botón «Menú», con `aria-expanded`; Esc lo cierra y devuelve el foco al botón.
const visible = (element: Element) => {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
};

/** Los controles visibles de la cabecera cuyas franjas verticales no se cruzan con las de todos los demás. */
function rows(): string[] {
  const items = [...header().querySelectorAll<HTMLElement>('a, button')].filter(visible);
  const top = Math.max(...items.map((item) => item.getBoundingClientRect().top));
  const bottom = Math.min(...items.map((item) => item.getBoundingClientRect().bottom));
  return top < bottom ? [] : items.map((item) => `${item.textContent?.trim() || item.getAttribute('aria-label')}: ${Math.round(item.getBoundingClientRect().top)}–${Math.round(item.getBoundingClientRect().bottom)}`);
}

const menuButton = () => [...header().querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Menú');
const destinations = (session: SessionState) => MAIN_MENU.filter((item) => session.status === 'person' || !item.requiresSession).map((item) => item.label);

describe('RF-21 (019) · cabecera compacta', () => {
  it.each([360, 1023, 1024, 1280].flatMap((width) => [[width, 'con sesión', PERSON], [width, 'sin sesión', VISITOR]] as const))(
    'RF-21 (019) · 21.1: a %i px, %s, la cabecera cabe en una sola fila',
    async (width, _name, session) => {
      await page.viewport(width, 800);
      await show(session, '/prototipado');
      expect(rows()).toEqual([]);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    },
  );

  it.each([[1024, PERSON], [1280, VISITOR]] as const)('RF-21 (019) · 21.2: a %i px los destinos se ven en la fila, sin «Menú»', async (width, session) => {
    await page.viewport(width, 800);
    await show(session, '/prototipado');
    expect(menuButton() === undefined || !visible(menuButton()!)).toBe(true);
    const links = [...header().querySelectorAll<HTMLElement>('nav a')].filter(visible).map((link) => link.textContent);
    expect(links).toEqual(destinations(session));
  });

  it.each([
    ['con sesión', PERSON],
    ['sin sesión', VISITOR],
  ])('RF-21 (019) · 21.2, 21.3: a 360 px, %s, «Menú» despliega los destinos y Esc lo cierra y devuelve el foco', async (_name, session) => {
    await page.viewport(360, 800);
    await show(session, '/prototipado');
    const button = menuButton();
    expect(button, 'botón «Menú»').toBeDefined();
    expect(visible(button!)).toBe(true);
    expect(button!.getAttribute('aria-expanded')).toBe('false');
    expect([...header().querySelectorAll<HTMLElement>('nav a')].filter(visible)).toHaveLength(0);

    button!.focus();
    await userEvent.keyboard('{Enter}');
    await new Promise((done) => setTimeout(done, 50));
    expect(button!.getAttribute('aria-expanded')).toBe('true');
    const links = [...header().querySelectorAll<HTMLElement>('nav a')].filter(visible);
    expect(links.map((link) => link.textContent)).toEqual(destinations(session));
    for (const link of links) {
      expect(link.getBoundingClientRect().height, link.textContent!).toBeGreaterThanOrEqual(44);
      expect(link.getBoundingClientRect().right, link.textContent!).toBeLessThanOrEqual(innerWidth + 0.5);
    }

    links[0]!.focus();
    await userEvent.keyboard('{Escape}');
    await new Promise((done) => setTimeout(done, 50));
    expect(button!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });
});
