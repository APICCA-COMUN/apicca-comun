// Pruebas del dominio del mapa propio (RF-4 (021) · 4.3, RF-5 (021) · 5.3, RF-6 (021), RF-7 (021), RF-8 (021) · 8.4,
// RF-9 (021), RNF-5 (021), D-T16 (021)): celda madre, proyección, manzanas, grupos, encuadre, vecino y escala.
import { describe, expect, it } from 'vitest';
import {
  BLOCK_CAPACITY,
  BLOCK_RADIUS,
  GROUP_SPACING,
  LEVEL_SCALE,
  SPOT_HEIGHT,
  SPOT_WIDTH,
  blockSlots,
  frameMap,
  frameOn,
  layoutMap,
  mapNeighbor,
  parentCell,
  projectKm,
  scaleBar,
  type MapApice,
  type MapBounds,
} from './hexmap';

// Celdas reales de resolución 7 con su centro, calculadas con h3-js 4.5.0: así las publica el servidor (D-T13 (021)).
const CENTRO = { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 };
/** Vecina de CENTRO, al noroeste, a 2,56 km. */
const VECINA = { cell: '8766e0905ffffff', lat: 4.61069, lng: -74.103401 };
const CHAPINERO = { cell: '8766e42d2ffffff', lat: 4.649886, lng: -74.060244 };
const SUBA = { cell: '8766e4281ffffff', lat: 4.74316, lng: -74.091715 };
const MEDELLIN = { cell: '876619d92ffffff', lat: 6.243305, lng: -75.585547 };

type Zone = typeof CENTRO;

const at = (id: string, zone: Zone, precision: 'approximate' | 'exact' = 'approximate'): MapApice => ({
  id,
  location: { lat: zone.lat, lng: zone.lng, precision, zone },
});
const nowhere = (id: string): MapApice => ({ id, location: null });

const BOGOTA = [at('a', CENTRO), at('b', CHAPINERO), at('c', SUBA)];
const WIDE = { width: 1280, height: 720 };
const NARROW = { width: 360, height: 600 };

const fits = (bounds: MapBounds, viewport: { width: number; height: number }): boolean =>
  bounds.maxX - bounds.minX <= viewport.width && bounds.maxY - bounds.minY <= viewport.height;

describe('hexmap · celda madre y proyección', () => {
  it('RF-7 (021) · 7.2, D-T16 (021): la celda madre sale de los bits del índice, sin biblioteca', () => {
    expect(parentCell(CENTRO.cell, 5)).toBe('8566e093fffffff');
    expect(parentCell(CENTRO.cell, 3)).toBe('8366e0fffffffff');
    expect(parentCell(CENTRO.cell, 0)).toBe('8067fffffffffff');
    expect(parentCell(MEDELLIN.cell, 5)).toBe('856619dbfffffff');
    expect(parentCell(CENTRO.cell, 7)).toBe(CENTRO.cell);
    expect(parentCell(CENTRO.cell, 9)).toBe(CENTRO.cell);
  });

  it('RF-7 (021) · 7.2: lo que no es un índice H3 se devuelve igual', () => {
    expect(parentCell('punto:4.6,-74.08', 5)).toBe('punto:4.6,-74.08');
  });

  it('RF-5 (021) · 5.3: la proyección conserva la dirección y la distancia entre dos celdas, con el norte arriba', () => {
    const { x, y } = projectKm(VECINA, CENTRO);
    expect(x).toBeLessThan(0); // al oeste
    expect(y).toBeLessThan(0); // al norte, que va arriba
    expect(Math.hypot(x, y)).toBeCloseTo(2.558, 1);
    expect(projectKm(CENTRO, CENTRO)).toEqual({ x: 0, y: 0 });
  });

  it('RF-5 (021) · 5.3: cruzar el meridiano 180 no separa dos puntos vecinos', () => {
    const { x } = projectKm({ lat: 0, lng: -179.99 }, { lat: 0, lng: 179.99 });
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(3);
  });
});

