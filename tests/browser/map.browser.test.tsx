// Mapa propio en Chromium real (D-T19 (021)): sin teselas, imágenes ni peticiones a otros orígenes y con los colores del
// contrato de tokens en los dos temas (RF-4 (021) · 4.1, 4.2); el norte, la escala y el nombre de cada edificio a la vista
// (4.3, 4.4); se arrastra con el puntero sin elegir lo que queda debajo (RF-8 (021) · 8.1); los controles miden 44 px o más
// (8.2); el teclado mueve el lienzo, cambia de nivel y pasa de un edificio al vecino (8.3 a 8.5); la rueda sola desplaza la
// página y con Ctrl cambia el nivel (8.6); elegir un grupo acerca hasta sus manzanas (RF-7 (021) · 7.2, 7.3); con colores
// forzados las placas usan los colores del sistema (RNF-1 (021)); y en Prototipado el mapa es una vista propia
// (RF-10 (021) · 10.2, 10.3).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cdp, commands, page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { THEMES } from '../../shared/domain/identity';
import type { Axis } from '../../shared/domain/apice';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import type { ListedApice } from '../../src/data/apices';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { GameMap } from '../../src/map/GameMap';
import { LONG_NAME } from './seed-data';

/** Zonas H3 reales de resolución 7 (D-6 (021)): el centro de Bogotá y Medellín. */
const BOGOTA = { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 };
const MEDELLIN = { cell: '876619d92ffffff', lat: 6.243305, lng: -75.585547 };

const apice = (id: string, name: string, axes: Axis[], zone: typeof BOGOTA | null): ListedApice => ({
  id,
  name,
  description: `${name}: ápice de prueba.`,
  axes,
  status: 'idea',
  updatedAt: { seconds: 1_790_000_000, nanoseconds: 0 },
  needs: '',
  location: zone === null ? null : { lat: zone.lat, lng: zone.lng, precision: 'approximate', zone },
});

/** Tres ápices en la misma manzana: el mapa abre en el nivel barrio. */
const BLOCK = [
  apice('a', 'Huerta', ['alimento', 'agua'], BOGOTA),
  apice('b', 'Cocina', ['agua'], BOGOTA),
  apice('c', 'Panel solar', ['energía'], BOGOTA),
];

/** Dos ciudades lejanas: el mapa abre alejado, con un grupo por ciudad. */
const FAR = [apice('a', 'Huerta', ['agua'], BOGOTA), apice('m', 'Radio', ['comunicación'], MEDELLIN)];

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

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** El valor calculado de un color cualquiera (un token o un color del sistema). */
function computed(value: string): string {
  const probe = document.createElement('div');
  probe.style.color = value;
  document.body.append(probe);
  const result = getComputedStyle(probe).color;
  probe.remove();
  return result;
}

/** Monta el mapa con un botón delante, para llegar a él con Tab, y espera a que se quede quieto. */
async function mount(items: readonly ListedApice[], width = 640): Promise<{ map: HTMLElement; onSelect: ReturnType<typeof vi.fn> }> {
  const onSelect = vi.fn();
  host = document.createElement('div');
  host.style.width = `${width}px`;
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() =>
    created.render(
      <>
        <button type="button">antes del mapa</button>
        <GameMap items={items} selectedId={null} onSelect={onSelect} />
      </>,
    ),
  );
  const map = await waitFor(() => host!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
  await settle();
  return { map, onSelect };
}

/** Espera a que terminen el fundido del nivel y la medida del lienzo. */
async function settle() {
  await pause(50);
  await waitFor(() => document.getAnimations().length === 0);
}

/** Centro de un elemento en la ventana. */
function center(element: Element): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

const buildings = (map: HTMLElement) => [...map.querySelectorAll<HTMLButtonElement>('.game-map__building')];
const building = (map: HTMLElement, name: string) => buildings(map).find((button) => button.getAttribute('aria-label') === `${name}, Idea`)!;

