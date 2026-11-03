// Mapa en Chromium real (T-6.6): en los dos temas, el panel de teselas se tinta con `--map-tint` y cambia con el
// tema sin recrear la capa (RF-8 (002) · 8.1, 8.2); si las teselas no cargan se ve el fondo del tema; la atribución
// queda fuera del tintado y alcanza 4,5:1 (8.6); los colores de `leaflet.css` quedan sobrescritos por tokens
// (RF-2 (002) · 2.1, D-T20 (002)); los pines se alcanzan con Tab en el orden de la lista y su foco usa `focus` y
// sube de `z-index` (8.5); con colores forzados no hay tintado y el pin usa los colores del sistema; sin ápices no
// hay errores, y en el inicio la lista sigue junto al mapa (8.7).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, commands, page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { THEMES, contrastRatio, pinAccessibleName } from '../../shared/domain/identity';
import type { Axis } from '../../shared/domain/apice';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { ApiceMap, type MappedApice } from '../../src/components/ApiceMap';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { LONG_NAME } from './seed-data';

const apice = (id: string, name: string, lat: number, lng: number, axes: Axis[]): MappedApice => ({
  id,
  name,
  axes,
  location: { lat, lng, precision: 'exact' },
});

/** En el orden de la lista: Huerta y Cocina comparten ubicación y van en el primer pin. */
const LISTED = [
  apice('a', 'Huerta', 4.6, -74.08, ['alimento', 'agua']),
  apice('c', 'Panel solar', 4.7, -74.0, ['energía']),
  apice('b', 'Cocina', 4.6, -74.08, ['agua']),
  apice('d', 'Radio comunitaria', 4.65, -74.2, ['comunicación', 'cobijo']),
];
const EXPECTED_ORDER = [
  pinAccessibleName('2 ápices: Huerta, Cocina', ['agua', 'alimento']),
  pinAccessibleName('Panel solar', ['energía']),
  pinAccessibleName('Radio comunitaria', ['cobijo', 'comunicación']),
];

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
  const until = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    if (Date.now() > until) throw new Error('waitFor: se agotó la espera.');
    await new Promise((done) => setTimeout(done, 50));
  }
}

/** El valor calculado de una propiedad para un valor CSS cualquiera (un token o un color del sistema). */
function computed(property: 'color' | 'backgroundColor' | 'filter', value: string): string {
  const probe = document.createElement('div');
  probe.style[property] = value;
  document.body.append(probe);
  const result = getComputedStyle(probe)[property];
  probe.remove();
  return result;
}

/** `rgb(r, g, b)` a `#RRGGBB`. */
function hex(rgb: string): string {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.map(Number);
  return `#${[r, g, b].map((part) => Math.round(part!).toString(16).padStart(2, '0')).join('')}`;
}

async function mount(apices: readonly MappedApice[]): Promise<HTMLElement> {
  host = document.createElement('div');
  host.style.width = '640px';
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() =>
    created.render(
      <>
        <button type="button">antes del mapa</button>
        <ApiceMap apices={apices} />
      </>,
    ),
  );
  const container = await waitFor(() => host!.querySelector<HTMLElement>('.leaflet-container'));
  await waitFor(() => apices.length === 0 || host!.querySelector('.leaflet-marker-icon'));
  // Las teselas locales cargan del servidor de pruebas (D-T13 (002)).
  await waitFor(() => {
    const tiles = [...host!.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
    return tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth === 256);
  });
  return container;
}

async function forcedColors(active: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', { features: active ? [{ name: 'forced-colors', value: 'active' }] : [] });
}

/** El color del píxel central de un elemento en una captura real. */
async function centerPixel(element: Element): Promise<string> {
  const base64 = await page.screenshot({ element, save: false });
  const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  const [r, g, b] = context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data;
  return hex(`rgb(${r}, ${g}, ${b})`);
}

afterEach(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  await forcedColors(false);
  delete document.documentElement.dataset['theme'];
});