describe('hexmap · manzanas', () => {
  it('RF-5 (021) · 5.3: en el nivel cercano cada zona es una manzana, a la distancia de sus celdas', () => {
    const layout = layoutMap([at('a', CENTRO), at('b', VECINA)], 0);
    expect(layout.blocks).toHaveLength(2);
    expect(layout.groups).toEqual([]);
    const [first, second] = layout.blocks;
    const distance = Math.hypot(first!.x - second!.x, first!.y - second!.y);
    expect(distance / LEVEL_SCALE[0]).toBeCloseTo(2.558, 1);
    // Dos manzanas vecinas no se tocan.
    expect(distance).toBeGreaterThan(2 * BLOCK_RADIUS);
    const west = layout.blocks.find((block) => block.key === VECINA.cell)!;
    const east = layout.blocks.find((block) => block.key === CENTRO.cell)!;
    expect(west.x).toBeLessThan(east.x);
    expect(west.y).toBeLessThan(east.y);
  });

  it('RF-6 (021) · 6.1: los ápices de una misma zona van juntos en su manzana, un edificio por ápice', () => {
    const layout = layoutMap([at('a', CENTRO), at('b', CENTRO, 'exact'), at('c', CENTRO), at('d', VECINA)], 0);
    const block = layout.blocks.find((candidate) => candidate.key === CENTRO.cell)!;
    expect(block.ids).toEqual(['a', 'b', 'c']);
    expect(block.spots.map((spot) => spot.id)).toEqual(['a', 'b', 'c']);
    expect(block.more).toBe(0);
    for (const spot of block.spots) expect(Math.hypot(spot.x - block.x, spot.y - block.y)).toBeLessThan(BLOCK_RADIUS);
  });

  it('RF-6 (021) · 6.1: los puestos de una manzana no se enciman y caben en su placa', () => {
    for (let count = 1; count <= BLOCK_CAPACITY; count += 1) {
      const slots = blockSlots(count);
      expect(slots, `con ${count}`).toHaveLength(count);
      slots.forEach((slot, index) => {
        expect(Math.hypot(slot.x, slot.y) + SPOT_WIDTH / 2, `con ${count}`).toBeLessThanOrEqual(BLOCK_RADIUS);
        for (const other of slots.slice(index + 1)) {
          const apart = Math.abs(slot.x - other.x) >= SPOT_WIDTH || Math.abs(slot.y - other.y) >= SPOT_HEIGHT;
          expect(apart, `con ${count}: ${JSON.stringify(slot)} y ${JSON.stringify(other)}`).toBe(true);
        }
      });
    }
  });

  it('RF-6 (021) · 6.2: con más de siete ápices la manzana muestra siete edificios y el número de los demás', () => {
    const many = Array.from({ length: 9 }, (_, index) => at(`apice-${index}`, CENTRO));
    const [block] = layoutMap(many, 0).blocks;
    expect(BLOCK_CAPACITY).toBe(7);
    expect(block!.spots).toHaveLength(7);
    expect(block!.more).toBe(2);
    expect(block!.ids).toHaveLength(9);
  });

  it('RF-6 (021) · 6.4: el orden de una manzana es estable, sin importar el orden de llegada', () => {
    const items = [at('m', CENTRO), at('a', CENTRO), at('z', CENTRO), at('f', CENTRO)];
    const straight = layoutMap(items, 0).blocks[0]!;
    const reversed = layoutMap([...items].reverse(), 0).blocks[0]!;
    expect(straight.ids).toEqual(['a', 'f', 'm', 'z']);
    expect(reversed.spots).toEqual(straight.spots);
  });

  it('RF-5 (021) · 5.3: un ápice que aún no tiene zona se dibuja en una zona propia, en su punto', () => {
    const old: MapApice = { id: 'viejo', location: { lat: 4.605, lng: -74.075, precision: 'approximate' } };
    const layout = layoutMap([old, at('a', CENTRO)], 0);
    expect(layout.blocks).toHaveLength(2);
    expect(layout.blocks.flatMap((block) => block.ids).sort()).toEqual(['a', 'viejo']);
  });
});

