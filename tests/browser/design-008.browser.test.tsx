// Medidas de la spec 008 en Chromium real: controles de 48 px, botones de ícono de 44 px y foco a 3 px (RF-2 (008),
// RF-3 (008)), cabecera y pie (RF-4 (008), RF-5 (008)) inicio (RF-6 (008)) entrar (RF-7 (008)) Mi tablero (RF-8 (008)) Prototipado (RF-9 (008)) Documentación (RF-10 (008)) y Constitución (RF-11 (008)), a 360 y 1280 px. Cada página suma aquí sus medidas al llegar su turno (D-5 (008)).
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/paths.css';
import { SessionProvider, type SessionState } from '../../src/app/session';
import { SiteHeader } from '../../src/components/SiteHeader';
import { SiteFooter } from '../../src/components/SiteFooter';
import { Home } from '../../src/pages/Home';
import { LoginPage } from '../../src/pages/Login';
import { Dashboard } from '../../src/pages/Dashboard';
import { Prototyping } from '../../src/pages/Prototyping';
import { Documentation } from '../../src/pages/Documentation';
import { ConstitutionPage } from '../../src/pages/ConstitutionPage';
import { NO_NOTICE } from '../../src/data/constitution/notice';

let bench: HTMLDivElement | undefined;

/** Monta HTML de prueba aparte de la app y devuelve el contenedor. */
function mount(html: string): HTMLDivElement {
  bench?.remove();
  bench = document.createElement('div');
  bench.innerHTML = html;
  document.body.append(bench);
  return bench;
}

afterEach(async () => {
  bench?.remove();
  bench = undefined;
  document.documentElement.removeAttribute('data-theme');
  await page.viewport(1280, 800);
});

describe.each([360, 1280])('controles a %i px', (width) => {
  it('RF-2 (008) · 2.1: todo botón y enlace con forma de botón mide 48 px de alto', async () => {
    await page.viewport(width, 800);
    const box = mount(`
      <button class="block action-primary">Principal</button>
      <button class="block action-secondary">Secundario</button>
      <button class="block action-destructive">Destructivo</button>
      <a class="block action-secondary" href="#x">Enlace</a>`);
    const all = [...box.querySelectorAll<HTMLElement>('button, a')];
    expect(all).toHaveLength(4);
    for (const el of all) expect(el.getBoundingClientRect().height, el.outerHTML).toBe(48);
  });

  it('RF-2 (008) · 2.2: el botón de ícono sigue midiendo 44 × 44', async () => {
    await page.viewport(width, 800);
    const box = mount('<button class="icon-button" aria-label="Cambiar tema">T</button>');
    const rect = box.querySelector('button')!.getBoundingClientRect();
    expect([rect.width, rect.height]).toEqual([44, 44]);
  });

  it.each([['input type="text"'], ['select']])('RF-2 (008) · 2.3: «%s» mide 48 px y redondea 10 px arriba y nada abajo', async (tag) => {
    await page.viewport(width, 800);
    const name = tag.split(' ')[0]!;
    const box = mount(`<${tag} class="block" aria-label="Campo">${name === 'input' ? '' : `</${name}>`}`);
    const el = box.querySelector<HTMLElement>(name)!;
    const style = getComputedStyle(el);
    expect(el.getBoundingClientRect().height).toBe(48);
    expect(style.borderTopLeftRadius).toBe('10px');
    expect(style.borderTopRightRadius).toBe('10px');
    expect(style.borderBottomLeftRadius).toBe('0px');
  });

  it('RF-2 (008) · 2.3: el área de texto mide 48 px como mínimo', async () => {
    await page.viewport(width, 800);
    const box = mount('<textarea class="block" rows="1" aria-label="Campo"></textarea>');
    const el = box.querySelector('textarea')!;
    expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el).borderTopLeftRadius).toBe('10px');
  });

  it('RF-3 (008) · 3.1: el foco de teclado es un contorno de 3 px separado 3 px', async () => {
    await page.viewport(width, 800);
    const box = mount('<button class="block action-secondary">Uno</button><button class="block action-secondary">Dos</button>');
    box.querySelector('button')!.focus();
    await userEvent.keyboard('{Tab}');
    const active = document.activeElement as HTMLElement;
    expect(active.textContent).toBe('Dos');
    const style = getComputedStyle(active);
    expect(style.outlineWidth).toBe('3px');
    expect(style.outlineOffset).toBe('3px');
  });
});

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const VISITOR: SessionState = { status: 'visitor' };

/** Monta cabecera y pie reales con la sesión dada, en la ruta dada. */
async function showChrome(session: SessionState, path = '/prototipado') {
  history.replaceState(null, '', path);
  bench?.remove();
  bench = document.createElement('div');
  document.body.append(bench);
  const root = createRoot(bench);
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      root.render(
        <SessionProvider initial={session}>
          <SiteHeader />
          <SiteFooter />
        </SessionProvider>,
      );
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
  await new Promise((done) => setTimeout(done, 50));
  return bench;
}

