// RF-18 (021) · 18.2, 18.7, D-T30 (021): la ruta de una Acción Común sobre el teselado y el lugar de su rótulo.
import { describe, expect, it } from 'vitest';
import { layoutMap, type MapApice } from './hexmap';
import {
  labelRect,
  pathCells,
  pathLabel,
  pathLabelCandidates,
  pathLabelWidth,
  pathLabelPoint,
  pathPoints,
  placeLabel,
  rectsOverlap,
  type LabelRect,
} from './mapPaths';

const CENTRO = { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 };
const VECINA = { cell: '8766e0905ffffff', lat: 4.61069, lng: -74.103401 };
const SUBA = { cell: '8766e4281ffffff', lat: 4.74316, lng: -74.091715 };
const MEDELLIN = { cell: '876619d92ffffff', lat: 6.243305, lng: -75.585547 };

type Zone = typeof CENTRO;
const at = (id: string, zone: Zone): MapApice => ({ id, location: { lat: zone.lat, lng: zone.lng, precision: 'approximate', zone } });
const nowhere = (id: string): MapApice => ({ id, location: null });

const APICES = [
  at('a', CENTRO),
  at('b', CENTRO),
  at('h1', CENTRO),
  at('h2', CENTRO),
  at('h3', CENTRO),
  at('h4', CENTRO),
  at('h5', CENTRO),
  at('h6', CENTRO),
  at('c', VECINA),
  at('s', SUBA),
  at('m', MEDELLIN),
  nowhere('u'),
];
const near = layoutMap(APICES, 0);
const far = layoutMap(APICES, 2);

const spotOf = (id: string) => near.blocks.flatMap((block) => block.spots).find((spot) => spot.id === id)!;

describe('mapPaths · puntos de la ruta', () => {
  it('RF-18 (021) · 18.2: pasa por la celda de cada Ápice en el orden elegido', () => {
    const points = pathPoints(near, ['c', 'a', 'b']);
    expect(points).toEqual([
      { x: spotOf('c').x, y: spotOf('c').y },
      { x: spotOf('a').x, y: spotOf('a').y },
      { x: spotOf('b').x, y: spotOf('b').y },
    ]);
  });

  it('RF-18 (021) · 18.2: un Ápice que va en el «+N» pasa por el centro de su zona; el sin ubicación, por su terreno', () => {
    const block = near.blocks.find((candidate) => candidate.key === CENTRO.cell)!;
    expect(block.more).toBeGreaterThan(0);
    const hidden = block.ids.find((id) => !block.spots.some((spot) => spot.id === id))!;
    const terrain = near.terrain!.spots[0]!;
    expect(pathPoints(near, ['c', hidden, 'u'])).toEqual([
      { x: spotOf('c').x, y: spotOf('c').y },
      { x: block.x, y: block.y },
      { x: terrain.x, y: terrain.y },
    ]);
  });

  it('RF-18 (021) · 18.2: en un nivel alejado pasa por los grupos y funde los puntos repetidos seguidos', () => {
    const points = pathPoints(far, ['a', 'b', 'c', 'm', 'u']);
    const keys = new Set(points.map((point) => `${point.x},${point.y}`));
    expect(keys.size).toBe(points.length);
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points.length).toBeLessThanOrEqual(3);
  });

  it('RF-18 (021) · 18.2, 18.7: se salta los Ápices que no están en el mapa; con menos de dos puntos distintos no hay ruta', () => {
    expect(pathPoints(near, ['a', 'oculto', 'c'])).toHaveLength(2);
    expect(pathPoints(near, ['a', 'oculto', 'otro'])).toEqual([]);
    expect(pathPoints(near, ['a', 'a'])).toEqual([]);
    expect(pathPoints(far, ['a', 'b'])).toEqual([]);
  });
});

