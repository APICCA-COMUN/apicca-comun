// RF-18 (021) · 18.2, 18.7, D-T30 (021): los puntos de una Acción Común en el mapa teselado, el Arco que los une y el lugar de
// su rótulo (`placeArcLabel`).
import { describe, expect, it } from 'vitest';
import { layoutMap, type MapApice } from './hexmap';
import { ARC_LABEL_HEIGHT, arcLabelWidth, buildArc, placeArcLabel } from './mapArcs';
import { pathLabelWidth, pathPoints, pointInRect, rectsOverlap, shiftIntoView, type LabelRect } from './mapPaths';

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

/** El Arco de una Acción Común en `layout`, con todos los Ápices del nivel como obstáculos. */
function arcOf(layout: typeof near, ids: readonly string[]) {
  const apices = [
    ...layout.blocks.flatMap((block) => [...block.spots, ...(block.moreCell ? [block.moreCell] : [])]),
    ...(layout.terrain?.spots ?? []),
    ...layout.groups,
  ].map(({ x, y }) => ({ x, y }));
  return buildArc(pathPoints(layout, ids), layout.radius, { apices });
}

const WORLD: LabelRect = { left: -2000, top: -2000, right: 2000, bottom: 2000 };

describe('mapPaths · el Arco de una Acción Común', () => {
  it('RF-18 (021) · 18.2: une los puntos de la ruta con un tramo por par y un disco en cada parada', () => {
    const arc = arcOf(near, ['c', 'a', 's'])!;
    expect(arc).not.toBeNull();
    expect(arc.stops).toHaveLength(3);
    expect(arc.discs).toHaveLength(3);
    expect(arc.segments).toHaveLength(2);
    for (const segment of arc.segments) expect(segment.d).toMatch(/^M-?[\d.]+ -?[\d.]+Q/);
  });

  it('RF-18 (021) · 18.7: con menos de dos puntos distintos no hay Arco', () => {
    expect(pathPoints(near, ['a', 'a'])).toEqual([]);
    expect(buildArc(pathPoints(near, ['a']), near.radius, { apices: [] })).toBeNull();
    expect(arcOf(near, ['a', 'oculto'])).toBeNull();
  });

  it('un nivel alejado dibuja el Arco entre los grupos', () => {
    const arc = arcOf(far, ['a', 'c', 'm'])!;
    expect(arc).not.toBeNull();
    expect(arc.segments.length).toBeGreaterThanOrEqual(1);
  });
});

describe('mapPaths · rótulo del Arco', () => {
  const text = 'Rutas de agua';
  // Un mapa con pocos Ápices: en la zona llena (ocho Ápices juntos) no queda sitio junto a la curva.
  const quiet = layoutMap([at('a', CENTRO), at('c', VECINA), at('s', SUBA)], 0);
  const apicesOf = (layout: typeof quiet) =>
    layout.blocks.flatMap((block) => [...block.spots, ...(block.moreCell ? [block.moreCell] : [])]).map(({ x, y }) => ({ x, y }));
  const boxRect = (box: { x: number; y: number; w: number; h: number }): LabelRect => ({
    left: box.x,
    top: box.y,
    right: box.x + box.w,
    bottom: box.y + box.h,
  });
  const inside = (rect: LabelRect, view: LabelRect) =>
    rect.left >= view.left && rect.right <= view.right && rect.top >= view.top && rect.bottom <= view.bottom;

  it('lleva el rótulo junto al Arco, entero en la ventana y sin tapar un Ápice', () => {
    const arc = arcOf(quiet, ['c', 'a', 's'])!;
    const box = placeArcLabel(arc, text, { apices: apicesOf(quiet), rects: [] }, WORLD)!;
    expect(box).not.toBeNull();
    expect(box.h).toBe(ARC_LABEL_HEIGHT);
    expect(box.w).toBe(arcLabelWidth(text));
    expect(inside(boxRect(box), WORLD)).toBe(true);
    for (const apice of apicesOf(quiet)) {
      const x = Math.min(Math.max(apice.x, box.x), box.x + box.w);
      const y = Math.min(Math.max(apice.y, box.y), box.y + box.h);
      expect(Math.hypot(apice.x - x, apice.y - y)).toBeGreaterThanOrEqual(quiet.radius);
    }
  });

  it('respeta los rectángulos ocupados: otro rótulo, la leyenda o un control', () => {
    const arc = arcOf(quiet, ['c', 'a', 's'])!;
    const first = placeArcLabel(arc, text, { apices: apicesOf(quiet), rects: [] }, WORLD)!;
    const taken = [boxRect(first)];
    const second = placeArcLabel(arc, text, { apices: apicesOf(quiet), rects: taken }, WORLD);
    if (second !== null) expect(rectsOverlap(boxRect(second), taken[0]!)).toBe(false);
    expect(placeArcLabel(arc, text, { apices: [], rects: [WORLD] }, WORLD)).toBeNull();
  });

  it('con los Ápices juntos en una zona no cabe pegado a la curva y se coloca más lejos, sin tapar ninguna celda', () => {
    const together = layoutMap([at('a', CENTRO), at('b', CENTRO), at('h1', CENTRO)], 0);
    const arc = arcOf(together, ['a', 'b', 'h1'])!;
    const apices = apicesOf(together);
    const box = placeArcLabel(arc, text, { apices, rects: [] }, WORLD)!;
    expect(box).not.toBeNull();
    for (const apice of apices) {
      const x = Math.min(Math.max(apice.x, box.x), box.x + box.w);
      const y = Math.min(Math.max(apice.y, box.y), box.y + box.h);
      expect(Math.hypot(apice.x - x, apice.y - y)).toBeGreaterThanOrEqual(together.radius);
    }
  });

  it('sin sitio entero en la ventana, no hay rótulo', () => {
    const arc = arcOf(quiet, ['c', 'a', 's'])!;
    expect(placeArcLabel(arc, text, { apices: [], rects: [] }, { left: 0, top: 0, right: 10, bottom: 10 })).toBeNull();
  });
});

describe('mapPaths · medidas del rótulo', () => {
  it('pathLabelWidth crece con el texto y no pasa de su tope', () => {
    expect(pathLabelWidth(10)).toBeLessThan(pathLabelWidth(20));
    expect(pathLabelWidth(500)).toBe(256);
  });

  it('rectsOverlap cuenta el aire entre rectángulos', () => {
    const a: LabelRect = { left: 0, top: 0, right: 10, bottom: 10 };
    const b: LabelRect = { left: 12, top: 0, right: 20, bottom: 10 };
    expect(rectsOverlap(a, b)).toBe(false);
    expect(rectsOverlap(a, b, 4)).toBe(true);
  });

  it('shiftIntoView mete el rectángulo en la ventana y pointInRect dice si un punto cae dentro', () => {
    const view: LabelRect = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(shiftIntoView({ left: 90, top: -5, right: 110, bottom: 5 }, view)).toEqual({ x: -10, y: 5 });
    expect(pointInRect({ x: 50, y: 50 }, view)).toBe(true);
    expect(pointInRect({ x: 150, y: 50 }, view)).toBe(false);
  });
});