describe.each([360, 1280])('cabecera y pie a %i px', (width) => {
  it('RF-4 (008) · 4.1: la cabecera usa una columna de 1200 px como máximo, con 20 px arriba y abajo y margen lateral fluido', async () => {
    await page.viewport(width, 800);
    const box = await showChrome(VISITOR);
    const inner = box.querySelector<HTMLElement>('header > .site-header__inner')!;
    const style = getComputedStyle(inner);
    expect(style.maxWidth).toBe('1200px');
    expect(style.paddingTop).toBe('20px');
    expect(style.paddingBottom).toBe('20px');
    expect(style.paddingLeft).toBe(width === 1280 ? '48px' : '16px');
    expect(style.paddingRight).toBe(style.paddingLeft);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });

  it('RF-4 (008) · 4.2, 4.3: enlaces de 16/700 y 44 px de alto; el vigente en 800 con subrayado de 3 px a 8 px', async () => {
    await page.viewport(width, 800);
    const box = await showChrome(VISITOR, '/prototipado');
    const links = [...box.querySelectorAll<HTMLElement>('header nav a')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const style = getComputedStyle(link);
      expect(style.fontSize, link.textContent!).toBe('16px');
      expect(link.getBoundingClientRect().height, link.textContent!).toBe(44);
      expect(style.paddingLeft).toBe('10px');
    }
    const current = box.querySelector<HTMLElement>('header nav a[aria-current="page"]')!;
    const style = getComputedStyle(current);
    expect(style.fontWeight).toBe('800');
    expect(style.textDecorationLine).toBe('underline');
    expect(style.textDecorationThickness).toBe('3px');
    expect(style.textUnderlineOffset).toBe('8px');
    const other = links.find((l) => l !== current)!;
    expect(getComputedStyle(other).fontWeight).toBe('700');
  });

  it('RF-4 (008) · 4.4: «Entrar» mide 44 px de alto', async () => {
    await page.viewport(width, 800);
    const box = await showChrome(VISITOR);
    const enter = box.querySelector<HTMLElement>('header .site-header__actions a.block')!;
    expect(enter.getBoundingClientRect().height).toBe(44);
  });

  it('RF-4 (008) · 4.5: la inicial es un círculo de 44 px, de axis-alimento-fill, con letra charcoal de 18/800', async () => {
    await page.viewport(width, 800);
    const box = await showChrome(PERSON);
    const probe = document.createElement('i');
    probe.style.cssText = 'background-color:var(--axis-alimento-fill);color:var(--charcoal)';
    box.append(probe);
    const expected = getComputedStyle(probe);
    const avatar = box.querySelector<HTMLElement>('header a.account-initial')!;
    const rect = avatar.getBoundingClientRect();
    const style = getComputedStyle(avatar);
    expect([rect.width, rect.height]).toEqual([44, 44]);
    expect(style.borderTopLeftRadius).toBe('50%');
    expect(style.backgroundColor).toBe(expected.backgroundColor);
    expect(style.color).toBe(expected.color);
    expect(style.fontSize).toBe('18px');
    expect(style.fontWeight).toBe('800');
  });

  it('RF-5 (008) · 5.1–5.2: el pie usa footer-bg y una columna de 1200 px con 28 px arriba y abajo', async () => {
    await page.viewport(width, 800);
    const box = await showChrome(VISITOR);
    const probe = document.createElement('i');
    probe.style.cssText = 'background-color:var(--footer-bg)';
    box.append(probe);
    const expected = getComputedStyle(probe);
    const footer = box.querySelector<HTMLElement>('footer')!;
    expect(getComputedStyle(footer).backgroundColor).toBe(expected.backgroundColor);
    const inner = footer.querySelector<HTMLElement>('.site-footer__inner')!;
    const style = getComputedStyle(inner);
    expect(style.maxWidth).toBe('1200px');
    expect(style.paddingTop).toBe('28px');
    expect(style.paddingBottom).toBe('28px');
    expect(style.paddingLeft).toBe(width === 1280 ? '48px' : '16px');
  });
});

/** Monta el inicio con la sesión dada. */
async function showHome(session: SessionState) {
  bench?.remove();
  bench = document.createElement('div');
  document.body.append(bench);
  const root = createRoot(bench);
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      root.render(
        <SessionProvider initial={session}>
          <main>
            <Home />
          </main>
        </SessionProvider>,
      );
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
  return bench;
}

/** `clamp(min, vw, max)` en píxeles con el ancho real de la ventana (`vw` mide `innerWidth`). */
const clampPx = (min: number, vw: number, max: number, _width: number) => Math.min(max, Math.max(min, (vw / 100) * window.innerWidth));