describe('mapPaths · celdas de la ruta', () => {
  it('une dos Ápices de zonas vecinas con celdas intermedias que no son las de ningún Ápice', () => {
    const cells = pathCells(near, ['c', 'a']);
    expect(cells.length).toBeGreaterThan(0);
    const occupied = new Set(near.blocks.flatMap((block) => block.spots.map((spot) => spot.cell)));
    for (const cell of cells) {
      expect(occupied.has(cell.cell)).toBe(false);
      expect(cell.points).toHaveLength(6);
    }
    expect(new Set(cells.map((cell) => cell.cell)).size).toBe(cells.length);
  });

  it('el orden de los Ápices no cambia qué celdas se usan, solo cuándo', () => {
    const forward = pathCells(near, ['c', 'a', 's'])
      .map((cell) => cell.cell)
      .sort();
    const again = pathCells(near, ['c', 'a', 's'])
      .map((cell) => cell.cell)
      .sort();
    expect(again).toEqual(forward);
  });

  it('un tramo más largo que el tope, o que toca el terreno sin ubicar, no lleva celdas', () => {
    expect(pathCells(near, ['a', 'm'])).toEqual([]);
    expect(pathCells(near, ['a', 'u'])).toEqual([]);
    expect(pathCells(near, ['a'])).toEqual([]);
  });

  it('en un nivel alejado las celdas son del tamaño de ese nivel', () => {
    const cells = pathCells(far, ['a', 'm']);
    for (const cell of cells) expect(cell.points).toHaveLength(6);
    expect(pathPoints(far, ['a', 'm'])).toHaveLength(2);
  });
});