describe('hexmap · niveles', () => {
  it('RF-7 (021) · 7.1: hay tres niveles, cada uno siete veces más lejos que el anterior', () => {
    expect(LEVEL_SCALE[0] / LEVEL_SCALE[1]).toBeCloseTo(7);
    expect(LEVEL_SCALE[1] / LEVEL_SCALE[2]).toBeCloseTo(7);
  });

  it('RF-7 (021) · 7.2: en un nivel alejado los ápices cercanos forman un grupo con su número', () => {
    const layout = layoutMap([...BOGOTA, at('d', VECINA), at('e', MEDELLIN), at('f', MEDELLIN)], 2);
    expect(layout.blocks).toEqual([]);
    expect(layout.groups.map((group) => [...group.ids].sort())).toEqual([['e', 'f'], ['a', 'b', 'c', 'd']]);
    const [north, south] = layout.groups;
    // Medellín queda al norte y al oeste de Bogotá.
    expect(north!.y).toBeLessThan(south!.y);
    expect(north!.x).toBeLessThan(south!.x);
  });

  it('RF-7 (021) · 7.2: en el nivel intermedio dos zonas vecinas se reúnen y una lejana queda aparte', () => {
    const layout = layoutMap([at('a', CENTRO), at('d', VECINA), at('c', SUBA)], 1);
    expect(layout.groups.map((group) => [...group.ids].sort())).toEqual([['c'], ['a', 'd']]);
  });

  it('RF-7 (021) · 7.2: dos grupos nunca quedan encimados', () => {
    const everything = [...BOGOTA, at('d', VECINA), at('e', MEDELLIN)];
    for (const level of [1, 2] as const) {
      const { groups } = layoutMap(everything, level);
      groups.forEach((group, index) => {
        for (const other of groups.slice(index + 1)) {
          expect(Math.hypot(group.x - other.x, group.y - other.y), `nivel ${level}`).toBeGreaterThanOrEqual(GROUP_SPACING);
        }
      });
    }
  });

  it('RF-7 (021) · 7.4: el encuadre elige el nivel más cercano en el que caben todos los ápices', () => {
    const near = frameMap([at('a', CENTRO), at('b', VECINA)], WIDE);
    expect(near.level).toBe(0);
    expect(near.scale).toBe(LEVEL_SCALE[0]);
    const nearBounds = layoutMap([at('a', CENTRO), at('b', VECINA)], 0).bounds!;
    expect(near.x).toBeCloseTo((nearBounds.minX + nearBounds.maxX) / 2);
    expect(near.y).toBeCloseTo((nearBounds.minY + nearBounds.maxY) / 2);

    expect(frameMap(BOGOTA, WIDE).level).toBe(1);
    expect(frameMap([...BOGOTA, at('e', MEDELLIN)], WIDE).level).toBe(2);
  });

  it('RF-7 (021) · 7.4: si no caben ni en el nivel más lejano, ese nivel se aleja hasta que quepan', () => {
    const all = [...BOGOTA, at('e', MEDELLIN)];
    const frame = frameMap(all, NARROW);
    expect(frame.level).toBe(2);
    expect(frame.scale).toBeLessThan(LEVEL_SCALE[2]);
    expect(fits(layoutMap(all, 2, frame.scale).bounds!, NARROW)).toBe(true);
  });

  it('RF-7 (021) · 7.3: elegir un grupo lleva al nivel cercano, sobre sus manzanas', () => {
    const all = [...BOGOTA, at('d', VECINA), at('e', MEDELLIN)];
    const blocks = layoutMap(all, 0).blocks;
    const centro = blocks.find((block) => block.key === CENTRO.cell)!;
    const vecina = blocks.find((block) => block.key === VECINA.cell)!;
    const frame = frameOn(all, ['a', 'd'], WIDE);
    expect(frame.level).toBe(0);
    expect(frame.scale).toBe(LEVEL_SCALE[0]);
    expect(frame.x).toBeCloseTo((centro.x + vecina.x) / 2);
    expect(frame.y).toBeCloseTo((centro.y + vecina.y) / 2);
  });

  it('RF-7 (021) · 7.3: si las manzanas del grupo no caben, el mapa va a la más cercana a su centro', () => {
    const all = [...BOGOTA, at('e', MEDELLIN)];
    const frame = frameOn(all, ['a', 'b', 'c'], NARROW);
    const chapinero = layoutMap(all, 0).blocks.find((block) => block.key === CHAPINERO.cell)!;
    expect(frame).toEqual({ level: 0, scale: LEVEL_SCALE[0], x: chapinero.x, y: chapinero.y });
  });

  it('RF-7 (021) · 7.3, RF-9 (021) · 9.2: elegir el grupo sin ubicación lleva a su terreno', () => {
    const all = [...BOGOTA, nowhere('x'), nowhere('y')];
    const terrain = layoutMap(all, 0).terrain!;
    const frame = frameOn(all, ['x', 'y'], WIDE);
    expect(frame.level).toBe(0);
    expect(frame.x).toBeCloseTo(terrain.x + terrain.width / 2);
    expect(frame.y).toBeCloseTo(terrain.y + terrain.height / 2);
  });

  it('RF-7 (021) · 7.4: sin ápices el encuadre es el nivel cercano, en el centro', () => {
    expect(frameMap([], WIDE)).toEqual({ level: 0, scale: LEVEL_SCALE[0], x: 0, y: 0 });
    expect(layoutMap([], 0).bounds).toBeNull();
  });
});

