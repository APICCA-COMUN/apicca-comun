// RF-18 (021) · 18.5, 18.6, D-T30 (021) · Las Acciones Comunes del mapa en Chromium real, con el sistema «APICCA · Mapa»: cada
// una es una fila de celdas rellenas con el token `ruta`, sin redondeos (uniones en inglete) y con el glifo de su eje en el
// color del eje, que contrasta 3:1 o más con la celda en los dos temas; la cerrada va con borde discontinuo y lo dice su
// rótulo; con colores forzados las celdas llevan CanvasText.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp, page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { TOKENS, contrastRatio, hexToRgb } from '../../shared/domain/identity';
import type { Location } from '../../shared/domain/location';
import type { ListedApice } from '../../src/data/apices';
import { GameMap } from '../../src/map/GameMap';
import { listed } from '../../src/testing/listDoubles';

let host: HTMLDivElement;
let root: Root;

const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;

const zone = (cell: string, lat: number, lng: number): Location => ({ lat, lng, precision: 'approximate', zone: { cell, lat, lng } });
/** Dos zonas reales de resolución 7, el centro de Bogotá y la vecina del occidente (como en `mapPaths.test.ts`): las rutas unen Ápices de una
    y otra, lejos entre sí, así llevan celdas de ruta en medio (las celdas vecinas no las necesitan). */
const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
const CHAPINERO = zone('8766e0905ffffff', 4.61069, -74.103401);
const items: ListedApice[] = [1, 2, 3, 4, 5].map((n) => listed(n, { location: n <= 2 ? CENTRO : CHAPINERO }));

async function mount() {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () =>
      root.render(
        <GameMap
          items={items}
          selectedId={null}
          onSelect={() => {}}
          paths={[
            { id: 'abierto', title: 'Agua lluvia', closed: false, axis: 'agua', apiceIds: ['a1', 'a4'] },
            { id: 'cerrado', title: 'Huerta', closed: true, axis: 'alimento', apiceIds: ['a2', 'a5'] },
          ]}
        />,
      ),
    );
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

const routes = (closed: boolean) => [...host.querySelectorAll<SVGPolygonElement>(`polygon.game-map__route${closed ? '[data-closed="true"]' : ':not([data-closed])'}`)];

beforeEach(async () => {
  await page.viewport(1280, 800);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  await act(async () => root.unmount());
  host.remove();
});

describe.each(['light', 'dark'] as const)('Acciones Comunes del mapa en el tema %s (021)', (theme) => {
  beforeEach(() => {
    document.documentElement.dataset['theme'] = theme;
  });

  it('RF-18 (021) · 18.5, D-T30 (021): las celdas de la Acción Común van en el token ruta, sin redondeos, y su glifo contrasta 3:1 con ellas', async () => {
    await mount();
    expect(host.querySelector('polyline.game-map__line')).toBeNull();
    expect(routes(false).length).toBeGreaterThan(0);
    expect(routes(true).length).toBeGreaterThan(0);
    for (const cell of [...routes(false), ...routes(true)]) {
      const style = getComputedStyle(cell);
      expect(style.fill).toBe(rgb(TOKENS[theme].ruta));
      expect(style.strokeLinejoin).toBe('miter');
    }
    // El glifo del eje va en el color del eje y se lee sobre la celda, sin depender del color: la forma lo dice también.
    for (const [axis, key] of [['agua', 'axis-agua-fill'], ['alimento', 'axis-alimento-fill']] as const) {
      const glyph = host.querySelector<SVGElement>(`.game-map__glyph--${axis}`)!;
      expect(getComputedStyle(glyph).color).toBe(rgb(TOKENS[theme][key]));
      expect(contrastRatio(TOKENS[theme][key], TOKENS[theme].ruta)).toBeGreaterThanOrEqual(3);
    }
  });

  it('RF-18 (021) · 18.6: la cerrada va con borde discontinuo y su rótulo dice «Cerrada»; la abierta, sin trazo', async () => {
    await mount();
    for (const cell of routes(false)) {
      expect(getComputedStyle(cell).strokeDasharray).toBe('none');
      expect(getComputedStyle(cell).stroke).toBe('none');
    }
    for (const cell of routes(true)) expect(getComputedStyle(cell).strokeDasharray).not.toBe('none');
    expect(host.querySelector('[aria-label="Acción Común: Huerta · Cerrada"]')?.textContent).toBe('Huerta · Cerrada');
    expect(host.querySelector('[aria-label="Acción Común: Agua lluvia"]')?.textContent).toBe('Agua lluvia');
  });
});

describe('Acciones Comunes del mapa con colores forzados (021)', () => {
  it('RF-18 (021) · 18.5, D-T30 (021): el trazo de las celdas calcula CanvasText', async () => {
    await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
    await mount();
    const probe = document.createElement('span');
    probe.style.color = 'CanvasText';
    host.append(probe);
    const canvasText = getComputedStyle(probe).color;
    expect(routes(false).length).toBeGreaterThan(0);
    for (const cell of routes(false)) expect(getComputedStyle(cell).stroke).toBe(canvasText);
  });
});
