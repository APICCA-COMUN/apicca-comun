// Presentación previa al lanzamiento (25-11-2026): la página «/» para quien llega sin sesión, medida en Chromium. No lee nada de
// la base (el campo es de muestra), así que se monta sola, con sesión de visitante y sin sembrar datos. Cubre:
// - capturas en claro y oscuro a 1280×800 y en claro a 360×800, con movimiento reducido (la referencia no depende de cuándo
//   termina una animación); las referencias viven en `__screenshots__/` y se versionan solo cuando la persona las aprueba;
// - sin desborde horizontal a 360 px;
// - todo tamaño de texto sale de `TYPE_SCALE` (como en design-019) y el h1 usa `hero`;
// - los botones de la leyenda miden 44 px o más, de alto y de ancho;
// - con movimiento, todo termina de animarse en menos de 3 s;
// - con colores forzados, el campo toma los colores del sistema y nada se desborda.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/piezas.css';
import { THEMES, TYPE_SCALE } from '../../shared/domain/identity';
import { SessionProvider } from '../../src/app/session';
import { SiteFooter } from '../../src/components/SiteFooter';
import { Presentacion, PresentacionCabecera } from '../../src/pages/Presentacion';

let host: HTMLDivElement | undefined;
let root: Root | undefined;

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

async function media(features: { name: string; value: string }[]) {
  await cdp().send('Emulation.setEmulatedMedia', { features });
}

/** Las animaciones que siguen en marcha: con `fill: both` las terminadas se quedan en la lista, como `finished`. */
const enCurso = () => document.getAnimations().filter((animation) => animation.playState !== 'finished');

const MOVIMIENTO_REDUCIDO = [{ name: 'prefers-reduced-motion', value: 'reduce' }];

/** Monta la página como visitante y espera a la fuente y a que no quede ninguna animación. */
async function montar(theme: string, width: number, esperar = true) {
  await page.viewport(width, 800);
  document.documentElement.dataset['theme'] = theme;
  host = document.createElement('div');
  // Como en `index.html`: las reglas de `#root` se aplican al contenedor de la app.
  host.id = 'root';
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() =>
    created.render(
      <SessionProvider>
        {/* La composición de `App.tsx` para un visitante: cabecera, el único `main` con la presentación dentro, y el pie. */}
        <PresentacionCabecera />
        <main className="presentacion">
          <Presentacion />
        </main>
        <SiteFooter />
      </SessionProvider>,
    ),
  );
  if (!esperar) return;
  await document.fonts.ready;
  await waitFor(() => enCurso().length === 0);
  await new Promise((done) => setTimeout(done, 100));
}

/** Saca el puntero de la ventana: un `:hover` heredado de otra prueba cambiaría un color. */
async function aparcarPuntero() {
  await cdp().send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -1, y: -1 });
}

function visible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function nombre(element: Element): string {
  const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const className = typeof element.className === 'string' && element.className ? `.${element.className.split(' ').join('.')}` : '';
  return `${element.tagName.toLowerCase()}${className} «${text}»`;
}

/** El valor calculado de una variable de longitud, medido sobre un elemento de prueba. */
function medir(value: string): string {
  const probe = document.createElement('div');
  probe.style.fontSize = value;
  document.body.append(probe);
  const computed = getComputedStyle(probe).fontSize;
  probe.remove();
  return computed;
}

/** Los tamaños de la escala en píxeles, al ancho actual de la ventana. */
function tamanosDeLaEscala(): Map<string, string> {
  return new Map(Object.keys(TYPE_SCALE).map((token) => [medir(`var(--type-${token}-size)`), token]));
}

/** Los elementos visibles con texto propio, más los botones, fuera de los SVG (el campo y los dibujos no llevan texto). */
function elementosDeTexto(): HTMLElement[] {
  return [...host!.querySelectorAll<HTMLElement>('*')].filter((element) => {
    if (element.closest('svg') !== null || !visible(element)) return false;
    if (element.matches('button')) return true;
    return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '');
  });
}

const botonesDeLaLeyenda = () => [...host!.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Ejes de la muestra"] button')];

beforeAll(async () => {
  await media(MOVIMIENTO_REDUCIDO);
});

afterEach(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  host = undefined;
  root = undefined;
  await media(MOVIMIENTO_REDUCIDO);
  delete document.documentElement.dataset['theme'];
  scrollTo(0, 0);
});

afterAll(async () => {
  await media([]);
  await page.viewport(1280, 800);
});