describe.each(THEMES)('mapa en el tema %s', (theme) => {
  beforeAll(() => {
    document.documentElement.dataset['theme'] = theme;
  });

  it('RF-8 (002) · 8.1, 8.2: el panel de teselas usa --map-tint y cambia con el tema sin recrear la capa', async () => {
    document.documentElement.dataset['theme'] = theme;
    const container = await mount(LISTED);
    const pane = container.querySelector<HTMLElement>('.leaflet-tile-pane')!;
    const tiles = [...pane.querySelectorAll('img.leaflet-tile')];
    expect(getComputedStyle(pane).filter).toBe(computed('filter', 'var(--map-tint)'));
    expect(getComputedStyle(pane).filter).not.toBe('none');
    const other = THEMES.find((name) => name !== theme)!;
    const before = getComputedStyle(pane).filter;
    document.documentElement.dataset['theme'] = other;
    expect(getComputedStyle(pane).filter).toBe(computed('filter', 'var(--map-tint)'));
    expect(getComputedStyle(pane).filter).not.toBe(before);
    // La misma capa: ni el panel ni las teselas se reemplazan.
    expect(container.querySelector('.leaflet-tile-pane')).toBe(pane);
    expect(tiles.every((tile) => tile.isConnected)).toBe(true);
    expect([...pane.querySelectorAll('img.leaflet-tile')]).toEqual(tiles);
    // La interfaz del mapa queda fuera del tintado (8.6).
    for (const outside of container.querySelectorAll('.leaflet-control-container, .leaflet-marker-pane')) {
      expect(getComputedStyle(outside).filter).toBe('none');
    }
  });

  it('RF-8 (002) · 8.1: con las teselas bloqueadas el mapa muestra el fondo del tema', async () => {
    document.documentElement.dataset['theme'] = theme;
    const container = await mount([]);
    for (const tile of container.querySelectorAll<HTMLImageElement>('img.leaflet-tile')) tile.src = '/test-tiles/bloqueada.png';
    await waitFor(() => [...container.querySelectorAll<HTMLImageElement>('img.leaflet-tile')].every((tile) => tile.complete));
    expect(getComputedStyle(container).backgroundColor).toBe(computed('backgroundColor', 'var(--background)'));
    expect(await centerPixel(container)).toBe(hex(computed('backgroundColor', 'var(--background)')));
  });

  it('RF-8 (002) · 8.6: la atribución va sobre surface con text y alcanza 4,5:1', async () => {
    document.documentElement.dataset['theme'] = theme;
    const container = await mount(LISTED);
    const attribution = container.querySelector<HTMLElement>('.leaflet-control-attribution')!;
    const style = getComputedStyle(attribution);
    expect(style.backgroundColor).toBe(computed('backgroundColor', 'var(--surface)'));
    expect(style.color).toBe(computed('color', 'var(--text)'));
    expect(contrastRatio(hex(style.color), hex(style.backgroundColor))).toBeGreaterThanOrEqual(4.5);
    const link = attribution.querySelector('a')!;
    expect(contrastRatio(hex(getComputedStyle(link).color), hex(style.backgroundColor))).toBeGreaterThanOrEqual(4.5);
  });

  it('RF-2 (020) · 2.1, D-T3 (020): acercar y alejar miden al menos 44 × 44 px', async () => {
    document.documentElement.dataset['theme'] = theme;
    const container = await mount(LISTED);
    for (const control of container.querySelectorAll<HTMLElement>('.leaflet-control-zoom-in, .leaflet-control-zoom-out')) {
      const box = control.getBoundingClientRect();
      expect(box.width, control.className).toBeGreaterThanOrEqual(44);
      expect(box.height, control.className).toBeGreaterThanOrEqual(44);
    }
    expect(container.querySelectorAll('.leaflet-control-zoom-in, .leaflet-control-zoom-out')).toHaveLength(2);
  });

  it('RF-2 (002) · 2.1, D-T20 (002): los colores de leaflet.css (atribución, zoom, emergentes) quedan sobrescritos por tokens', async () => {
    document.documentElement.dataset['theme'] = theme;
    const container = await mount(LISTED);
    const surface = computed('backgroundColor', 'var(--surface)');
    const text = computed('color', 'var(--text)');
    // Un emergente de prueba con la estructura de Leaflet.
    const popup = document.createElement('div');
    popup.className = 'leaflet-popup';
    popup.innerHTML = '<div class="leaflet-popup-content-wrapper"></div><div class="leaflet-popup-tip"></div><a class="leaflet-popup-close-button" href="#">×</a>';
    container.append(popup);
    const zoom = container.querySelector('.leaflet-control-zoom')!;
    expect(zoom.classList.contains('block')).toBe(true);
    for (const element of [
      container.querySelector('.leaflet-control-attribution')!,
      ...zoom.querySelectorAll('a'),
      popup.querySelector('.leaflet-popup-content-wrapper')!,
      popup.querySelector('.leaflet-popup-tip')!,
    ]) {
      expect(getComputedStyle(element).backgroundColor, element.className).toBe(surface);
    }
    for (const element of [...zoom.querySelectorAll('a'), popup.querySelector('.leaflet-popup-content-wrapper')!, popup.querySelector('.leaflet-popup-close-button')!]) {
      expect(getComputedStyle(element).color, element.className).toBe(text);
    }
    expect(getComputedStyle(container).backgroundColor).toBe(computed('backgroundColor', 'var(--background)'));
  });

  it('RF-8 (002) · 8.3, 8.5: los pines se alcanzan con Tab en el orden de la lista; el foco usa focus y sube de z-index', async () => {
    document.documentElement.dataset['theme'] = theme;
    const container = await mount(LISTED);
    const pins = [...container.querySelectorAll<HTMLElement>('.apicca-pin')];
    expect(pins).toHaveLength(3);
    for (const pin of pins) expect(getComputedStyle(pin).backgroundColor).toBe(computed('backgroundColor', 'var(--charcoal)'));
    host!.querySelector('button')!.focus();
    const reached: string[] = [];
    for (let stop = 0; stop < 10; stop += 1) {
      await userEvent.tab();
      const active = document.activeElement as HTMLElement;
      if (!container.contains(active)) break;
      if (!active.classList.contains('apicca-pin')) continue;
      reached.push(active.getAttribute('aria-label')!);
      const style = getComputedStyle(active);
      expect(active.matches(':focus-visible')).toBe(true);
      expect(style.outlineStyle).not.toBe('none');
      expect(style.outlineColor).toBe(computed('color', 'var(--focus)'));
      const others = pins.filter((pin) => pin !== active).map((pin) => Number(getComputedStyle(pin).zIndex));
      expect(Number(style.zIndex)).toBeGreaterThan(Math.max(...others));
    }
    expect(reached).toEqual(EXPECTED_ORDER);
  });

  it('RNF-1 (002), RF-8 (002) · 8.5: con colores forzados no hay tintado y el pin usa Canvas y CanvasText', async () => {
    document.documentElement.dataset['theme'] = theme;
    await forcedColors(true);
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);
    const container = await mount(LISTED);
    expect(getComputedStyle(container.querySelector('.leaflet-tile-pane')!).filter).toBe('none');
    const pin = container.querySelector<HTMLElement>('.apicca-pin')!;
    expect(getComputedStyle(pin).backgroundColor).toBe(computed('backgroundColor', 'Canvas'));
    expect(getComputedStyle(pin).borderTopColor).toBe(computed('color', 'CanvasText'));
    for (const icon of pin.querySelectorAll('.axis-icon')) {
      expect(getComputedStyle(icon).color).toBe(computed('color', 'CanvasText'));
    }
  });

  it('RF-8 (002) · 8.7: sin ápices el mapa se pinta sin errores y sin pines', async () => {
    document.documentElement.dataset['theme'] = theme;
    const errors: unknown[] = [];
    const original = console.error;
    const onError = (event: ErrorEvent) => errors.push(event.error ?? event.message);
    console.error = (...args: unknown[]) => errors.push(args);
    addEventListener('error', onError);
    try {
      const container = await mount([]);
      expect(container.querySelectorAll('.apicca-pin')).toHaveLength(0);
      expect(container.querySelector('.leaflet-control-attribution')).not.toBeNull();
    } finally {
      console.error = original;
      removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
  });
});

