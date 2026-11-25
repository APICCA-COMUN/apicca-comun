// «E3 · Celda» · tercera revisión de QA del 24-11-2026 (qa-agy-celda-3), errores de la parte B, en Chromium real:
// 1. los Arcos vivos (el borrador de «Conectar» incluido) y sus discos quedan por encima de todas las celdas, también las
//    pulsadas, apuntadas o enfocadas; los apagados, por debajo; la capa no roba clics;
// 2. en «Conectar» los Ápices marcados no muestran su nombre por estarlo (se pisarían y caerían sobre patrones, regla 5): solo
//    al apuntar o enfocar uno, de uno en uno;
// 3. al alejar a nivel 2 en «Conectar» y activar un filtro (la leyenda crece y el mapa se acorta), ningún grupo queda recortado
//    por el borde del mapa ni bajo la leyenda.
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/piezas.css';
import '../../src/components/SiteHeader.css';
import { SessionProvider, type SessionState } from '../../src/app/session';
import type { ListedApice } from '../../src/data/apices';
import { GameMap, type MapPath } from '../../src/map/GameMap';
import { Play } from '../../src/pages/Play';
import { listed } from '../../src/testing/listDoubles';
import type { Location } from '../../shared/domain/location';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };

const BOGOTA: Location = { lat: 4.597156, lng: -74.08474, precision: 'approximate', zone: { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 } };
const CHAPINERO: Location = { lat: 4.649886, lng: -74.060244, precision: 'approximate', zone: { cell: '8766e42d2ffffff', lat: 4.649886, lng: -74.060244 } };
const SUBA: Location = { lat: 4.74316, lng: -74.091715, precision: 'approximate', zone: { cell: '8766e4281ffffff', lat: 4.74316, lng: -74.091715 } };

let bench: HTMLDivElement | undefined;
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

async function mount(width: number, height: number, ui: React.ReactElement, path = '/') {
  await page.viewport(width, height);
  window.localStorage.setItem('apicca:bienvenida', '1');
  history.replaceState(null, '', path);
  bench = document.createElement('div');
  document.body.append(bench);
  const mounted = createRoot(bench);
  root = mounted;
  await actNow(() => mounted.render(ui));
}

afterEach(async () => {
  window.localStorage.removeItem('apicca:bienvenida');
  if (root !== undefined) await actNow(() => root!.unmount());
  root = undefined;
  bench?.remove();
  bench = undefined;
  history.replaceState(null, '', '/');
  await page.viewport(1280, 800);
});

const zIndexOf = (element: Element): number => {
  const value = getComputedStyle(element).zIndex;
  return value === 'auto' ? 0 : Number.parseInt(value, 10);
};

/** Cuatro Ápices en una misma zona. */
const four = (): ListedApice[] => [1, 2, 3, 4].map((n) => listed(n, { location: BOGOTA, axes: [(['agua', 'alimento', 'cobijo', 'energía'] as const)[n - 1]!] }));
const apices = () => [...bench!.querySelectorAll<HTMLElement>('.game-map__apice')];