/**
 * La página es más alta que la ventana y lo que queda fuera de ella saldría en blanco en la captura; y no se puede alargar la
 * ventana hasta el alto de la página, porque la portada ocupa la ventana entera (`min-block-size: 100dvh - 64px`) y crecería con
 * ella. Por eso se captura por partes: la parte de arriba (cabecera y portada, recortada al alto de la portada) y cada sección
 * con su propia ventana, de 800 px o de su alto si es mayor.
 */
async function capturarPartes(theme: string, width: number, partes: readonly string[]) {
  await montar(theme, width);
  await aparcarPuntero();
  const secciones = [...host!.querySelectorAll<HTMLElement>('main.presentacion > section')];
  expect(secciones.length).toBe(5);
  const elementos: Record<string, () => HTMLElement> = {
    arriba: () => host!,
    campo: () => host!.querySelector<HTMLElement>('.presentacion__campo')!,
    ideas: () => secciones[1]!,
    'que-hay': () => secciones[2]!,
    entrar: () => secciones[3]!,
    cierre: () => secciones[4]!,
    pie: () => host!.querySelector<HTMLElement>('footer')!,
  };
  const fallas: string[] = [];
  for (const parte of partes) {
    const elemento = elementos[parte]!();
    if (parte === 'arriba') {
      // La primera pantalla: hasta el borde de abajo de la portada o, si es más alta, hasta los 800 px de la ventana.
      const abajo = Math.min(800, Math.ceil(secciones[0]!.getBoundingClientRect().bottom + scrollY));
      await page.viewport(width, 800);
      await new Promise((done) => setTimeout(done, 200));
      host!.style.cssText = `height: ${abajo}px; min-height: 0; overflow: hidden;`;
    } else {
      await page.viewport(width, Math.max(800, Math.ceil(elemento.getBoundingClientRect().height)));
      await new Promise((done) => setTimeout(done, 200));
    }
    await waitFor(() => enCurso().length === 0);
    await aparcarPuntero();
    // Se siguen las demás partes aunque una falle (o aún no tenga referencia) y se avisa de todas al final.
    try {
      await expect.element(page.elementLocator(elemento)).toMatchScreenshot(`presentacion-${theme}-${width}-${parte}`);
    } catch (error) {
      fallas.push(`${parte}: ${(error as Error).message.split('\n').slice(0, 3).join(' ')}`);
    }
    host!.style.cssText = '';
  }
  expect(fallas).toEqual([]);
}

const PARTES = ['arriba', 'ideas', 'que-hay', 'entrar', 'cierre', 'pie'] as const;
const PARTES_ANGOSTO = ['arriba', 'campo', ...PARTES.slice(1)] as const;

describe('Presentación previa al lanzamiento (25-11-2026) · capturas', () => {
  const CAPTURAS = [
    ...THEMES.map((theme) => ({ theme, width: 1280 })),
    { theme: 'light', width: 360 },
  ];
  it.each(CAPTURAS)('la presentación en el tema $theme a $width px coincide con sus referencias, parte por parte', async ({ theme, width }) => {
    await capturarPartes(theme, width, width < 900 ? PARTES_ANGOSTO : PARTES);
  });

  it('con un eje elegido, la parte de arriba coincide con su referencia (claro, 1280)', async () => {
    await montar('light', 1280);
    await userEvent.click(page.elementLocator(botonesDeLaLeyenda().find((b) => b.getAttribute('aria-label') === 'Cobijo')!));
    await waitFor(() => botonesDeLaLeyenda().some((b) => b.getAttribute('aria-pressed') === 'true'));
    await waitFor(() => enCurso().length === 0);
    await aparcarPuntero();
    const abajo = Math.min(800, Math.ceil(host!.querySelector('main.presentacion > section')!.getBoundingClientRect().bottom + scrollY));
    host!.style.cssText = `height: ${abajo}px; min-height: 0; overflow: hidden;`;
    await expect.element(page.elementLocator(host!)).toMatchScreenshot('presentacion-cobijo-light-1280-arriba');
  });
});

