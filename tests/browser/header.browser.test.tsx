// Cabecera en Chromium real (RF-7 (003) · 7.1, 7.4, 7.8): sin sombra ni recuadro sobre el fondo, enlace vigente con
// peso 800 y subrayado de 3 px, y a 360 px (y al 200 %) todos los enlaces y botones visibles, sin desplazamiento
// horizontal ni texto cortado, aunque pase a varias líneas. Monta `SiteHeader` con sesión de prueba, sin siembra.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
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
  ])('RF-7 (003) · 7.8: a 360 px %s todos los enlaces y botones se ven completos, sin desplazamiento horizontal', async (_name, session) => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(360, 800);
    await show(session, '/constitucion');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    const controls = [...header().querySelectorAll<HTMLElement>('a, button')];
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
