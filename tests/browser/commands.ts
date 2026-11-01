// Comandos de Vitest Browser que corren en Node con Playwright (D-T13 (002)). `openIndex` abre
// una página aparte, en un contexto propio, contra el `vite preview` de `dist-browser/` que
// levanta `global-setup.ts`: así se prueba el `index.html` real (primer pintado, `<noscript>`,
// `theme-color`, metadatos), sin el marco de pruebas, con la hora fija y, si se pide, sin
// JavaScript o sin la hoja o la fuente.
import type { BrowserCommand } from 'vitest/node';
import { FIXED_TIME } from './fixed-time';
import { PREVIEW_ORIGIN } from './global-setup';

export type BlockedResource = 'stylesheet' | 'font';

export interface OpenIndexOptions {
  /** Ruta del sitio; `/` por defecto. */
  path?: string;
  /** `false` abre la página con JavaScript desactivado. */
  javaScript?: boolean;
  /** Recursos que no llegan nunca: la hoja de estilos, la fuente o las dos. */
  block?: BlockedResource[];
  /** Esquema que declara el sistema (`prefers-color-scheme`). */
  colorScheme?: 'light' | 'dark';
  /** Tema elegido, guardado en `localStorage` antes de cargar; sin él, no hay elección. */
  theme?: 'light' | 'dark';
  /** Tamaño de la ventana en px CSS; 640 × 400 equivale a ampliar al 200 % (plan §9.4). */
  viewport?: { width: number; height: number };
  /** Revisa tamaños de letra, recortes y controles alcanzables (RF-5 (002) · 5.5 a 5.7). */
  audit?: boolean;
}

/** Lo que encontró la revisión: listas vacías si todo está bien, con un rótulo por hallazgo. */
export interface TextAudit {
  texts: number;
  controls: number;
  smallText: string[];
  smallFields: string[];
  clipped: string[];
  unreachable: string[];
}

export interface IndexSnapshot {
  title: string;
  /** `Date.now()` de la página; `null` sin JavaScript. */
  now: number | null;
  /** Valores calculados de `:root`. */
  background: string;
  color: string;
  colorScheme: string;
  dataTheme: string | null;
  /** `content` de cada `theme-color`, por su `media`. */
  themeColors: Record<string, string | null>;
  /** El `<noscript>` tal como se ve: visible, su texto y el color del texto. */
  noscript: { visible: boolean; text: string; color: string | null };
  /** La fuente tras `document.fonts.ready`: precarga, estado de Nunito y el texto pintado. */
  audit?: TextAudit;
  font: {
    preload: string | null;
    nunito: string | null;
    family: string;
    text: string;
    textHeight: number;
  };
}

const THEME_KEY = 'apicca-theme';