describe.each([360, 1280])('inicio a %i px', (width) => {
  it('RF-6 (008) · 6.1: cada sección deja debajo clamp(64px, 10vw, 140px)', async () => {
    await page.viewport(width, 800);
    const box = await showHome(VISITOR);
    const probe = document.createElement('i');
    probe.style.marginBottom = 'clamp(64px, 10vw, 140px)';
    box.append(probe);
    const expected = getComputedStyle(probe).marginBottom;
    const sections = [...box.querySelectorAll<HTMLElement>('.home__hero, .home__section')];
    expect(sections).toHaveLength(3);
    for (const el of sections) expect(getComputedStyle(el).marginBottom, el.className).toBe(expected);
  });

  it('RF-6 (008) · 6.2: el título principal usa clamp(36px, 5vw, 64px), línea 1,05 y peso 800; la entrada es lead, text-muted y de 28em como máximo', async () => {
    await page.viewport(width, 800);
    const box = await showHome(VISITOR);
    const h1 = getComputedStyle(box.querySelector('h1')!);
    const size = clampPx(36, 5, 64, width);
    expect(parseFloat(h1.fontSize)).toBeCloseTo(size, 1);
    expect(parseFloat(h1.lineHeight)).toBeCloseTo(size * 1.05, 1);
    expect(h1.fontWeight).toBe('800');
    const probe = document.createElement('i');
    probe.style.color = 'var(--text-muted)';
    box.append(probe);
    const lead = getComputedStyle(box.querySelector('.home__hero-text p')!);
    expect(lead.fontSize).toBe('18px');
    expect(lead.color).toBe(getComputedStyle(probe).color);
    expect(parseFloat(lead.maxWidth)).toBeCloseTo(28 * 18, 1);
  });

  it('RF-6 (008) · 6.3: los títulos de sección usan clamp(28px, 3.6vw, 44px), línea 1,12 y peso 800', async () => {
    await page.viewport(width, 800);
    const box = await showHome(VISITOR);
    const size = clampPx(28, 3.6, 44, width);
    const titles = box.querySelectorAll('.home__section h2');
    expect(titles).toHaveLength(2);
    for (const h2 of titles) {
      const style = getComputedStyle(h2);
      expect(parseFloat(style.fontSize)).toBeCloseTo(size, 1);
      expect(parseFloat(style.lineHeight)).toBeCloseTo(size * 1.12, 1);
      expect(style.fontWeight).toBe('800');
    }
  });

  it('RF-6 (008) · 6.4, 6.9: las tarjetas de eje usan subheading en peso 800; los pasos, título de 22 px y texto en cuerpo', async () => {
    await page.viewport(width, 800);
    const box = await showHome(VISITOR);
    const axis = getComputedStyle(box.querySelector('.home__axis h3')!);
    expect(axis.fontSize).toBe('20px');
    expect(axis.fontWeight).toBe('800');
    const title = getComputedStyle(box.querySelector('.home__step-text h3')!);
    expect(title.fontSize).toBe('22px');
    expect(title.fontWeight).toBe('800');
    expect(getComputedStyle(box.querySelector('.home__step-text p')!).fontSize).toBe('16px');
  });

  it('RF-6 (008) · 6.5: los enlaces de texto van subrayados, en text, 16/700 y de 44 px como mínimo', async () => {
    await page.viewport(width, 800);
    const box = await showHome(VISITOR);
    const probe = document.createElement('i');
    probe.style.color = 'var(--text)';
    box.append(probe);
    const links = [...box.querySelectorAll<HTMLElement>('.home__actions > a:not(.block), .home__closing a')];
    expect(links).toHaveLength(2);
    for (const link of links) {
      const style = getComputedStyle(link);
      expect(style.textDecorationLine).toBe('underline');
      expect(style.color).toBe(getComputedStyle(probe).color);
      expect(style.fontSize).toBe('16px');
      expect(style.fontWeight).toBe('700');
      expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });
});

describe.each([360, 1280])('inicio, cierre a %i px', (width) => {
  it('RF-6 (008) · 6.10: el título de cierre usa clamp(32px, 5vw, 64px), línea 1,08, peso 800, centrado y de 14em como máximo', async () => {
    await page.viewport(width, 800);
    const box = await showHome(VISITOR);
    const h2 = getComputedStyle(box.querySelector('.home__closing h2')!);
    const size = clampPx(32, 5, 64, width);
    expect(parseFloat(h2.fontSize)).toBeCloseTo(size, 1);
    expect(parseFloat(h2.lineHeight)).toBeCloseTo(size * 1.08, 1);
    expect(h2.fontWeight).toBe('800');
    expect(parseFloat(h2.maxWidth)).toBeCloseTo(14 * size, 1);
    expect(getComputedStyle(box.querySelector('.home__closing')!).alignItems).toBe('center');
  });
});

describe.each([360, 1280])('entrar a %i px', (width) => {
  async function showLogin() {
    bench?.remove();
    bench = document.createElement('div');
    document.body.append(bench);
    const root = createRoot(bench);
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    scope.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(
          <SessionProvider initial={VISITOR}>
            <main>
              <LoginPage />
            </main>
          </SessionProvider>,
        );
      });
    } finally {
      scope.IS_REACT_ACT_ENVIRONMENT = false;
    }
    return bench;
  }

  it('RF-7 (008) · 7.1: el lote mide 440 px como máximo, centrado, con clamp(48px, 8vw, 96px) arriba y abajo', async () => {
    await page.viewport(width, 800);
    const box = await showLogin();
    const probe = document.createElement('i');
    probe.style.marginTop = 'clamp(48px, 8vw, 96px)';
    box.append(probe);
    const expected = getComputedStyle(probe).marginTop;
    const lot = box.querySelector<HTMLElement>('main > .lot')!;
    const style = getComputedStyle(lot);
    expect(parseFloat(style.maxWidth)).toBe(440);
    expect(lot.getBoundingClientRect().width).toBeLessThanOrEqual(440);
    expect(style.marginTop).toBe(expected);
    expect(style.marginBottom).toBe(expected);
  });

  it('RF-7 (008) · 7.2: el título mide clamp(28px, 4vw, 34px) en peso 800 y las etiquetas, 14 px en peso 700', async () => {
    await page.viewport(width, 800);
    const box = await showLogin();
    const probe = document.createElement('i');
    probe.style.fontSize = 'clamp(28px, 4vw, 34px)';
    box.append(probe);
    const h1 = getComputedStyle(box.querySelector('h1')!);
    expect(h1.fontSize).toBe(getComputedStyle(probe).fontSize);
    expect(h1.fontWeight).toBe('800');
    const labels = [...box.querySelectorAll<HTMLElement>('.sign-in-form label')];
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      const style = getComputedStyle(label);
      expect(style.fontSize).toBe('14px');
      expect(style.fontWeight).toBe('700');
    }
  });

  it('RF-7 (008) · 7.3: los campos se separan 18 px entre sí', async () => {
    await page.viewport(width, 800);
    const box = await showLogin();
    const email = box.querySelector<HTMLElement>('input[type="email"]')!.closest('label')!.getBoundingClientRect();
    const passwordWrap = box.querySelector<HTMLElement>('.sign-in-form__password')!.getBoundingClientRect();
    expect(passwordWrap.top - email.bottom).toBe(18);
    const submit = box.querySelector<HTMLElement>('.sign-in-form > button[type="submit"]')!.getBoundingClientRect();
    expect(submit.top - passwordWrap.bottom).toBe(18);
  });

  it('RF-7 (008) · 7.4: «Mostrar contraseña» mide 44 px, va dentro del campo, a la derecha, y el texto no lo pisa', async () => {
    await page.viewport(width, 800);
    const box = await showLogin();
    const input = box.querySelector<HTMLInputElement>('input[type="password"]')!;
    const field = input.getBoundingClientRect();
    const eye = box.querySelector<HTMLElement>('.sign-in-form__reveal')!.getBoundingClientRect();
    expect([eye.width, eye.height]).toEqual([44, 44]);
    expect(field.height).toBe(48);
    expect(eye.left).toBeGreaterThanOrEqual(field.left);
    expect(eye.right).toBeLessThanOrEqual(field.right);
    expect(eye.top).toBeGreaterThanOrEqual(field.top);
    expect(eye.bottom).toBeLessThanOrEqual(field.bottom);
    expect(field.right - eye.right).toBeLessThanOrEqual(8);
    expect(parseFloat(getComputedStyle(input).paddingRight)).toBeGreaterThanOrEqual(field.right - eye.left);
  });
});