describe('hexmap · sin ubicación', () => {
  it('RF-9 (021) · 9.1: los ápices sin ubicación van en un terreno aparte, al sur de las manzanas', () => {
    const layout = layoutMap([at('a', CENTRO), nowhere('x'), nowhere('y'), at('b', SUBA), nowhere('w')], 0);
    const terrain = layout.terrain!;
    expect(terrain.spots.map((spot) => spot.id)).toEqual(['w', 'x', 'y']);
    for (const block of layout.blocks) expect(terrain.y).toBeGreaterThan(block.y + block.radius);
    for (const spot of terrain.spots) {
      expect(spot.x).toBeGreaterThan(terrain.x);
      expect(spot.x).toBeLessThan(terrain.x + terrain.width);
      expect(spot.y).toBeGreaterThan(terrain.y);
      expect(spot.y).toBeLessThan(terrain.y + terrain.height);
    }
    expect(layout.bounds!.maxY).toBeGreaterThanOrEqual(terrain.y + terrain.height);
  });

  it('RF-9 (021) · 9.1: el terreno aparte existe aunque ningún ápice tenga ubicación, y no hay terreno si todos la tienen', () => {
    const only = layoutMap([nowhere('x'), nowhere('y')], 0);
    expect(only.blocks).toEqual([]);
    expect(only.terrain!.spots).toHaveLength(2);
    expect(only.bounds).not.toBeNull();
    expect(frameMap([nowhere('x'), nowhere('y')], WIDE).level).toBe(0);
    expect(layoutMap([at('a', CENTRO)], 0).terrain).toBeNull();
  });

  it('RF-9 (021) · 9.1: en los niveles alejados los ápices sin ubicación son un grupo aparte, al sur', () => {
    const { groups } = layoutMap([...BOGOTA, nowhere('x'), nowhere('y')], 2);
    const apart = groups.filter((group) => group.unlocated);
    expect(apart).toHaveLength(1);
    expect(apart[0]!.ids).toEqual(['x', 'y']);
    for (const group of groups.filter((candidate) => !candidate.unlocated)) {
      expect(apart[0]!.y - group.y).toBeGreaterThanOrEqual(GROUP_SPACING);
    }
  });
});

describe('hexmap · vecino y escala', () => {
  const spots = [
    { id: 'centro', x: 0, y: 0 },
    { id: 'este', x: 100, y: 10 },
    { id: 'lejos-este', x: 300, y: 0 },
    { id: 'norte', x: -10, y: -120 },
    { id: 'sur-este', x: 90, y: 200 },
  ];

  it('RF-8 (021) · 8.4: la flecha lleva al edificio más cercano en esa dirección', () => {
    expect(mapNeighbor(spots, 'centro', 'ArrowRight')).toBe('este');
    expect(mapNeighbor(spots, 'este', 'ArrowRight')).toBe('lejos-este');
    expect(mapNeighbor(spots, 'centro', 'ArrowUp')).toBe('norte');
    expect(mapNeighbor(spots, 'centro', 'ArrowDown')).toBe('sur-este');
    expect(mapNeighbor(spots, 'este', 'ArrowLeft')).toBe('centro');
  });

  it('RF-8 (021) · 8.4: si nadie queda de frente, la flecha lleva al que menos se desvía hacia ese lado', () => {
    const diagonal = [
      { id: 'uno', x: 0, y: 0 },
      { id: 'dos', x: 40, y: 300 },
    ];
    expect(mapNeighbor(diagonal, 'uno', 'ArrowRight')).toBe('dos');
    expect(mapNeighbor(diagonal, 'dos', 'ArrowLeft')).toBe('uno');
    expect(mapNeighbor(diagonal, 'uno', 'ArrowLeft')).toBeNull();
  });

  it('RF-8 (021) · 8.4: sin edificio en esa dirección, o con otra tecla, no hay vecino', () => {
    expect(mapNeighbor(spots, 'lejos-este', 'ArrowRight')).toBeNull();
    expect(mapNeighbor(spots, 'norte', 'ArrowUp')).toBeNull();
    expect(mapNeighbor(spots, 'centro', 'Enter')).toBeNull();
    expect(mapNeighbor(spots, 'no-existe', 'ArrowRight')).toBeNull();
  });

  it('RF-4 (021) · 4.3: la escala es una distancia redonda que cabe en su barra', () => {
    expect(scaleBar(LEVEL_SCALE[0])).toEqual({ meters: 500, px: 100, label: '500 m' });
    expect(scaleBar(LEVEL_SCALE[1]).label).toBe('2 km');
    expect(scaleBar(LEVEL_SCALE[2]).label).toBe('20 km');
    for (const scale of [LEVEL_SCALE[0], LEVEL_SCALE[1], LEVEL_SCALE[2], 0.3]) {
      const bar = scaleBar(scale);
      expect(bar.px).toBeLessThanOrEqual(120);
      expect(bar.px).toBeGreaterThan(40);
      expect(bar.px).toBeCloseTo((bar.meters / 1000) * scale);
    }
  });
});