/**
 * Un arrastre real con el ratón, desde un punto del mapa (relativo a su esquina) hasta `by` píxeles más allá. Va por el
 * proveedor y no por CDP: la ventana de pruebas está escalada y CDP mide en la ventana de afuera.
 */
async function drag(map: HTMLElement, from: { x: number; y: number }, by: { x: number; y: number }) {
  await userEvent.dragAndDrop(map, map, { sourcePosition: from, targetPosition: { x: from.x + by.x, y: from.y + by.y } });
  await pause(50);
}

/** Un punto de un elemento, relativo a la esquina del mapa. */
function within(map: HTMLElement, element: Element): { x: number; y: number } {
  const box = map.getBoundingClientRect();
  const spot = center(element);
  return { x: spot.x - box.left, y: spot.y - box.top };
}

async function forcedColors(active: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', { features: active ? [{ name: 'forced-colors', value: 'active' }] : [] });
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

describe.each(THEMES)('mapa propio en el tema %s', (theme) => {
  // El marco de pruebas mide 414 px: sin esto, los controles de un mapa de 640 px quedan fuera de la ventana.
  beforeAll(async () => {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(1280, 800);
  });

  it('RF-4 (021) · 4.1, D-T17 (021): el fondo, las placas y los nombres salen de los tokens, sin teselas ni imágenes', async () => {
    document.documentElement.dataset['theme'] = theme;
    const { map } = await mount(BLOCK);
    expect(getComputedStyle(map).backgroundColor).toBe(computed('var(--background)'));
    const plates = [...map.querySelectorAll<SVGCircleElement>('.game-map__plate')];
    expect(plates).toHaveLength(1);
    expect(getComputedStyle(plates[0]!).fill).toBe(computed('var(--surface)'));
    expect(getComputedStyle(plates[0]!).stroke).toBe(computed('var(--line)'));
    for (const name of map.querySelectorAll('.game-map__name')) expect(getComputedStyle(name).color).toBe(computed('var(--text)'));
    expect(map.querySelectorAll('img, image, .leaflet-container')).toHaveLength(0);
  });

  it('RF-4 (021) · 4.2: dibujar y mover el mapa no pide nada a otros orígenes', async () => {
    document.documentElement.dataset['theme'] = theme;
    const since = performance.now();
    const { map } = await mount(FAR);
    await userEvent.click(map.querySelector<HTMLElement>('.game-map__group')!);
    await settle();
    await drag(map, { x: map.clientWidth / 2, y: map.clientHeight / 2 }, { x: 60, y: 30 });
    await settle();
    const foreign = performance
      .getEntriesByType('resource')
      .filter((entry) => entry.startTime >= since && new URL(entry.name).origin !== location.origin);
    expect(foreign.map((entry) => entry.name)).toEqual([]);
  });

  it('RF-4 (021) · 4.3, 4.4, RF-5 (019), RF-8 (021) · 8.5: el norte, la escala y el nombre de cada edificio están a la vista; el nombre accesible lleva la etapa', async () => {
    document.documentElement.dataset['theme'] = theme;
    const { map } = await mount(BLOCK);
    const north = map.querySelector<HTMLElement>('[aria-label="Norte arriba"]')!;
    expect(north.textContent).toBe('N');
    const scale = map.querySelector<HTMLElement>('.game-map__scale')!;
    expect(scale.textContent).toMatch(/^\d+ (km|m)$/);
    expect(scale.getBoundingClientRect().width).toBeGreaterThan(20);
    const box = map.getBoundingClientRect();
    for (const [index, name] of ['Huerta', 'Cocina', 'Panel solar'].entries()) {
      const button = building(map, name);
      expect(button, name).toBeDefined();
      const label = button.querySelector<HTMLElement>('.game-map__name')!;
      expect(label.textContent).toBe(name);
      const area = label.getBoundingClientRect();
      expect(area.width, `${index}`).toBeGreaterThan(0);
      expect(area.left).toBeGreaterThanOrEqual(box.left);
      expect(area.right).toBeLessThanOrEqual(box.right);
    }
  });

  it('RF-8 (021) · 8.2, RF-2 (020) · 2.1: acercar, alejar y ver todo miden al menos 44 × 44 px', async () => {
    document.documentElement.dataset['theme'] = theme;
    const { map } = await mount(BLOCK);
    const controls = [...map.querySelectorAll<HTMLElement>('.game-map__control')];
    expect(controls.map((control) => control.getAttribute('aria-label'))).toEqual(['Acercar', 'Alejar', 'Ver todo']);
    for (const control of controls) {
      const { width, height } = control.getBoundingClientRect();
      expect(width).toBeGreaterThanOrEqual(44);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  it('RNF-1 (021), RNF-1 (002): con colores forzados las placas y el lienzo usan los colores del sistema', async () => {
    document.documentElement.dataset['theme'] = theme;
    await forcedColors(true);
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);
    const { map } = await mount(BLOCK);
    const plate = map.querySelector<SVGCircleElement>('.game-map__plate')!;
    expect(getComputedStyle(plate).fill).toBe(computed('Canvas'));
    expect(getComputedStyle(plate).stroke).toBe(computed('CanvasText'));
    expect(getComputedStyle(map).borderTopColor).toBe(computed('CanvasText'));
  });
});

describe('moverse por el mapa', () => {
  let spacer: HTMLDivElement | undefined;

  beforeAll(async () => {
    await page.viewport(1280, 800);
  });

  afterEach(async () => {
    spacer?.remove();
    spacer = undefined;
    await userEvent.keyboard('{/Control}');
    scrollTo(0, 0);
  });

  it('RF-8 (021) · 8.1: arrastrar mueve el lienzo con el puntero y no elige ningún edificio', async () => {
    const { map, onSelect } = await mount(BLOCK);
    const before = center(building(map, 'Cocina'));
    await drag(map, { x: 24, y: 24 }, { x: 100, y: 50 });
    const after = center(building(map, 'Cocina'));
    expect(after.x - before.x).toBeCloseTo(100, 0);
    expect(after.y - before.y).toBeCloseTo(50, 0);
    // Empezar el arrastre sobre un edificio tampoco lo elige.
    await drag(map, within(map, building(map, 'Huerta')), { x: -60, y: 0 });
    expect(onSelect).not.toHaveBeenCalled();
    // Un clic sí lo elige.
    await userEvent.click(building(map, 'Huerta'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('RF-8 (021) · 8.3, RF-7 (021) · 7.1: con el foco en el lienzo, las flechas lo mueven y + y - cambian el nivel', async () => {
    const { map } = await mount(BLOCK);
    expect(map.dataset['level']).toBe('0');
    host!.querySelector('button')!.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(map);
    const before = center(building(map, 'Cocina'));
    await userEvent.keyboard('{ArrowRight}');
    expect(center(building(map, 'Cocina')).x).toBeCloseTo(before.x - 80, 0);
    await userEvent.keyboard('-');
    await settle();
    expect(map.dataset['level']).toBe('1');
    await userEvent.keyboard('-');
    await settle();
    expect(map.dataset['level']).toBe('2');
    await userEvent.keyboard('+');
    await userEvent.keyboard('+');
    await settle();
    expect(map.dataset['level']).toBe('0');
  });

  it('RF-8 (021) · 8.4, 8.5: un solo edificio está en el orden del tabulador; las flechas pasan al vecino y el foco usa focus', async () => {
    const { map } = await mount(BLOCK);
    expect(buildings(map).filter((button) => button.tabIndex === 0)).toHaveLength(1);
    host!.querySelector('button')!.focus();
    await userEvent.tab();
    await userEvent.tab();
    const first = document.activeElement as HTMLElement;
    expect(first.classList.contains('game-map__building')).toBe(true);
    expect(first.matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(first).outlineColor).toBe(computed('var(--focus)'));
    const reached = new Set([first.getAttribute('aria-label')]);
    for (const key of ['{ArrowRight}', '{ArrowDown}', '{ArrowLeft}', '{ArrowUp}']) {
      await userEvent.keyboard(key);
      reached.add((document.activeElement as HTMLElement).getAttribute('aria-label'));
    }
    expect(reached.size).toBeGreaterThan(1);
    for (const label of reached) expect(label).toMatch(/, Idea$/);
    // Tab sale del mapa sin pasar por los otros edificios.
    await userEvent.tab();
    expect((document.activeElement as HTMLElement).classList.contains('game-map__building')).toBe(false);
  });

  it('RF-8 (021) · 8.6: con el puntero sobre el mapa, la rueda sola desplaza la página y con Ctrl cambia el nivel', async () => {
    const { map } = await mount(BLOCK);
    spacer = document.createElement('div');
    spacer.style.height = '3000px';
    document.body.append(spacer);
    scrollTo(0, 0);
    await userEvent.wheel(map, { delta: { y: 300 }, times: 3 });
    await waitFor(() => scrollY > 0);
    await pause(300);
    expect(map.dataset['level']).toBe('0');
    scrollTo(0, 0);
    await pause(100);
    await userEvent.keyboard('{Control>}');
    await userEvent.wheel(map, { delta: { y: 100 } });
    await waitFor(() => map.dataset['level'] === '1');
    await pause(400);
    await userEvent.wheel(map, { delta: { y: -100 } });
    await waitFor(() => map.dataset['level'] === '0');
    await userEvent.keyboard('{/Control}');
    expect(scrollY).toBe(0);
  });

  it('RF-7 (021) · 7.2, 7.3, 7.4: con dos ciudades el mapa abre alejado y elegir un grupo acerca hasta sus manzanas', async () => {
    const { map } = await mount(FAR);
    expect(Number(map.dataset['level'])).toBeGreaterThan(0);
    const groups = [...map.querySelectorAll<HTMLButtonElement>('.game-map__group')];
    expect(groups.map((group) => group.getAttribute('aria-label')).sort()).toEqual(['1 ápice, acercar', '1 ápice, acercar']);
    const box = map.getBoundingClientRect();
    for (const group of groups) {
      const spot = center(group);
      expect(spot.x).toBeGreaterThan(box.left);
      expect(spot.x).toBeLessThan(box.right);
      expect(spot.y).toBeGreaterThan(box.top);
      expect(spot.y).toBeLessThan(box.bottom);
    }
    await userEvent.click(groups[0]!);
    await settle();
    expect(map.dataset['level']).toBe('0');
    expect(buildings(map).length).toBeGreaterThan(0);
    expect((document.activeElement as HTMLElement).classList.contains('game-map__building')).toBe(true);
  });
});

describe('el mapa en Jugar', () => {
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

  it('RF-17 (021) · 17.1, RF-10 (021) · 10.2, 10.3, RF-9 (021) · 9.1: /prototipado?vista=mapa lleva al mapa, sin lista ni teselas, y el ápice sin ubicación va aparte', async () => {
    history.replaceState(null, '', '/prototipado?vista=mapa');
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
    const map = await waitFor(() => appHost!.querySelector<HTMLElement>('section[aria-label="Mapa de ápices"]'));
    const seeded = await waitFor(() => map.querySelector<HTMLElement>(`[aria-label="${LONG_NAME}, Idea"]`));
    expect(seeded.closest('[role="group"][aria-label="Sin ubicación"]')).not.toBeNull();
    expect(appHost.querySelector('.apice-lot, .leaflet-container')).toBeNull();
    expect([...appHost.querySelectorAll('main h3')].some((heading) => heading.textContent === LONG_NAME)).toBe(false);
    expect(location.pathname).toBe('/');
    expect([...appHost.querySelectorAll('button')].map((button) => button.textContent)).toEqual(expect.arrayContaining(['Ver como lista']));
    expect([...appHost.querySelectorAll('button')].map((button) => button.textContent)).not.toContain('Ver como terreno');
  });
});