describe.each([
  [360, 'light'],
  [1280, 'light'],
  [360, 'dark'],
  [1280, 'dark'],
] as const)('Mi tablero a %i px, tema %s', (width, theme) => {
  async function showDashboard() {
    document.documentElement.setAttribute('data-theme', theme);
    await page.viewport(width, 800);
    bench?.remove();
    bench = document.createElement('div');
    document.body.append(bench);
    const root = createRoot(bench);
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    scope.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(
          <SessionProvider initial={PERSON}>
            <main>
              <Dashboard
                source={{ fetchPage: async () => ({ items: [], cursor: null }) }}
                noticeSource={{ fetchNotice: async () => NO_NOTICE }}
              />
            </main>
          </SessionProvider>,
        );
      });
    } finally {
      scope.IS_REACT_ACT_ENVIRONMENT = false;
    }
    await new Promise((done) => setTimeout(done, 50));
    return bench;
  }

  /** Valor calculado de una propiedad de longitud con la expresión dada. */
  function resolve(box: HTMLElement, property: 'marginTop' | 'fontSize', expression: string): string {
    const probe = document.createElement('i');
    probe.style[property] = expression;
    box.append(probe);
    const value = getComputedStyle(probe)[property];
    probe.remove();
    return value;
  }

  it('RF-8 (008) · 8.1: el contenido deja clamp(32px, 5vw, 64px) arriba y clamp(64px, 10vw, 140px) abajo', async () => {
    const box = await showDashboard();
    expect(getComputedStyle(box.querySelector('.dashboard')!).paddingTop).toBe(resolve(box, 'marginTop', 'clamp(32px, 5vw, 64px)'));
    expect(getComputedStyle(box.querySelector('.dashboard')!).marginBottom).toBe(resolve(box, 'marginTop', 'clamp(64px, 10vw, 140px)'));
  });

  it('RF-8 (008) · 8.2: el saludo usa clamp(30px, 5vw, 44px), línea 1,15 y peso 800; los títulos de sección, clamp(24px, 3.5vw, 30px), línea 1,2 y peso 800', async () => {
    const box = await showDashboard();
    const h1 = getComputedStyle(box.querySelector('h1')!);
    const size = resolve(box, 'fontSize', 'clamp(30px, 5vw, 44px)');
    expect(h1.fontSize).toBe(size);
    expect(parseFloat(h1.lineHeight)).toBeCloseTo(parseFloat(size) * 1.15, 1);
    expect(h1.fontWeight).toBe('800');
    const titles = [...box.querySelectorAll<HTMLElement>('.dashboard h2')];
    expect(titles.length).toBeGreaterThan(0);
    const small = resolve(box, 'fontSize', 'clamp(24px, 3.5vw, 30px)');
    for (const h2 of titles) {
      const style = getComputedStyle(h2);
      expect(style.fontSize).toBe(small);
      expect(parseFloat(style.lineHeight)).toBeCloseTo(parseFloat(small) * 1.2, 1);
      expect(style.fontWeight).toBe('800');
    }
  });

  it('RF-8 (008) · 8.3: el título «Mis ápices» se separa 24 px de lo que sigue (su lote ilustrado, cuando hay ápices)', async () => {
    const box = await showDashboard();
    const title = box.querySelector<HTMLElement>('.dashboard h2')!;
    expect(title.textContent).toBe('Mis ápices');
    expect(getComputedStyle(title.parentElement!).rowGap).toBe('24px');
    const next = title.nextElementSibling as HTMLElement;
    expect(next.getBoundingClientRect().top - title.getBoundingClientRect().bottom).toBe(24);
  });

  it('RF-8 (008) · 8.5, 8.6: las secciones van sin lote y separadas clamp(48px, 8vw, 96px); la fila del saludo lleva «Nuevo ápice» a la derecha', async () => {
    const box = await showDashboard();
    const dash = box.querySelector<HTMLElement>('.dashboard')!;
    expect(dash.closest('.lot')).toBeNull();
    expect(getComputedStyle(dash).rowGap).toBe(resolve(box, 'marginTop', 'clamp(48px, 8vw, 96px)'));
    const head = dash.querySelector<HTMLElement>('.dashboard__head')!;
    const link = head.querySelector<HTMLElement>('a[href="/apices/nuevo"]')!;
    expect(link.getBoundingClientRect().height).toBe(48);
    expect(head.querySelector('h1')!.getBoundingClientRect().left).toBeLessThanOrEqual(link.getBoundingClientRect().left);
  });
});