describe('Presentación previa al lanzamiento (25-11-2026) · medidas', () => {
  it.each([360, 1280])('a %i px no hay desborde horizontal', async (width) => {
    await montar('light', width);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    expect(host!.scrollWidth).toBeLessThanOrEqual(host!.clientWidth);
    // Ningún bloque con texto sale por la derecha de la ventana.
    const fuera = elementosDeTexto()
      .filter((element) => element.getBoundingClientRect().right > width + 0.5)
      .map(nombre);
    expect(fuera).toEqual([]);
  });

  it.each(THEMES.flatMap((theme) => [360, 1280].map((width) => ({ theme, width }))))(
    'en el tema $theme a $width px todo texto usa la escala y el h1 usa hero',
    async ({ theme, width }) => {
      await montar(theme, width);
      const escala = tamanosDeLaEscala();
      const fuera = elementosDeTexto()
        .filter((element) => !escala.has(getComputedStyle(element).fontSize))
        .map((element) => `${nombre(element)}: ${getComputedStyle(element).fontSize}`);
      expect(fuera).toEqual([]);
      const h1 = host!.querySelector<HTMLElement>('h1');
      expect(h1, 'h1').not.toBeNull();
      expect(getComputedStyle(h1!).fontSize).toBe(medir('var(--type-hero-size)'));
    },
  );

  it.each([360, 1280])('a %i px los cinco botones de la leyenda miden 44 px o más de alto y de ancho', async (width) => {
    await montar('light', width);
    const botones = botonesDeLaLeyenda();
    expect(botones).toHaveLength(5);
    for (const boton of botones) {
      const caja = boton.getBoundingClientRect();
      expect(caja.height, `${boton.getAttribute('aria-label')} alto`).toBeGreaterThanOrEqual(44);
      expect(caja.width, `${boton.getAttribute('aria-label')} ancho`).toBeGreaterThanOrEqual(44);
    }
  });

  it('los dos enlaces de «Solicitar inscripción» miden 44 px o más de alto', async () => {
    await montar('light', 360);
    const enlaces = [...host!.querySelectorAll<HTMLAnchorElement>('a[href="/solicitar"]')];
    expect(enlaces).toHaveLength(2);
    for (const enlace of enlaces) expect(enlace.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});

describe('Presentación previa al lanzamiento (25-11-2026) · movimiento', () => {
  it('con movimiento, las animaciones de la entrada terminan en menos de 3 s', async () => {
    await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const inicio = performance.now();
    await montar('light', 1280, false);
    // La entrada sí anima (zonas, Ápices y Arco) y todo queda quieto antes de 3 s.
    expect(enCurso().length).toBeGreaterThan(0);
    await waitFor(() => enCurso().length === 0, 3000);
    expect(performance.now() - inicio).toBeLessThan(3000);
  });

  it('con movimiento, el Arco nuevo de un eje elegido se dibuja y termina en menos de 3 s', async () => {
    await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await montar('light', 1280);
    await userEvent.click(page.elementLocator(botonesDeLaLeyenda().find((b) => b.getAttribute('aria-label') === 'Comunicación')!));
    const inicio = performance.now();
    expect(enCurso().length).toBeGreaterThan(0);
    await waitFor(() => enCurso().length === 0, 3000);
    expect(performance.now() - inicio).toBeLessThan(3000);
  });

  it('con movimiento reducido el campo no anima nada', async () => {
    await montar('light', 1280);
    expect(document.getAnimations()).toHaveLength(0);
    await userEvent.click(page.elementLocator(botonesDeLaLeyenda()[0]!));
    expect(document.getAnimations()).toHaveLength(0);
  });
});

describe('Presentación previa al lanzamiento (25-11-2026) · colores forzados', () => {
  it.each([360, 1280])('a %i px el campo toma los colores del sistema y nada se desborda', async (width) => {
    await media([...MOVIMIENTO_REDUCIDO, { name: 'forced-colors', value: 'active' }]);
    await montar('light', width);
    const color = (valor: string, propiedad: 'color' | 'backgroundColor') => {
      const probe = document.createElement('div');
      probe.style[propiedad] = valor;
      document.body.append(probe);
      const computed = getComputedStyle(probe)[propiedad];
      probe.remove();
      return computed;
    };
    const trazo = host!.querySelector('path.presentacion__arco-trazo')!;
    const zona = host!.querySelector('polygon.presentacion__zona')!;
    expect(getComputedStyle(trazo).stroke).toBe(color('CanvasText', 'color'));
    expect(getComputedStyle(zona).stroke).toBe(color('CanvasText', 'color'));
    expect(getComputedStyle(host!.querySelector('circle.presentacion__arco-disco')!).fill).toBe(color('CanvasText', 'color'));
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    // Los botones de la leyenda siguen visibles y con su tamaño.
    for (const boton of botonesDeLaLeyenda()) {
      expect(visible(boton)).toBe(true);
      expect(boton.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    // Los textos no quedan ocultos: ninguno tiene la misma tinta que su fondo.
    const h1 = host!.querySelector('h1')!;
    expect(getComputedStyle(h1).color).not.toBe(getComputedStyle(document.body).backgroundColor);
  });
});