describe('QA celda 3 · 1: los Arcos vivos van por encima de todas las celdas', () => {
  const draft = (ids: string[]): MapPath[] => [{ id: 'borrador', title: '', closed: false, apiceIds: ids, draft: true, axis: 'agua' }];
  const live = (): MapPath[] => [{ id: 'viva', title: 'Una acción', closed: false, apiceIds: ['a1', 'a3'], axis: 'agua' }];

  it('el borrador de «Conectar» y sus discos quedan sobre las celdas marcadas, apuntadas o enfocadas, y no reciben el puntero', async () => {
    await mount(1280, 800, <GameMap items={four()} selectedId={null} onSelect={() => {}} chosenIds={new Set(['a1', 'a3'])} paths={draft(['a1', 'a3'])} startClose />);
    await expect.poll(() => apices().length).toBe(4);
    const layer = bench!.querySelector<SVGElement>('svg.game-map__arcs[data-layer="live"]')!;
    expect(layer.querySelector('[data-draft="true"] .game-map__arc-disc'), 'el borrador dibuja sus discos').toBeTruthy();
    expect(getComputedStyle(layer).pointerEvents).toBe('none');
    const marked = apices().filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(marked).toHaveLength(2);
    const above = zIndexOf(layer);
    for (const cell of marked) expect(above, 'sobre las celdas pulsadas').toBeGreaterThan(zIndexOf(cell));
    // Apuntada y enfocada: el z-index de la celda sube, el del Arco sigue por encima.
    const plain = apices().find((c) => c.getAttribute('aria-pressed') === 'false')!;
    await userEvent.hover(plain);
    expect(above, 'sobre la celda apuntada').toBeGreaterThan(zIndexOf(plain));
    plain.focus();
    expect(above, 'sobre la celda enfocada').toBeGreaterThan(zIndexOf(plain));
    expect(zIndexOf(plain), 'la celda apuntada sí sube sobre las vecinas').toBeGreaterThan(0);
    // Los dos mandan en el mismo contexto (el origen del lienzo), así que la comparación vale.
    expect(layer.parentElement).toBe(plain.closest('.game-map__world'));
  });

  it('un disco del Arco no roba el clic: el puntero sobre él llega a la celda', async () => {
    let chosen: string | null = null;
    await mount(1280, 800, <GameMap items={four()} selectedId={null} onSelect={(id) => (chosen = id)} chosenIds={new Set(['a1', 'a3'])} paths={draft(['a1', 'a3'])} startClose />);
    await expect.poll(() => apices().length).toBe(4);
    const disc = bench!.querySelector<SVGGraphicsElement>('[data-draft="true"] .game-map__arc-disc')!.getBoundingClientRect();
    const at = document.elementFromPoint(disc.left + disc.width / 2, disc.top + disc.height / 2);
    expect(at?.closest('button.game-map__apice'), 'bajo el disco hay una celda que recibe el puntero').toBeTruthy();
    expect(at?.closest('svg.game-map__arcs')).toBeNull();
    await userEvent.click(at!.closest('button')!);
    expect(chosen).not.toBeNull();
  });

  it('el Arco vivo de la Acción Común elegida va sobre la celda del Ápice elegido; los apagados, bajo las celdas', async () => {
    const paths: MapPath[] = [...live(), { id: 'otra', title: 'Otra', closed: false, apiceIds: ['a2', 'a4'], axis: 'agua' }];
    await mount(1280, 800, <GameMap items={four()} selectedId="a1" onSelect={() => {}} paths={paths} startClose />);
    await expect.poll(() => apices().length).toBe(4);
    const liveLayer = bench!.querySelector<SVGElement>('svg.game-map__arcs[data-layer="live"]')!;
    const offLayer = bench!.querySelector<SVGElement>('svg.game-map__arcs[data-layer="off"]')!;
    const selected = apices().find((c) => c.getAttribute('aria-pressed') === 'true')!;
    expect(zIndexOf(liveLayer)).toBeGreaterThan(zIndexOf(selected));
    expect(liveLayer.querySelector('[data-arc="viva"] .game-map__arc-disc')).toBeTruthy();
    expect(offLayer.querySelector('[data-arc="otra"][data-off="true"]')).toBeTruthy();
    for (const cell of apices()) expect(zIndexOf(offLayer), 'el apagado queda bajo todas las celdas').toBeLessThanOrEqual(zIndexOf(cell));
    // El apagado va antes que las celdas en el documento.
    expect(offLayer.compareDocumentPosition(apices()[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('el contorno de foco de una celda sigue visible', async () => {
    await mount(1280, 800, <GameMap items={four()} selectedId={null} onSelect={() => {}} chosenIds={new Set(['a1', 'a3'])} paths={draft(['a1', 'a3'])} startClose />);
    await expect.poll(() => apices().length).toBe(4);
    await userEvent.tab();
    const focused = document.activeElement as HTMLElement;
    const style = getComputedStyle(focused.closest('.game-map__apice') ?? focused);
    expect(style.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0);
  });
});

describe('QA celda 3 · 2: los nombres de los Ápices marcados en «Conectar»', () => {
  const tagOf = (cell: HTMLElement) => cell.querySelector<HTMLElement>('.game-map__tag')!;
  const shown = () => apices().filter((c) => getComputedStyle(tagOf(c)).display !== 'none');

  for (const width of [1280, 360]) {
    it(`a ${width} px, con cuatro marcados ningún nombre se muestra por estarlo, y al apuntar o enfocar sale uno solo`, async () => {
      await mount(width, 800, <GameMap items={four()} selectedId={null} onSelect={() => {}} chosenIds={new Set(['a1', 'a2', 'a3', 'a4'])} startClose />);
      await expect.poll(() => apices().length).toBe(4);
      expect(apices().every((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);
      expect(shown(), 'ningún nombre a la vista con solo estar marcados').toHaveLength(0);
      await userEvent.hover(apices()[1]!);
      expect(shown()).toEqual([apices()[1]]);
      await userEvent.unhover(apices()[1]!);
      expect(shown()).toHaveLength(0);
      apices()[2]!.focus();
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      await userEvent.tab();
      expect(shown().length, 'el foco muestra un nombre solo').toBeLessThanOrEqual(1);
    });
  }

  it('fuera de «Conectar», el Ápice elegido sigue mostrando su nombre; marcado y elegido a la vez también', async () => {
    await mount(1280, 800, <GameMap items={four()} selectedId="a2" onSelect={() => {}} startClose />);
    await expect.poll(() => apices().length).toBe(4);
    expect(shown()).toEqual([apices()[1]]);
    await actNow(() => root!.unmount());
    root = undefined;
    bench!.remove();
    bench = undefined;
    await mount(1280, 800, <GameMap items={four()} selectedId="a2" onSelect={() => {}} chosenIds={new Set(['a2'])} startClose />);
    await expect.poll(() => apices().length).toBe(4);
    expect(shown()).toEqual([apices()[1]]);
  });
});

describe('QA celda 3 · 3: «Conectar» alejado y con filtro', () => {
  const spread = (): ListedApice[] => [
    listed(1, { location: BOGOTA }),
    listed(2, { location: BOGOTA, axes: ['alimento'] }),
    listed(3, { location: CHAPINERO }),
    listed(4, { location: SUBA, axes: ['energía'] }),
    listed(5),
    listed(6, { axes: ['cobijo'] }),
  ];
  const play = () => (
    <SessionProvider initial={PERSON}>
      <main className="main--play">
        <Play
          source={{ fetchPage: async () => ({ items: spread(), cursor: null }) }}
          actionSource={{ list: async () => [], get: async () => null }}
          noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
        />
      </main>
    </SessionProvider>
  );
  const levelNow = () => bench!.querySelector('.game-map')?.getAttribute('data-level');

  /** Todo lo que el mapa dibuja como celda debe quedar dentro de la ventana del mapa, que acaba donde empieza la leyenda. */
  function expectNothingUnderLegend() {
    const surface = bench!.querySelector<HTMLElement>('.play__surface')!.getBoundingClientRect();
    const legend = bench!.querySelector<HTMLElement>('.play__legend')!.getBoundingClientRect();
    const map = bench!.querySelector<HTMLElement>('.game-map')!.getBoundingClientRect();
    expect(map.bottom, 'el mapa acaba donde empieza la leyenda').toBeLessThanOrEqual(legend.top + 0.5);
    const cells = [...bench!.querySelectorAll<HTMLElement>('.game-map button.game-map__cell')];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      const box = cell.getBoundingClientRect();
      const name = cell.getAttribute('aria-label') ?? cell.textContent ?? '';
      expect(box.bottom, `${name}: no baja del mapa`).toBeLessThanOrEqual(Math.min(surface.bottom, legend.top) + 0.5);
      expect(box.top, `${name}: no sube del mapa`).toBeGreaterThanOrEqual(surface.top - 0.5);
      expect(box.left, name).toBeGreaterThanOrEqual(surface.left - 0.5);
      expect(box.right, name).toBeLessThanOrEqual(surface.right + 0.5);
    }
    const rotulo = [...bench!.querySelectorAll<HTMLElement>('.game-map__label')].find((el) => /sin ubicación/i.test(el.textContent ?? ''));
    if (rotulo !== undefined) expect(rotulo.getBoundingClientRect().bottom).toBeLessThanOrEqual(legend.top + 0.5);
  }

  it('a 1280 px, al alejar a nivel 2 y activar un filtro (sube la leyenda) ningún grupo, «Sin ubicación» incluido, queda recortado', async () => {
    await mount(1280, 800, play(), '/acciones/nueva');
    await expect.poll(levelNow).toBe('0');
    await userEvent.click(bench!.querySelector<HTMLElement>('button[aria-label="Nivel 2, el más alejado"]')!);
    await expect.poll(levelNow).toBe('2');
    await expect.poll(() => bench!.querySelectorAll('.game-map__group').length).toBeGreaterThan(0);
    expect([...bench!.querySelectorAll('.game-map__group--unlocated')].length, 'hay un grupo «Sin ubicación»').toBe(1);
    expectNothingUnderLegend();

    const before = bench!.querySelector<HTMLElement>('.play__legend')!.getBoundingClientRect().height;
    await userEvent.click(bench!.querySelector<HTMLElement>('.leyenda-control button[aria-label="Agua"]')!);
    await expect.poll(() => [...bench!.querySelectorAll('.play__legend button, .play__legend a')].some((el) => /quitar filtros/i.test(el.textContent ?? ''))).toBe(true);
    await expect.poll(() => bench!.querySelector<HTMLElement>('.play__legend')!.getBoundingClientRect().height).toBeGreaterThan(before);
    expect(levelNow()).toBe('2');
    // El mapa se reencuadra con el alto que le deja la leyenda.
    await expect.poll(() => {
      const legend = bench!.querySelector<HTMLElement>('.play__legend')!.getBoundingClientRect();
      return [...bench!.querySelectorAll<HTMLElement>('.game-map button.game-map__cell')].every((c) => c.getBoundingClientRect().bottom <= legend.top + 0.5);
    }).toBe(true);
    expectNothingUnderLegend();
  });

  it('a 360 px, con el mismo recorrido, tampoco', async () => {
    await mount(360, 800, play(), '/acciones/nueva');
    await expect.poll(levelNow).toBe('0');
    await userEvent.click(bench!.querySelector<HTMLElement>('button[aria-label="Nivel 2, el más alejado"]')!);
    await expect.poll(levelNow).toBe('2');
    await expect.poll(() => bench!.querySelectorAll('.game-map__group').length).toBeGreaterThan(0);
    expectNothingUnderLegend();
  });
});