describe.each([360, 1280])('Prototipado a %i px', (width) => {
  async function showPrototyping() {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/prototipado');
    bench?.remove();
    bench = document.createElement('div');
    document.body.append(bench);
    const root = createRoot(bench);
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    scope.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(
          <SessionProvider initial={PERSON}>
            <main>
              <Prototyping source={{ fetchPage: async () => ({ items: [], cursor: null }) }} />
            </main>
          </SessionProvider>,
        );
      });
    } finally {
      scope.IS_REACT_ACT_ENVIRONMENT = false;
    }
    await new Promise((done) => setTimeout(done, 50));
    return bench;
  }

  function resolve(box: HTMLElement, property: 'marginTop' | 'fontSize', expression: string): string {
    const probe = document.createElement('i');
    probe.style[property] = expression;
    box.append(probe);
    const value = getComputedStyle(probe)[property];
    probe.remove();
    return value;
  }

  it('RF-9 (008) · 9.1: sin lote envolvente, deja clamp(32px, 6vw, 64px) arriba y separa sus bloques 24 px', async () => {
    const box = await showPrototyping();
    const root = box.querySelector<HTMLElement>('.prototyping')!;
    expect(root.closest('.lot')).toBeNull();
    expect(getComputedStyle(root).paddingTop).toBe(resolve(box, 'marginTop', 'clamp(32px, 6vw, 64px)'));
    expect(getComputedStyle(root).rowGap).toBe('24px');
  });

  it('RF-9 (008) · 9.2: el título usa clamp(28px, 5vw, 40px), línea 1,1 y peso 800; el contador, 16 px y peso 800', async () => {
    const box = await showPrototyping();
    const h1 = getComputedStyle(box.querySelector('h1')!);
    const size = resolve(box, 'fontSize', 'clamp(28px, 5vw, 40px)');
    expect(h1.fontSize).toBe(size);
    expect(parseFloat(h1.lineHeight)).toBeCloseTo(parseFloat(size) * 1.1, 1);
    expect(h1.fontWeight).toBe('800');
    const count = getComputedStyle(box.querySelector('[role="status"]')!);
    expect(count.fontSize).toBe('16px');
    expect(count.fontWeight).toBe('800');
  });

  it('RF-9 (008) · 9.3: «Nuevo ápice» y «Archivados» van en la misma fila que el título', async () => {
    const box = await showPrototyping();
    const head = box.querySelector<HTMLElement>('.prototyping__head')!;
    const links = [...head.querySelectorAll<HTMLElement>('a')];
    expect(links.map((a) => a.textContent)).toEqual(['Nuevo ápice', 'Archivados']);
    expect(head.querySelector('h1')).not.toBeNull();
    expect(head.querySelector('[role="status"]')).not.toBeNull();
  });

  it('RF-9 (008) · 9.5: el panel lleva radio de 14 px, shadow-block y 24 px de relleno', async () => {
    const box = await showPrototyping();
    const panel = box.querySelector<HTMLElement>('.apice-panel')!;
    const style = getComputedStyle(panel);
    expect(style.borderTopLeftRadius).toBe('14px');
    expect(style.paddingTop).toBe('24px');
  });
});