describe('mapPaths · rótulo', () => {
  it('D-T30 (021): sin celdas, el punto medio del tramo más largo', () => {
    expect(
      pathLabelPoint([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 400 },
      ]),
    ).toEqual({ x: 100, y: 200 });
    expect(pathLabelPoint([{ x: 0, y: 0 }])).toBeNull();
  });

  it('D-T30 (021): el rótulo queda junto a la celda del medio de la ruta, fuera de las celdas con contenido', () => {
    const label = pathLabel(near, ['c', 'a', 's'], 20)!;
    expect(label).not.toBeNull();
    expect(['start', 'end']).toContain(label.align);
    const busy = near.blocks.flatMap((block) => block.spots);
    const width = 20 * 10.5 + 24;
    const left = label.align === 'start' ? label.x : label.x - width;
    for (const spot of busy) {
      const overlaps = spot.x > left && spot.x < left + width && Math.abs(spot.y - label.y) < 14;
      expect(overlaps, spot.id).toBe(false);
    }
  });

  /** Lo que ocupan las celdas con patrón o con número del dibujo: no hay rótulo que las cubra (RF-4 (021) · 4.3). */
  const surfaces = (layout: typeof near) => [
    ...layout.blocks.flatMap((block) => block.spots),
    ...layout.blocks.flatMap((block) => (block.moreCell === null ? [] : [block.moreCell])),
    ...layout.groups,
  ];
  const coversASurface = (layout: typeof near, rect: LabelRect) =>
    surfaces(layout).some((place) => {
      const nearX = Math.max(rect.left, Math.min(place.x, rect.right));
      const nearY = Math.max(rect.top, Math.min(place.y, rect.bottom));
      return Math.hypot(place.x - nearX, place.y - nearY) < layout.radius * 0.9;
    });

  it('#2 (QA): ningún rótulo, de los que se pueden dibujar, cubre una celda con patrón, también si la ruta las rodea', () => {
    const routes = [
      ['c', 'a', 's'],
      ['a', 'b', 'h1', 'h2'],
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ['a', 'c'],
      ['a', 'm'],
    ];
    for (const layout of [near, far]) {
      for (const ids of routes) {
        const label = pathLabel(layout, ids, 28);
        if (label === null) continue;
        expect(coversASurface(layout, labelRect(label, pathLabelWidth(28))), ids.join()).toBe(false);
      }
    }
  });

  it('#2 (QA): con las cuatro esquinas ocupadas prueba más lejos y a lo largo de la ruta antes de rendirse', () => {
    const candidates = pathLabelCandidates(near, ['c', 'a', 's']);
    expect(candidates.length).toBeGreaterThan(4);
    const first = placeLabel(near, candidates, 20)!;
    expect(first).not.toBeNull();
    // Se ocupa el lugar elegido: el siguiente es otro, y tampoco cubre una celda.
    const taken = [labelRect(first, pathLabelWidth(20))];
    const second = placeLabel(near, candidates, 20, { taken });
    if (second !== null) {
      expect(second).not.toEqual(first);
      expect(rectsOverlap(labelRect(second, pathLabelWidth(20)), taken[0]!)).toBe(false);
      expect(coversASurface(near, labelRect(second, pathLabelWidth(20)))).toBe(false);
    }
  });

  it('#2 (QA): varias Acciones Comunes con el mismo sitio se separan: ningún rótulo se apila sobre otro', () => {
    const ids = ['c', 'a', 's'];
    const candidates = pathLabelCandidates(near, ids);
    const taken: LabelRect[] = [];
    let placed = 0;
    for (let i = 0; i < 6; i += 1) {
      const label = placeLabel(near, candidates, 20, { taken });
      if (label === null) break;
      const rect = labelRect(label, pathLabelWidth(20));
      for (const other of taken) expect(rectsOverlap(rect, other), `rótulo ${i}`).toBe(false);
      taken.push(rect);
      placed += 1;
    }
    expect(placed).toBeGreaterThan(1);
    // Cuando ya no cabe ninguno más, no se apila: se oculta.
    expect(placeLabel(near, candidates, 20, { taken: [{ left: -1e6, top: -1e6, right: 1e6, bottom: 1e6 }] })).toBeNull();
  });

  it('#2 y #3 (QA): sin sitio libre en la ventana, no hay rótulo', () => {
    const candidates = pathLabelCandidates(near, ['c', 'a', 's']);
    const everywhere: LabelRect = { left: -1e6, top: -1e6, right: 1e6, bottom: 1e6 };
    expect(placeLabel(near, candidates, 20, { view: everywhere, blocked: [everywhere] })).toBeNull();
  });

  const inside = (rect: LabelRect, view: LabelRect) =>
    rect.left >= view.left - 0.01 && rect.right <= view.right + 0.01 && rect.top >= view.top - 0.01 && rect.bottom <= view.bottom + 0.01;
  const WORLD: LabelRect = { left: -1e5, top: -1e5, right: 1e5, bottom: 1e5 };

  it('2a (QA 2): las celdas de ruta, con su glifo, cuentan como ocupadas: el rótulo no las tapa', () => {
    const ids = ['c', 'a', 's'];
    const candidates = pathLabelCandidates(near, ids);
    const first = placeLabel(near, candidates, 20, { view: WORLD })!;
    expect(first).not.toBeNull();
    const firstRect = labelRect(first, pathLabelWidth(20));
    // Una celda de ruta justo bajo el primer lugar: el rótulo tiene que ir a otro.
    const route = [{ x: (firstRect.left + firstRect.right) / 2, y: first.y }];
    const label = placeLabel(near, candidates, 20, { view: WORLD, busy: route })!;
    expect(label).not.toBeNull();
    expect(label).not.toEqual(first);
    const rect = labelRect(label, label.width ?? pathLabelWidth(20));
    const reach = near.radius * 0.95;
    const nearestX = Math.min(Math.max(route[0]!.x, rect.left), rect.right);
    const nearestY = Math.min(Math.max(route[0]!.y, rect.top), rect.bottom);
    expect(Math.hypot(route[0]!.x - nearestX, route[0]!.y - nearestY)).toBeGreaterThanOrEqual(reach);
    // Y con las celdas de ruta reales de la propia ruta, tampoco.
    for (const ids2 of [ids, ['a', 'b', 'h1', 'h2']]) {
      const cells = pathCells(near, ids2);
      const placed = placeLabel(near, pathLabelCandidates(near, ids2), 24, { view: WORLD, busy: cells });
      if (placed === null) continue;
      const box = labelRect(placed, placed.width ?? pathLabelWidth(24));
      for (const cell of cells) {
        const cx = Math.min(Math.max(cell.x, box.left), box.right);
        const cy = Math.min(Math.max(cell.y, box.top), box.bottom);
        expect(Math.hypot(cell.x - cx, cell.y - cy), `${ids2.join()} · ${cell.cell}`).toBeGreaterThanOrEqual(reach);
      }
    }
  });

  it('2b (QA 2): el rótulo no pisa los controles ni se sale del lienzo: se acorta dentro del sitio libre o no se dibuja', () => {
    const candidates = pathLabelCandidates(near, ['c', 'a', 's']);
    const natural = pathLabelWidth(40);
    const first = placeLabel(near, candidates, 40)!;
    const rect = labelRect(first, natural);
    // Un control a 150 px del punto de apoyo, hacia donde crece el rótulo.
    const control: LabelRect =
      first.align === 'start'
        ? { left: rect.left + 150, right: rect.left + 1000, top: rect.top - 60, bottom: rect.bottom + 60 }
        : { left: rect.right - 1000, right: rect.right - 150, top: rect.top - 60, bottom: rect.bottom + 60 };
    const label = placeLabel(near, candidates, 40, { view: WORLD, blocked: [control] })!;
    expect(label).not.toBeNull();
    // Cabe acortado en el mismo sitio: 150 px menos el aire, con puntos suspensivos.
    expect([label.x, label.y, label.align]).toEqual([first.x, first.y, first.align]);
    expect(label.width).toBeGreaterThanOrEqual(96);
    expect(label.width).toBeLessThan(natural);
    const box = labelRect(label, label.width!);
    expect(rectsOverlap(box, control)).toBe(false);
    expect(inside(box, WORLD)).toBe(true);
    // Una ventana más angosta que el rótulo: se acorta a ella, nunca se sale.
    const narrow: LabelRect = { left: first.x - 120, right: first.x + 120, top: first.y - 200, bottom: first.y + 200 };
    const squeezed = placeLabel(near, candidates, 40, { view: narrow });
    if (squeezed !== null) expect(inside(labelRect(squeezed, squeezed.width ?? natural), narrow)).toBe(true);
    // Sin sitio libre de al menos 96 px al lado del punto de apoyo, no se dibuja con ese candidato.
    const wall: LabelRect =
      first.align === 'start'
        ? { left: rect.left + 40, right: rect.left + 1000, top: rect.top - 60, bottom: rect.bottom + 60 }
        : { left: rect.right - 1000, right: rect.right - 40, top: rect.top - 60, bottom: rect.bottom + 60 };
    const walled = placeLabel(near, candidates, 40, { view: WORLD, blocked: [wall] });
    if (walled !== null) expect(rectsOverlap(labelRect(walled, walled.width ?? natural), wall)).toBe(false);
  });

  it('2c (QA 2): si la ruta no se ve en la ventana el rótulo no se dibuja; si se ve, entra entero', () => {
    const ids = ['c', 'a', 's'];
    const candidates = pathLabelCandidates(near, ids);
    const natural = pathLabelWidth(30);
    const far0: LabelRect = { left: 1e5, top: 1e5, right: 1e5 + 600, bottom: 1e5 + 400 };
    expect(placeLabel(near, candidates, 30, { view: far0 })).toBeNull();
    // Una ventana que deja fuera a los puntos de apoyo de la izquierda: ningún rótulo cortado por ese borde.
    const anchors = candidates.map((candidate) => candidate.anchor);
    const midX = [...anchors].sort((a, b) => a.x - b.x)[Math.floor(anchors.length / 2)]!.x;
    const half: LabelRect = { left: midX, top: -1e5, right: midX + 600, bottom: 1e5 };
    const label = placeLabel(near, candidates, 30, { view: half });
    if (label !== null) expect(inside(labelRect(label, label.width ?? natural), half)).toBe(true);
    // Con la ventana sobre la ruta entera, hay rótulo y está entero dentro.
    const all = placeLabel(near, candidates, 30, { view: WORLD })!;
    expect(all).not.toBeNull();
    expect(inside(labelRect(all, all.width ?? natural), WORLD)).toBe(true);
  });

  it('una ruta que no se dibuja no tiene rótulo', () => {
    expect(pathLabel(near, ['a'], 10)).toBeNull();
    expect(pathLabel(near, ['x', 'y'], 10)).toBeNull();
  });
});
