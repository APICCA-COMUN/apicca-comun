// RF-18 (021) · 18.5, 18.6, D-T30 (021) · Las Acciones Comunes del mapa en Chromium real, con «E3 · Celda»: cada una es un
// Arco (SVG `.game-map__arc`) con el trazo en el color de la tinta y un halo del color del papel que lo despega de lo que
// cruza, un disco en cada parada y puntas redondas; la cerrada va con línea discontinua y lo dice su rótulo, el borrador de
// «Conectar» con guiones cortos, la elegida más gruesa y la apagada en `trama`. El Arco es decorativo (`aria-hidden`): la
// Acción Común se alcanza por su rótulo, un botón con nombre y sin caja. Con colores forzados el Arco lleva CanvasText.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp, page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { TOKENS, hexToRgb } from '../../shared/domain/identity';
import type { Location } from '../../shared/domain/location';
import type { ListedApice } from '../../src/data/apices';
import { GameMap, type MapPath } from '../../src/map/GameMap';
import { listed } from '../../src/testing/listDoubles';

let host: HTMLDivElement;
let root: Root;

const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;

const zone = (cell: string, lat: number, lng: number): Location => ({ lat, lng, precision: 'approximate', zone: { cell, lat, lng } });
/** Dos zonas reales de resolución 7, el centro de Bogotá y la vecina del occidente (como en `mapArcs.test.ts`): los Arcos unen
    Ápices de una y otra. */
const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
const CHAPINERO = zone('8766e0905ffffff', 4.61069, -74.103401);
const items: ListedApice[] = [1, 2, 3, 4, 5].map((n) => listed(n, { location: n <= 2 ? CENTRO : CHAPINERO }));

const ABIERTO: MapPath = { id: 'abierto', title: 'Agua lluvia', closed: false, axis: 'agua', apiceIds: ['a1', 'a4'] };
const CERRADO: MapPath = { id: 'cerrado', title: 'Huerta', closed: true, axis: 'alimento', apiceIds: ['a2', 'a5'] };
const BORRADOR: MapPath = { id: 'borrador', title: 'Borrador', closed: false, draft: true, apiceIds: ['a3', 'a5'] };

async function mount(paths: readonly MapPath[], selectedPathId: string | null = null) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(<GameMap items={items} selectedId={null} onSelect={() => {}} paths={paths} selectedPathId={selectedPathId} />));
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