describe.each([360, 1280])('Documentación a %i px', (width) => {
  const index = {
    secciones: [
      { titulo: 'Empezar', articulos: [{ slug: 'uno', archivo: '01.md' }, { slug: 'dos', archivo: '02.md' }] },
      { titulo: 'Conceptos', articulos: [{ slug: 'tres', archivo: '03.md' }] },
    ],
  };
  const files = {
    '01.md': '# Uno\n\nPrimer párrafo.\n\nOtro párrafo.',
    '02.md': '# Dos\n\nPrimer párrafo del dos.\n\n## Subtítulo\n\nTexto.',
    '03.md': '# Tres\n\nTexto.',
  };

  async function showDocs() {
    await page.viewport(width, 800);
    history.replaceState(null, '', '/documentacion/dos');
    bench?.remove();
    bench = document.createElement('div');
    document.body.append(bench);
    const root = createRoot(bench);
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    scope.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(
          <SessionProvider initial={PERSON}>
            <main>
              <Documentation slug="dos" index={index} loadArticles={async () => files} />
            </main>
          </SessionProvider>,
        );
      });
    } finally {
      scope.IS_REACT_ACT_ENVIRONMENT = false;
    }
    await new Promise((done) => setTimeout(done, 50));
    return bench;
  }

  function resolve(box: HTMLElement, property: 'marginTop' | 'fontSize', expression: string): string {
    const probe = document.createElement('i');
    probe.style[property] = expression;
    box.append(probe);
    const value = getComputedStyle(probe)[property];
    probe.remove();
    return value;
  }

  it('RF-10 (008) · 10.1: la columna mide 1040 px como máximo, centrada, con clamp(48px, 6vw, 96px) arriba y abajo y 48/64 px entre bloques', async () => {
    const box = await showDocs();
    const docs = box.querySelector<HTMLElement>('.documentation')!;
    const style = getComputedStyle(docs);
    expect(docs.getBoundingClientRect().width).toBeLessThanOrEqual(1040);
    expect(style.paddingTop).toBe(resolve(box, 'marginTop', 'clamp(48px, 6vw, 96px)'));
    expect(style.marginBottom).toBe(resolve(box, 'marginTop', 'clamp(48px, 6vw, 96px)'));
    expect(style.rowGap).toBe('48px');
    expect(style.columnGap).toBe('64px');
  });

  it('RF-10 (008) · 10.2: el índice mide 200 px a 1280 px; los enlaces, 15 px y el vigente en 800 sin subrayado', async () => {
    const box = await showDocs();
    const nav = box.querySelector<HTMLElement>('.documentation__index')!;
    if (width === 1280) expect(nav.getBoundingClientRect().width).toBe(200);
    const current = nav.querySelector<HTMLElement>('[aria-current="page"]')!;
    expect(getComputedStyle(current).fontSize).toBe('15px');
    expect(getComputedStyle(current).fontWeight).toBe('800');
    expect(getComputedStyle(current).textDecorationLine).toBe('none');
    expect(getComputedStyle(nav.querySelector('a:not([aria-current])')!).fontWeight).not.toBe('800');
  });

  it('RF-10 (008) · 10.3: los títulos de grupo van en mayúsculas, 14 px, peso 800 y .06em de espaciado', async () => {
    const box = await showDocs();
    const title = getComputedStyle(box.querySelector('.documentation__section-title')!);
    expect(title.textTransform).toBe('uppercase');
    expect(title.fontSize).toBe('14px');
    expect(title.fontWeight).toBe('800');
    expect(parseFloat(title.letterSpacing)).toBeCloseTo(0.84, 2);
  });

  it('RF-10 (008) · 10.4: el artículo mide 680 px como máximo y separa sus bloques 36 px', async () => {
    const box = await showDocs();
    const article = box.querySelector<HTMLElement>('.documentation__article')!;
    expect(article.getBoundingClientRect().width).toBeLessThanOrEqual(680);
    expect(getComputedStyle(article).rowGap).toBe('36px');
  });

  it('RF-10 (008) · 10.5: migas de 18 px; título clamp(34px, 5vw, 48px)/1,15; primer párrafo lead; subtítulos doc-heading', async () => {
    const box = await showDocs();
    expect(getComputedStyle(box.querySelector('.documentation__crumb')!).fontSize).toBe('18px');
    const h1 = getComputedStyle(box.querySelector('.documentation__article h1')!);
    const size = resolve(box, 'fontSize', 'clamp(34px, 5vw, 48px)');
    expect(h1.fontSize).toBe(size);
    expect(parseFloat(h1.lineHeight)).toBeCloseTo(parseFloat(size) * 1.15, 1);
    const lead = getComputedStyle(box.querySelector('.documentation__article h1 ~ p')!);
    expect(lead.fontSize).toBe('18px');
    expect(lead.color).toBe(getComputedStyle(box.querySelector('.documentation__crumb')!).color);
    const h2 = getComputedStyle(box.querySelector('.documentation__article h2')!);
    expect(h2.fontSize).toBe('24px');
    expect(h2.fontWeight).toBe('800');
  });

  it('RF-10 (008) · 10.6: anterior y siguiente van como texto subrayado de 15 px y peso 700, bajo una línea con 24 px de separación', async () => {
    const box = await showDocs();
    const pager = box.querySelector<HTMLElement>('.documentation__pager')!;
    const style = getComputedStyle(pager);
    expect(style.borderTopWidth).toBe('1px');
    expect(style.paddingTop).toBe('24px');
    const links = [...pager.querySelectorAll<HTMLElement>('a')];
    expect(links.map((a) => a.textContent)).toEqual(['← Uno', 'Tres →']);
    for (const a of links) {
      const l = getComputedStyle(a);
      expect(l.fontSize).toBe('15px');
      expect(l.fontWeight).toBe('700');
      expect(l.textDecorationLine).toBe('underline');
    }
  });
});