export const openIndex: BrowserCommand<[OpenIndexOptions?], IndexSnapshot> = async (ctx, options = {}) => {
  const browser = ctx.context.browser();
  if (browser === null) throw new Error('El contexto de Playwright no tiene navegador.');
  const context = await browser.newContext({
    baseURL: PREVIEW_ORIGIN,
    javaScriptEnabled: options.javaScript ?? true,
    colorScheme: options.colorScheme ?? 'light',
    viewport: options.viewport ?? { width: 1280, height: 800 },
    storageState: {
      cookies: [],
      origins:
        options.theme === undefined
          ? []
          : [{ origin: PREVIEW_ORIGIN, localStorage: [{ name: THEME_KEY, value: options.theme }] }],
    },
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(FIXED_TIME);
    const blocked = new Set<string>(options.block ?? []);
    if (blocked.size > 0) {
      await page.route('**/*', (route) =>
        blocked.has(route.request().resourceType()) ? route.abort() : route.continue(),
      );
    }
    await page.goto(options.path ?? '/', { waitUntil: 'load' });

    const root = page.locator('html');
    const style = (property: string) =>
      root.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
    const metas = await page.locator('meta[name="theme-color"]').all();
    const themeColors: Record<string, string | null> = {};
    for (const meta of metas) {
      themeColors[(await meta.getAttribute('media')) ?? ''] = await meta.getAttribute('content');
    }
    const noscript = page.locator('noscript p');
    const visible = (await noscript.count()) > 0 && (await noscript.first().isVisible());

    const font =
      options.javaScript === false
        ? { preload: null, nunito: null, family: '', text: '', textHeight: 0 }
        : await page.evaluate(async () => {
            await document.fonts.ready;
            // El primer texto que pinta la aplicación, sea cual sea la página.
            const text = await new Promise<HTMLElement | null>((done) => {
              const find = () => document.querySelector<HTMLElement>('#root h1, #root p');
              // La hora está fija: se cuenta en intentos, no con `Date.now()`.
              let tries = 100;
              const poll = () => (find() || --tries < 0 ? done(find()) : setTimeout(poll, 50));
              poll();
            });
            const nunito = [...document.fonts].find((face) => face.family.replace(/["']/g, '') === 'Nunito');
            return {
              preload: document.querySelector<HTMLLinkElement>('link[rel="preload"][as="font"]')?.href ?? null,
              nunito: nunito?.status ?? null,
              family: getComputedStyle(document.body).fontFamily,
              text: text?.textContent?.trim() ?? '',
              textHeight: text?.getBoundingClientRect().height ?? 0,
            };
          });

    const audit = options.audit === true ? await page.evaluate(auditPage) : undefined;

    return {
      ...(audit === undefined ? {} : { audit }),
      font,
      title: await page.title(),
      now: options.javaScript === false ? null : await page.evaluate(() => Date.now()),
      background: await style('background-color'),
      color: await style('color'),
      colorScheme: await style('color-scheme'),
      dataTheme: await root.getAttribute('data-theme'),
      themeColors,
      noscript: {
        visible,
        text: visible ? ((await noscript.first().textContent()) ?? '').trim() : '',
        color: visible ? await noscript.first().evaluate((element) => getComputedStyle(element).color) : null,
      },
    };
  } finally {
    await context.close();
  }
};

/**
 * Corre dentro de la página. Definiciones de plan §9.4: recortado es un elemento con texto,
 * `overflow` oculto y `scrollWidth > clientWidth`; inalcanzable, un control con caja nula o
 * fuera del área desplazable del documento.
 */
function auditPage(): TextAudit {
  const label = (element: Element) =>
    `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} «${(element.textContent ?? '').trim().slice(0, 40)}»`;
  const size = (element: Element) => parseFloat(getComputedStyle(element).fontSize);
  const visible = (element: Element) => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  };
  const withText = [...document.querySelectorAll('#root *')].filter(
    (element) =>
      visible(element) &&
      [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''),
  );
  const fields = [...document.querySelectorAll('#root p, #root input, #root textarea, #root select')].filter(visible);
  const controls = [
    ...document.querySelectorAll('#root a[href], #root button, #root input:not([type="hidden"]), #root select, #root textarea, #root [tabindex]'),
  ].filter((element) => getComputedStyle(element).display !== 'none');
  const scroll = document.documentElement;
  return {
    texts: withText.length,
    controls: controls.length,
    smallText: withText
      .filter((element) => !element.closest('.leaflet-control-attribution') && size(element) < 14)
      .map((element) => `${label(element)} ${size(element)}px`),
    smallFields: fields.filter((element) => size(element) < 16).map((element) => `${label(element)} ${size(element)}px`),
    clipped: withText
      // El texto solo para lectores de pantalla se recorta a propósito (RF-7 (003) · 7.5).
      .filter((element) => !element.closest('.visually-hidden'))
      .filter((element) => {
        const { overflowX } = getComputedStyle(element);
        return (overflowX === 'hidden' || overflowX === 'clip') && element.scrollWidth > element.clientWidth;
      })
      .map(label),
    unreachable: controls
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const left = box.left + window.scrollX;
        const top = box.top + window.scrollY;
        return (
          box.width === 0 ||
          box.height === 0 ||
          left < 0 ||
          top < 0 ||
          left + box.width > scroll.scrollWidth ||
          top + box.height > scroll.scrollHeight
        );
      })
      .map(label),
  };
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    openIndex: (options?: OpenIndexOptions) => Promise<IndexSnapshot>;
  }
}