describe('inicio con mapa y lista', () => {
  let app: Root | undefined;
  let appHost: HTMLDivElement | undefined;
  let previousPath: string;

  beforeAll(async () => {
    await commands.seedPartial();
    previousPath = location.pathname + location.search;
  });

  afterAll(async () => {
    const mounted = app;
    if (mounted !== undefined) await actNow(() => mounted.unmount());
    appHost?.remove();
    history.replaceState(null, '', previousPath);
  });

  it.each(THEMES)('RF-8 (002) · 8.7: en el tema %s la lista de ápices sigue presente junto al mapa', async (theme) => {
    document.documentElement.dataset['theme'] = theme;
    if (app === undefined) {
      // El mapa y la lista viven en /prototipado (RF-18 (003), D-19 (003)).
      history.replaceState(null, '', '/prototipado');
      appHost = document.createElement('div');
      document.body.append(appHost);
      const created = createRoot(appHost);
      app = created;
      await actNow(() =>
        created.render(
          <SessionProvider source={firebaseSessionSource}>
            <App />
          </SessionProvider>,
        ),
      );
    }
    await waitFor(() => appHost!.querySelector('section[aria-label="Mapa de ápices"] .leaflet-container'));
    const listed = await waitFor(() => [...appHost!.querySelectorAll('main h3')].find((heading) => heading.textContent === LONG_NAME));
    expect(listed.closest('section[aria-label="Mapa de ápices"]')).toBeNull();
  });
});