describe.each([360, 1280])('Constitución a %i px', (width) => {
  const T0 = Date.parse('2026-09-03T15:00:00Z');
  const ids = ['a', 'b', 'c'];
  const sections = ids.map((id) => ({ id, title: `Principio ${id}`, text: `Texto de ${id}.`, updatedAt: T0, isRetired: false, retiredAt: null }));
  const sectionsSource = {
    onState: (cb: (s: unknown) => void) => { cb({ isOpen: true, openedAt: null, order: ids, updatedAt: T0, logSeq: 0 }); return () => undefined; },
    onSections: (_a: unknown, cb: (s: unknown) => void) => { cb(sections); return () => undefined; },
    onMeta: (_a: unknown, _id: string, cb: (m: unknown) => void) => { cb(null); return () => undefined; },
    onVersions: (_a: unknown, _id: string, cb: (v: unknown) => void) => { cb([]); return () => undefined; },
    onLog: (_a: unknown, cb: (v: unknown) => void) => { cb([]); return () => undefined; },
  };

  async function showConstitution() {
    await page.viewport(width, 800);
    bench?.remove();
    bench = document.createElement('div');
    document.body.append(bench);
    const root = createRoot(bench);
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    scope.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(
          <SessionProvider initial={VISITOR}>
            <main>
              <ConstitutionPage
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sectionsSource={sectionsSource as any}
                documentsSource={{ fetchPage: async () => ({ items: [], cursor: null }), onDocument: () => () => undefined, onVersions: () => () => undefined }}
              />
            </main>
          </SessionProvider>,
        );
      });
    } finally {
      scope.IS_REACT_ACT_ENVIRONMENT = false;
    }
    await new Promise((done) => setTimeout(done, 80));
    return bench;
  }

  function resolve(box: HTMLElement, property: 'marginTop' | 'fontSize', expression: string): string {
    const probe = document.createElement('i');
    probe.style[property] = expression;
    box.append(probe);
    const value = getComputedStyle(probe)[property];
    probe.remove();
    return value;
  }

  it('RF-11 (008) · 11.1: la columna mide 800 px como máximo, centrada, con clamp(48px, 6vw, 96px) arriba y abajo y 40 px entre bloques', async () => {
    const box = await showConstitution();
    const root = box.querySelector<HTMLElement>('.constitution')!;
    const style = getComputedStyle(root);
    expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(800);
    expect(style.paddingTop).toBe(resolve(box, 'marginTop', 'clamp(48px, 6vw, 96px)'));
    expect(style.marginBottom).toBe(resolve(box, 'marginTop', 'clamp(48px, 6vw, 96px)'));
    expect(style.rowGap).toBe('40px');
  });

  it('RF-11 (008) · 11.2: el título usa clamp(32px, 5vw, 44px) con línea 1,15; la entrada, lead en text-muted', async () => {
    const box = await showConstitution();
    const h1 = getComputedStyle(box.querySelector('h1')!);
    const size = resolve(box, 'fontSize', 'clamp(32px, 5vw, 44px)');
    expect(h1.fontSize).toBe(size);
    expect(parseFloat(h1.lineHeight)).toBeCloseTo(parseFloat(size) * 1.15, 1);
    const lead = box.querySelector<HTMLElement>('.constitution__lead')!;
    expect(lead.textContent).toBe('Siete principios mandan sobre todo lo demás: sobre cada función, cada spec y cada línea de código.');
    expect(getComputedStyle(lead).fontSize).toBe('18px');
    expect(getComputedStyle(lead).color).toBe(getComputedStyle(box.querySelector('.constitution__updated')!).color);
  });

  it('RF-11 (008) · 11.3: las tarjetas tienen radio de 14 px, clamp(20px, 4vw, 28px) de relleno y 28 px de separación', async () => {
    const box = await showConstitution();
    const cards = [...box.querySelectorAll<HTMLElement>('article.section-block')];
    expect(cards).toHaveLength(3);
    const style = getComputedStyle(cards[0]!);
    expect(style.borderTopLeftRadius).toBe('14px');
    expect(style.paddingTop).toBe(resolve(box, 'marginTop', 'clamp(20px, 4vw, 28px)'));
    expect(cards[1]!.getBoundingClientRect().top - cards[0]!.getBoundingClientRect().bottom).toBe(28);
  });

  it('RF-11 (008) · 11.4: el numeral es de 34 px y peso 800; el título, 20/800/1,25; el texto, 16 px con línea 1,55', async () => {
    const box = await showConstitution();
    const card = box.querySelector<HTMLElement>('article.section-block')!;
    const number = getComputedStyle(card.querySelector('.section-block__number')!);
    expect(number.fontSize).toBe('34px');
    expect(number.fontWeight).toBe('800');
    const h2 = getComputedStyle(card.querySelector('h2')!);
    expect(h2.fontSize).toBe('20px');
    expect(h2.fontWeight).toBe('800');
    expect(parseFloat(h2.lineHeight)).toBeCloseTo(25, 1);
    const text = getComputedStyle(card.querySelector('.section-content p')!);
    expect(text.fontSize).toBe('16px');
    expect(parseFloat(text.lineHeight)).toBeCloseTo(24.8, 1);
  });

  it('RF-11 (008) · 11.5: el camino mide 14 px y deja 50 px a la izquierda; cada tarjeta lleva un nodo de 18 px', async () => {
    const box = await showConstitution();
    const list = box.querySelector<HTMLElement>('.constitution__list')!;
    expect(getComputedStyle(list).paddingLeft).toBe('50px');
    const road = getComputedStyle(list, '::before');
    expect(road.width).toBe('14px');
    const nodes = [...list.querySelectorAll<HTMLElement>('.constitution__node [data-testid="node"]')];
    expect(nodes).toHaveLength(3);
    expect(nodes[0]!.getBoundingClientRect().width).toBe(18);
    const card = list.querySelector('article')!.getBoundingClientRect();
    expect(card.left - list.getBoundingClientRect().left).toBe(50);
  });

  it('RF-11 (008) · 11.6: el pie va en 14 px y text-muted, con 50 px a la izquierda, después de las tarjetas', async () => {
    const box = await showConstitution();
    const foot = box.querySelector<HTMLElement>('.constitution__updated')!;
    const style = getComputedStyle(foot);
    expect(style.fontSize).toBe('14px');
    expect(style.paddingLeft).toBe('50px');
    expect(foot.textContent).toContain('Última modificación: 2026-09-03');
    const list = box.querySelector('.constitution__list')!;
    expect(list.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
