// RF-18 (021) · 18.2, 18.7, D-T30 (021): el recorrido de un camino y el lugar de su rótulo.
import { describe, expect, it } from 'vitest';
import type { MapLayout } from './hexmap';
import { pathLabelPoint, pathPoints, svgPoints } from './mapPaths';

const near: MapLayout = {
  level: 0,
  scale: 200,
  blocks: [
    { key: 'z1', x: 0, y: 0, radius: 180, ids: ['a', 'b', 'h'], spots: [{ id: 'a', x: -55, y: 0 }, { id: 'b', x: 55, y: 0 }], more: 1 },
    { key: 'z2', x: 600, y: 0, radius: 180, ids: ['c'], spots: [{ id: 'c', x: 600, y: 0 }], more: 0 },
  ],
  groups: [],
  terrain: { x: 0, y: 300, width: 200, height: 160, spots: [{ id: 'u', x: 70, y: 394 }] },
  bounds: null,
};

const far: MapLayout = {
  level: 2,
  scale: 4,
  blocks: [],
  groups: [
    { key: 'g1', x: 0, y: 0, ids: ['a', 'b', 'h'], unlocated: false },
    { key: 'g2', x: 300, y: 0, ids: ['c'], unlocated: false },
    { key: 'sin-ubicar', x: 150, y: 200, ids: ['u'], unlocated: true },
  ],
  terrain: null,
  bounds: null,
};

describe('mapPaths · recorrido del camino', () => {
  it('RF-18 (021) · 18.2, D-T30 (021): pasa por cada edificio en el orden elegido; el de un «+n», por el centro de su manzana; el sin ubicación, por su terreno', () => {
    expect(pathPoints(near, ['c', 'a', 'h', 'u'])).toEqual([
      { x: 600, y: 0 },
      { x: -55, y: 0 },
      { x: 0, y: 0 },
      { x: 70, y: 394 },
    ]);
  });

  it('RF-18 (021) · 18.2: en un nivel alejado pasa por los grupos y funde los puntos repetidos seguidos', () => {
    expect(pathPoints(far, ['a', 'b', 'c', 'u'])).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 150, y: 200 },
    ]);
  });

  it('RF-18 (021) · 18.2, 18.7: se salta los ápices que no están en el mapa; con menos de dos puntos distintos no hay camino', () => {
    expect(pathPoints(near, ['a', 'oculto', 'c'])).toEqual([
      { x: -55, y: 0 },
      { x: 600, y: 0 },
    ]);
    expect(pathPoints(near, ['a', 'oculto', 'otro'])).toEqual([]);
    expect(pathPoints(far, ['a', 'b', 'h'])).toEqual([]);
  });

  it('D-T30 (021): el rótulo va en el punto medio del tramo más largo', () => {
    expect(pathLabelPoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 400 }])).toEqual({ x: 100, y: 200 });
    expect(pathLabelPoint([{ x: 0, y: 0 }])).toBeNull();
    expect(svgPoints([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('1,2 3,4');
  });
});