const arc = (id: string) => host.querySelector<SVGGElement>(`.game-map__arc[data-arc="${id}"]`)!;
const lines = (id: string) => [...arc(id).querySelectorAll<SVGPathElement>('path.game-map__arc-line')];
const halos = (id: string) => [...arc(id).querySelectorAll<SVGPathElement>('path.game-map__arc-halo')];
const discs = (id: string) => [...arc(id).querySelectorAll<SVGCircleElement>('circle.game-map__arc-disc')];
const discHalos = (id: string) => [...arc(id).querySelectorAll<SVGCircleElement>('circle.game-map__arc-disc-halo')];

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

  it('RF-18 (021) · 18.5, D-T30 (021): el Arco es un trazo de tinta con halo de papel y un disco en cada parada, sin celdas de ruta', async () => {
    await mount([ABIERTO, CERRADO]);
    // Nada del dibujo viejo: ni cadena de celdas ni polilínea ni glifos dentro del mapa.
    expect(host.querySelector('polygon.game-map__route')).toBeNull();
    expect(host.querySelector('polyline.game-map__line')).toBeNull();
    expect(host.querySelector('[class*="game-map__glyph--"]')).toBeNull();
    for (const id of ['abierto', 'cerrado']) {
      expect(lines(id).length).toBeGreaterThan(0);
      for (const line of lines(id)) {
        const style = getComputedStyle(line);
        expect(style.stroke).toBe(rgb(TOKENS[theme].text));
        expect(style.fill).toBe('none');
        expect(Number.parseFloat(style.strokeWidth)).toBeGreaterThanOrEqual(1.4);
      }
      // Halo del color del papel, más ancho que el trazo: despega la línea de lo que cruza.
      expect(halos(id).length).toBe(lines(id).length);
      for (const [index, halo] of halos(id).entries()) {
        expect(getComputedStyle(halo).stroke).toBe(rgb(TOKENS[theme].background));
        expect(Number.parseFloat(getComputedStyle(halo).strokeWidth)).toBeGreaterThan(Number.parseFloat(getComputedStyle(lines(id)[index]!).strokeWidth));
      }
      // Un disco de tinta en cada extremo, con su propio halo de papel.
      expect(discs(id).length).toBe(2);
      for (const disc of discs(id)) expect(getComputedStyle(disc).fill).toBe(rgb(TOKENS[theme].text));
      expect(discHalos(id).length).toBe(2);
      for (const halo of discHalos(id)) expect(getComputedStyle(halo).fill).toBe(rgb(TOKENS[theme].background));
    }
  });

  it('RF-18 (021) · 18.6: la cerrada va discontinua y su rótulo dice «Cerrada»; la abierta, continua', async () => {
    await mount([ABIERTO, CERRADO]);
    for (const line of lines('abierto')) {
      expect(getComputedStyle(line).strokeDasharray).toBe('none');
      expect(getComputedStyle(line).strokeLinecap).toBe('round');
    }
    for (const line of lines('cerrado')) expect(getComputedStyle(line).strokeDasharray).not.toBe('none');
    // La forma lo dice además del rótulo: el color nunca es la única señal.
    expect(host.querySelector('[aria-label="Acción Común: Huerta · Cerrada"]')?.textContent).toBe('Huerta · Cerrada');
    expect(host.querySelector('[aria-label="Acción Común: Agua lluvia"]')?.textContent).toBe('Agua lluvia');
  });

  it('RF-18 (021) · 18.5: el borrador de «Conectar» va con guiones cortos, distintos de los de la cerrada', async () => {
    await mount([CERRADO, BORRADOR]);
    const draft = lines('borrador');
    expect(draft.length).toBeGreaterThan(0);
    for (const line of draft) expect(getComputedStyle(line).strokeDasharray).not.toBe('none');
    expect(getComputedStyle(draft[0]!).strokeDasharray).not.toBe(getComputedStyle(lines('cerrado')[0]!).strokeDasharray);
    // El borrador no tiene rótulo: no es una Acción Común todavía.
    expect(host.querySelector('[aria-label^="Acción Común: Borrador"]')).toBeNull();
  });

  it('RF-18 (021) · 18.5: la Acción Común elegida se dibuja más gruesa y las demás se apagan en trama, con su disco en trama', async () => {
    await mount([ABIERTO, CERRADO]);
    const normal = Number.parseFloat(getComputedStyle(lines('abierto')[0]!).strokeWidth);
    await mount([ABIERTO, CERRADO], 'abierto');
    expect(arc('abierto').dataset['selected']).toBe('true');
    expect(Number.parseFloat(getComputedStyle(lines('abierto')[0]!).strokeWidth)).toBeGreaterThan(normal);
    // La elegida sigue en tinta; la otra, apagada, en trama (decoración: su rótulo y su nombre siguen ahí).
    for (const line of lines('abierto')) expect(getComputedStyle(line).stroke).toBe(rgb(TOKENS[theme].text));
    expect(arc('cerrado').dataset['off']).toBe('true');
    for (const line of lines('cerrado')) expect(getComputedStyle(line).stroke).toBe(rgb(TOKENS[theme].trama));
    for (const disc of discs('cerrado')) expect(getComputedStyle(disc).fill).toBe(rgb(TOKENS[theme].trama));
    expect(host.querySelector('[aria-label="Acción Común: Huerta · Cerrada"]')?.getAttribute('data-off')).toBe('true');
  });

  it('RF-18 (021) · 18.7: el Arco no entra en el árbol de accesibilidad y no recibe el puntero; el rótulo es un botón con nombre y sin caja', async () => {
    await mount([ABIERTO, CERRADO], 'abierto');
    const layer = host.querySelector<SVGSVGElement>('svg.game-map__arcs')!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(layer).pointerEvents).toBe('none');
    for (const [id, name] of [['abierto', 'Acción Común: Agua lluvia'], ['cerrado', 'Acción Común: Huerta · Cerrada']] as const) {
      const label = host.querySelector<HTMLButtonElement>(`button.game-map__path-label[aria-label="${name}"]`)!;
      expect(label).not.toBeNull();
      expect(label.closest('[aria-hidden="true"]')).toBeNull();
      expect(arc(id).closest('svg')!.getAttribute('aria-hidden')).toBe('true');
      const style = getComputedStyle(label);
      expect(style.borderTopWidth).toBe('0px');
      expect(style.borderRadius).toBe('0px');
      expect(style.boxShadow).toBe('none');
      expect(style.textTransform).toBe('uppercase');
      expect(style.backgroundColor).toBe(rgb(TOKENS[theme].background));
    }
    expect(host.querySelector('button.game-map__path-label[aria-label="Acción Común: Agua lluvia"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('button.game-map__path-label[aria-label="Acción Común: Huerta · Cerrada"]')?.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Acciones Comunes del mapa con colores forzados (021)', () => {
  it('RF-18 (021) · 18.5, D-T30 (021): el trazo, los discos y el halo del Arco calculan CanvasText y Canvas', async () => {
    await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
    await mount([ABIERTO, CERRADO]);
    const probe = document.createElement('span');
    probe.style.color = 'CanvasText';
    host.append(probe);
    const canvasText = getComputedStyle(probe).color;
    probe.style.color = 'Canvas';
    const canvas = getComputedStyle(probe).color;
    expect(lines('abierto').length).toBeGreaterThan(0);
    for (const line of lines('abierto')) expect(getComputedStyle(line).stroke).toBe(canvasText);
    for (const disc of discs('abierto')) expect(getComputedStyle(disc).fill).toBe(canvasText);
    for (const halo of halos('abierto')) expect(getComputedStyle(halo).stroke).toBe(canvas);
  });
});
