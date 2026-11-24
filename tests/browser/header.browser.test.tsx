// Cabecera en Chromium real (RF-7 (003) · 7.1, 7.4, 7.8, RF-16 (021) · 16.2, RF-13 (021)): sobre el papel, sin sombra y
// con un solo borde, el inferior de 3 px en tinta, en una fila con el logo, la navegación, el tema, la cuenta y «Menú»; el
// menú plegado abre un diálogo con los destinos, el vigente con peso 800 y borde inferior de 3 px; a 360 px (y al 200 %)
// todo visible, sin desplazamiento horizontal ni texto cortado. Monta `SiteHeader` con sesión de prueba, sin siembra.
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
  it('RF-7 (003) · 7.1: la cabecera va sobre el fondo de la página, sin sombra y con un solo borde, el inferior de 3 px en tinta', async () => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await show(PERSON, '/documentacion');
    const style = getComputedStyle(header());
    expect(style.boxShadow).toBe('none');
    for (const side of ['Top', 'Right', 'Left'] as const) {
      expect(style[`border${side}Width`], side).toBe('0px');
    }
    expect(style.borderBottomWidth).toBe('3px');
    expect(style.borderBottomStyle).toBe('solid');
    expect(style.borderBottomColor).toBe(rgb(TOKENS[theme]['text']));
    expect(['rgba(0, 0, 0, 0)', 'transparent', rgb(TOKENS[theme]['background'])]).toContain(style.backgroundColor);
  });

  it('RF-7 (003) · 7.4, RF-13 (021) · 13.1: en el menú, el destino vigente calcula peso 800 y borde inferior de 3 px en tinta; los demás no', async () => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
    await show(PERSON, '/documentacion/etica');
    await actNow(() => menuButton()?.click());
    const current = menuDialog().querySelector<HTMLElement>('nav a[aria-current="page"]')!;
    expect(current.textContent).toBe('Documentación');
    const style = getComputedStyle(current);
    expect(style.fontWeight).toBe('800');
    expect(style.borderBottomWidth).toBe('3px');
    expect(style.borderBottomStyle).toBe('solid');
    expect(style.borderBottomColor).toBe(style.color);
    for (const other of menuDialog().querySelectorAll<HTMLElement>('nav a:not([aria-current])')) {
      expect(getComputedStyle(other).fontWeight, other.textContent!).not.toBe('800');
      expect(getComputedStyle(other).borderBottomColor, other.textContent!).toBe('rgba(0, 0, 0, 0)');
    }
  });

  it.each([
    ['con sesión', PERSON],
    ['sin sesión', VISITOR],
  ])('RF-7 (003) · 7.8, RF-16 (021) · 16.2, RF-13 (021) · 13.6: a 360 px %s los controles visibles y, tras abrir «Menú», los destinos se ven completos, sin desplazamiento horizontal', async (_name, session) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(session, '/constitucion');
    await actNow(() => menuButton()?.click());
    expect(menuDialog().open).toBe(true);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    const controls = [...header().querySelectorAll<HTMLElement>('a, button')].filter((control) => control.getBoundingClientRect().width > 0);
    expect(controls.length).toBeGreaterThanOrEqual(8);
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
    await show(PERSON, '/documentacion');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    for (const control of header().querySelectorAll<HTMLElement>('a, button')) {
      expect(control.getBoundingClientRect().right, control.outerHTML.slice(0, 80)).toBeLessThanOrEqual(innerWidth + 0.5);
    }
  });
});

// RF-21 (019) · 21.1, RF-16 (021) · 16.2, RF-13 (021) · 13.6, 13.7: la cabecera cabe en una fila desde 360 px y «Menú»
// se ve en todo ancho; abre un diálogo con los destinos de 44 px o más, y Esc lo cierra y devuelve el foco al botón.
const visible = (element: Element) => {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
};

/** Los controles visibles de la cabecera, fuera del menú, cuyas franjas verticales no se cruzan con las de todos los demás. */
function rows(): string[] {
  const items = [...header().querySelectorAll<HTMLElement>('a, button')].filter((item) => visible(item) && item.closest('dialog') === null);
  const top = Math.max(...items.map((item) => item.getBoundingClientRect().top));
  const bottom = Math.min(...items.map((item) => item.getBoundingClientRect().bottom));
  return top < bottom ? [] : items.map((item) => `${item.textContent?.trim() || item.getAttribute('aria-label')}: ${Math.round(item.getBoundingClientRect().top)}–${Math.round(item.getBoundingClientRect().bottom)}`);
}

function menuButton() {
  return [...header().querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Menú');
}
function menuDialog() {
  return header().querySelector<HTMLDialogElement>('dialog.game-menu')!;
}
const destinations = MAIN_MENU.map((item) => item.label);

describe('RF-21 (019) · cabecera compacta', () => {
  it.each([360, 1023, 1024, 1280].flatMap((width) => [[width, 'con sesión', PERSON], [width, 'sin sesión', VISITOR]] as const))(
    'RF-21 (019) · 21.1, RF-16 (021) · 16.2: a %i px, %s, la cabecera cabe en una sola fila',
    async (width, _name, session) => {
      await page.viewport(width, 800);
      await show(session, '/documentacion');
      expect(rows()).toEqual([]);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
      expect(visible(menuButton()!), '«Menú»').toBe(true);
      const logo = header().querySelector<HTMLElement>('a[aria-label$="ir al inicio"]')!;
      expect(logo.getAttribute('href')).toBe('/');
      // Una sola fila de 64 px: el borde de 3 px incluido.
      expect(header().getBoundingClientRect().height).toBeLessThanOrEqual(66);
    },
  );

  it.each([
    ['con sesión', PERSON],
    ['sin sesión', VISITOR],
  ])('RF-13 (021) · 13.1, 13.6, 13.7: a 360 px, %s, «Menú» abre los destinos y Esc lo cierra y devuelve el foco', async (_name, session) => {
    await page.viewport(360, 800);
    await show(session, '/documentacion');
    const button = menuButton();
    expect(button, 'botón «Menú»').toBeDefined();
    expect(visible(button!)).toBe(true);
    expect(button!.getAttribute('aria-haspopup')).toBe('dialog');
    expect([...header().querySelectorAll<HTMLElement>('nav a')].filter(visible)).toHaveLength(0);

    button!.focus();
    await userEvent.keyboard('{Enter}');
    await new Promise((done) => setTimeout(done, 50));
    expect(menuDialog().open).toBe(true);
    const links = [...menuDialog().querySelectorAll<HTMLElement>('nav a')].filter(visible);
    expect(links.map((link) => link.textContent)).toEqual(destinations);
    for (const link of links) {
      expect(link.getBoundingClientRect().height, link.textContent!).toBeGreaterThanOrEqual(44);
      expect(link.getBoundingClientRect().right, link.textContent!).toBeLessThanOrEqual(innerWidth + 0.5);
    }

    links[0]!.focus();
    await userEvent.keyboard('{Escape}');
    await new Promise((done) => setTimeout(done, 50));
    expect(menuDialog().open).toBe(false);
    expect(document.activeElement).toBe(button);
  });
});
