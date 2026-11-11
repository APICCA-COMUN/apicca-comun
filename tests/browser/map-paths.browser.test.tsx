// RF-18 (021) · 18.5, 18.6, D-T30 (021) · Los caminos del mapa en Chromium real: trazo de 12 px en `node-ring`, con extremos
// y uniones redondeados, que contrasta 3:1 o más con el fondo en los dos temas; el cerrado va punteado y lo dice su rótulo;
// con colores forzados el trazo es CanvasText.
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
/** Una zona real de resolución 7, el centro de Bogotá (como en `GameMap.test.tsx`). Los cinco ápices caen en la misma
    manzana, así el encuadre inicial muestra cada edificio por separado y los caminos tienen tramos. */
const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
const items: ListedApice[] = [1, 2, 3, 4, 5].map((n) => listed(n, { location: CENTRO }));

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
            { id: 'abierto', title: 'Agua lluvia', closed: false, apiceIds: ['a1', 'a2', 'a3'] },
            { id: 'cerrado', title: 'Huerta', closed: true, apiceIds: ['a3', 'a4'] },
          ]}
        />,
      ),
    );
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

const lines = () => [...host.querySelectorAll<SVGPolylineElement>('polyline.game-map__path')];

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

describe.each(['light', 'dark'] as const)('caminos del mapa en el tema %s (021)', (theme) => {
  beforeEach(() => {
    document.documentElement.dataset['theme'] = theme;
  });

  it('RF-18 (021) · 18.5, D-T30 (021): el trazo es de 12 px en node-ring, redondeado, y contrasta 3:1 con el fondo', async () => {
    await mount();
    expect(lines()).toHaveLength(2);
    for (const line of lines()) {
      const style = getComputedStyle(line);
      expect(style.stroke).toBe(rgb(TOKENS[theme]['node-ring']));
      expect(parseFloat(style.strokeWidth)).toBe(12);
      expect(style.strokeLinecap).toBe('round');
      expect(style.strokeLinejoin).toBe('round');
    }
    expect(contrastRatio(TOKENS[theme]['node-ring'], TOKENS[theme].background)).toBeGreaterThanOrEqual(3);
  });

  it('RF-18 (021) · 18.6: el cerrado va punteado y su rótulo dice «Cerrado»; el abierto, continuo', async () => {
    await mount();
    const [open, closed] = lines();
    expect(getComputedStyle(open!).strokeDasharray).toBe('none');
    expect(getComputedStyle(closed!).strokeDasharray).not.toBe('none');
    expect(host.querySelector('[aria-label="Camino: Huerta · Cerrado"]')?.textContent).toBe('Huerta · Cerrado');
  });
});

describe('caminos del mapa con colores forzados (021)', () => {
  it('RF-18 (021) · 18.5, D-T30 (021): el trazo calcula CanvasText', async () => {
    await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
    await mount();
    const probe = document.createElement('span');
    probe.style.color = 'CanvasText';
    host.append(probe);
    const canvasText = getComputedStyle(probe).color;
    for (const line of lines()) expect(getComputedStyle(line).stroke).toBe(canvasText);
  });
});
