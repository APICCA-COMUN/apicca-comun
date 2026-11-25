// Pruebas del dominio del mapa teselado (RF-4 (021) · 4.3, RF-5 (021) · 5.3, RF-6 (021), RF-7 (021), RF-8 (021) · 8.4,
// RF-9 (021), RNF-5 (021), D-T16 (021), RF-4 (024), D-T5 (024)): celda madre, proyección, zonas de siete celdas, grupos,
// teselado vacío, encuadre, vecino y escala.
import { cellToParent } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { CELL_RESOLUTION, LEVEL_RESOLUTION, isCellOf } from './h3cells';
import {
  CELL_WIDTH,
  drawCell,
  LEVEL_SCALE,
  UNLOCATED_KEY,
  blockBounds,
  frameAtLevel,
  frameFit,
  frameMap,
  frameOn,
  layoutMap,
  mapNeighbor,
  parentCell,
  projectKm,
  scaleBar,
  tessellationPath,
  zonesTessellationPath,
  unprojectKm,
  type MapApice,
  type MapBounds,
  type MapVertex,
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
/** Varios ápices en una zona: `prefix-0`, `prefix-1`… */
const crowd = (count: number, zone: Zone, prefix = 'apice'): MapApice[] => Array.from({ length: count }, (_, index) => at(`${prefix}-${index}`, zone));

const BOGOTA = [at('a', CENTRO), at('b', CHAPINERO), at('c', SUBA)];
const WIDE = { width: 1280, height: 720 };
const NARROW = { width: 360, height: 600 };

const widthOf = (points: readonly MapVertex[]): number => Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
const boxOf = (points: readonly MapVertex[]): MapBounds => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
});
const within = (inner: MapBounds, outer: MapBounds): boolean =>
  inner.minX >= outer.minX - 0.01 && inner.maxX <= outer.maxX + 0.01 && inner.minY >= outer.minY - 0.01 && inner.maxY <= outer.maxY + 0.01;

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

  it('la proyección inversa devuelve el punto de partida', () => {
    const back = unprojectKm(projectKm(SUBA, CENTRO), CENTRO);
    expect(back.lat).toBeCloseTo(SUBA.lat, 6);
    expect(back.lng).toBeCloseTo(SUBA.lng, 6);
  });
});

describe('hexmap · zonas de siete celdas', () => {
  it('RF-6 (021) · 6.1: cada zona con Ápices es una zona de siete celdas H3 de resolución 8, la central primero', () => {
    const layout = layoutMap([at('a', CENTRO), at('b', VECINA)], 0);
    expect(layout.blocks).toHaveLength(2);
    expect(layout.groups).toEqual([]);
    for (const block of layout.blocks) {
      expect(block.cells).toHaveLength(7);
      for (const cell of block.cells) expect(isCellOf(cell, CELL_RESOLUTION)).toBe(true);
      expect(cellToParent(block.cells[0]!, 7)).toBe(block.key);
      expect(block.code).toBe(block.key.slice(5, 9));
    }
  });

  it('RF-6 (021) · 6.1: cada Ápice ocupa una celda de su zona, distinta de las otras, con seis vértices', () => {
    const layout = layoutMap([...crowd(5, CENTRO), at('z', CHAPINERO)], 0);
    const spots = layout.blocks.flatMap((block) => block.spots);
    expect(spots).toHaveLength(6);
    expect(new Set(spots.map((spot) => spot.cell)).size).toBe(6);
    for (const block of layout.blocks) {
      for (const spot of block.spots) {
        expect(block.cells).toContain(spot.cell);
        expect(spot.points).toHaveLength(6);
        // El centro de la celda cae dentro de su caja.
        expect(within({ minX: spot.x, maxX: spot.x, minY: spot.y, maxY: spot.y }, boxOf(spot.points))).toBe(true);
      }
    }
  });

  it('RF-6 (021) · 6.1: las celdas tienen el mismo tamaño en pantalla en cada nivel y el borde de la zona las contiene', () => {
    const layout = layoutMap([at('a', CENTRO)], 0);
    const [block] = layout.blocks;
    const widths = block!.spots.map((spot) => widthOf(spot.points));
    for (const width of widths) expect(Math.abs(width - CELL_WIDTH)).toBeLessThan(CELL_WIDTH * 0.15);
    const outline = boxOf(block!.outline);
    expect(block!.outline).toHaveLength(18);
    for (const spot of block!.spots) expect(within(boxOf(spot.points), outline)).toBe(true);
  });

  it('RF-6 (021) · 6.2: hasta siete Ápices caben, uno por celda, y no hay «+N»', () => {
    const [block] = layoutMap(crowd(7, CENTRO), 0).blocks;
    expect(block!.spots).toHaveLength(7);
    expect(block!.more).toBe(0);
    expect(block!.moreCell).toBeNull();
  });

  it('RF-6 (021) · 6.2: con más de siete la celda central es el «+N» y los Ápices van en el anillo', () => {
    const [block] = layoutMap(crowd(9, CENTRO), 0).blocks;
    expect(block!.spots).toHaveLength(6);
    expect(block!.more).toBe(3);
    expect(block!.moreCell!.cell).toBe(block!.cells[0]);
    expect(block!.spots.map((spot) => spot.cell)).not.toContain(block!.cells[0]);
    expect(block!.ids).toHaveLength(9);
    // Los Ápices a la vista son los primeros en el orden estable.
    expect(block!.spots.map((spot) => spot.id)).toEqual(['apice-0', 'apice-1', 'apice-2', 'apice-3', 'apice-4', 'apice-5']);
  });

  it('RF-6 (021) · 6.4: el orden de una zona es estable, sin importar el orden de llegada', () => {
    const apices = [...crowd(9, CENTRO), at('x', CHAPINERO), at('y', VECINA)];
    expect(layoutMap([...apices].reverse(), 0)).toEqual(layoutMap(apices, 0));
  });

  it('RF-6 (021) · 6.4: las zonas van de norte a sur', () => {
    const layout = layoutMap([at('a', CENTRO), at('b', SUBA), at('c', CHAPINERO)], 0);
    expect(layout.blocks.map((block) => block.key)).toEqual([SUBA.cell, CHAPINERO.cell, CENTRO.cell]);
  });

  it('RF-5 (021) · 5.3: la zona vecina queda al noroeste, a unos 2,5 km', () => {
    const layout = layoutMap([at('a', CENTRO), at('b', VECINA)], 0);
    const centro = layout.blocks.find((block) => block.key === CENTRO.cell)!;
    const vecina = layout.blocks.find((block) => block.key === VECINA.cell)!;
    expect(vecina.x).toBeLessThan(centro.x);
    expect(vecina.y).toBeLessThan(centro.y);
    expect(Math.hypot(vecina.x - centro.x, vecina.y - centro.y) / LEVEL_SCALE[0]).toBeCloseTo(2.56, 1);
  });

  it('RF-5 (021) · 5.3: un Ápice que aún no tiene zona se dibuja en la zona que contiene su punto', () => {
    const apice: MapApice = { id: 'n', location: { lat: CENTRO.lat, lng: CENTRO.lng, precision: 'exact' } };
    const [block] = layoutMap([apice], 0).blocks;
    expect(block!.key).toBe(CENTRO.cell);
    expect(block!.spots.map((spot) => spot.id)).toEqual(['n']);
  });

  it('RF-5 (021) · 5.3: una zona publicada que no es una celda H3 se corrige con el punto del Ápice', () => {
    const broken: MapApice = { id: 'n', location: { lat: CENTRO.lat, lng: CENTRO.lng, precision: 'approximate', zone: { cell: 'no-es-celda', lat: 0, lng: 0 } } };
    expect(layoutMap([broken], 0).blocks[0]!.key).toBe(CENTRO.cell);
  });

  it('lo que ocupa el mapa incluye el rótulo de cada zona', () => {
    const layout = layoutMap([at('a', CENTRO)], 0);
    const block = layout.blocks[0]!;
    expect(layout.bounds!.minY).toBeLessThan(boxOf(block.outline).minY);
    expect(within(blockBounds(block), layout.bounds!)).toBe(true);
    expect(layout.radius).toBeCloseTo(53, -1);
  });
});

describe('hexmap · niveles', () => {
  it('RF-7 (021) · 7.1: hay tres niveles, cada uno siete veces más lejos que el anterior', () => {
    expect(LEVEL_SCALE[0] / LEVEL_SCALE[1]).toBeCloseTo(7);
    expect(LEVEL_SCALE[1] / LEVEL_SCALE[2]).toBeCloseTo(7);
    expect(layoutMap(BOGOTA, 0).level).toBe(0);
    expect(layoutMap(BOGOTA, 1).level).toBe(1);
    expect(layoutMap(BOGOTA, 2).level).toBe(2);
  });

  it('RF-7 (021) · 7.2: en un nivel alejado cada grupo es la celda de resolución 6 o 4 que contiene a sus zonas', () => {
    for (const level of [1, 2] as const) {
      const layout = layoutMap([at('a', CENTRO), at('d', VECINA), at('c', SUBA)], level);
      expect(layout.blocks).toEqual([]);
      for (const group of layout.groups) {
        expect(isCellOf(group.cell, LEVEL_RESOLUTION[level])).toBe(true);
        expect(group.points).toHaveLength(6);
        expect(group.key).toBe(group.cell);
      }
      expect(layout.groups.flatMap((group) => group.ids).sort()).toEqual(['a', 'c', 'd']);
    }
  });

  it('RF-7 (021) · 7.2: las zonas de una misma celda madre se reúnen y las de otra quedan aparte', () => {
    const layout = layoutMap([at('a', CENTRO), at('d', VECINA), at('e', MEDELLIN)], 1);
    const expected = new Map<string, string[]>();
    for (const [id, zone] of [['a', CENTRO], ['d', VECINA], ['e', MEDELLIN]] as const) {
      const parent = cellToParent(zone.cell, 6);
      expected.set(parent, [...(expected.get(parent) ?? []), id]);
    }
    expect(layout.groups.map((group) => [group.key, [...group.ids].sort()]).sort()).toEqual([...expected.entries()].sort());
  });

  it('RF-7 (021) · 7.2: dos grupos nunca quedan encimados: son celdas distintas del mismo teselado', () => {
    const everything = [...BOGOTA, at('d', VECINA), at('e', MEDELLIN)];
    for (const level of [1, 2] as const) {
      const { groups, radius } = layoutMap(everything, level);
      groups.forEach((group, index) => {
        for (const other of groups.slice(index + 1)) {
          expect(Math.hypot(group.x - other.x, group.y - other.y), `nivel ${level}`).toBeGreaterThan(radius);
        }
      });
    }
  });

  it('RF-7 (021) · 7.2: Medellín queda al norte y al oeste de Bogotá en los niveles alejados', () => {
    const layout = layoutMap([at('a', CENTRO), at('e', MEDELLIN)], 2);
    const [north, south] = layout.groups;
    expect(north!.ids).toEqual(['e']);
    expect(north!.y).toBeLessThan(south!.y);
    expect(north!.x).toBeLessThan(south!.x);
  });

  it('RF-7 (021) · 7.4: el encuadre elige el nivel más cercano en el que caben todos los Ápices', () => {
    expect(frameMap([at('a', CENTRO)], WIDE).level).toBe(0);
    expect(frameMap([at('a', CENTRO), at('b', VECINA)], WIDE).level).toBe(0);
    expect(frameMap(BOGOTA, WIDE).level).toBe(1);
    expect(frameMap([...BOGOTA, at('e', MEDELLIN)], WIDE).level).toBe(2);
    const frame = frameMap(BOGOTA, WIDE);
    expect(frame.scale).toBe(LEVEL_SCALE[1]);
    const bounds = layoutMap(BOGOTA, 1).bounds!;
    expect(frame.x).toBeCloseTo((bounds.minX + bounds.maxX) / 2);
    expect(frame.y).toBeCloseTo((bounds.minY + bounds.maxY) / 2);
  });

  it('RF-7 (021) · 7.4: si no caben ni en el nivel más lejano, ese nivel se aleja hasta que quepan', () => {
    const frame = frameMap([...BOGOTA, at('e', MEDELLIN)], NARROW);
    expect(frame.level).toBe(2);
    expect(frame.scale).toBeLessThan(LEVEL_SCALE[2]);
    const bounds = layoutMap([...BOGOTA, at('e', MEDELLIN)], 2, frame.scale).bounds!;
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(NARROW.width);
    expect(bounds.maxY - bounds.minY).toBeLessThanOrEqual(NARROW.height);
  });

  it('RF-7 (021) · 7.3: elegir un grupo lleva al nivel cercano, sobre sus zonas', () => {
    const apices = [at('a', CENTRO), at('d', VECINA), at('c', SUBA)];
    const frame = frameOn(apices, ['a', 'd'], WIDE);
    expect(frame.level).toBe(0);
    expect(frame.scale).toBe(LEVEL_SCALE[0]);
    const blocks = layoutMap(apices, 0).blocks.filter((block) => block.key !== SUBA.cell);
    const minX = Math.min(...blocks.map((block) => blockBounds(block).minX));
    const maxX = Math.max(...blocks.map((block) => blockBounds(block).maxX));
    expect(frame.x).toBeCloseTo((minX + maxX) / 2);
  });

  it('RF-7 (021) · 7.3: si las zonas del grupo no caben, el mapa va a la más cercana a su centro', () => {
    const apices = [at('a', CENTRO), at('c', SUBA), at('s', CHAPINERO)];
    const frame = frameOn(apices, ['a', 'c', 's'], NARROW);
    const blocks = layoutMap(apices, 0).blocks;
    expect(blocks.some((block) => block.x === frame.x && block.y === frame.y)).toBe(true);
  });

  it('RF-7 (021) · 7.3, RF-9 (021) · 9.2: elegir el grupo sin ubicación lleva a su terreno', () => {
    const apices = [at('a', CENTRO), nowhere('x')];
    const frame = frameOn(apices, ['x'], WIDE);
    const terrain = layoutMap(apices, 0).terrain!;
    expect(frame.level).toBe(0);
    expect(frame.x).toBeCloseTo(terrain.x + terrain.width / 2);
  });

  it('RF-7 (021) · 7.4: sin Ápices el encuadre es el nivel cercano, en el centro', () => {
    expect(frameMap([], WIDE)).toEqual({ level: 0, scale: LEVEL_SCALE[0], x: 0, y: 0 });
    expect(layoutMap([], 0).bounds).toBeNull();
  });
});

describe('hexmap · teselado vacío', () => {
  const layout = layoutMap([at('a', CENTRO)], 0);

  it('«el teselado siempre se ve»: dibuja las celdas H3 que tocan el área, una por trazo cerrado', () => {
    const d = tessellationPath(layout, { x: 0, y: 0, width: 800, height: 500 });
    const cells = d.split('M').length - 1;
    expect(cells).toBeGreaterThan(30);
    expect(cells).toBeLessThan(200);
    expect(d.split('Z').length - 1).toBe(cells);
  });

  it('un área más grande trae más celdas y la misma área, las mismas', () => {
    const small = tessellationPath(layout, { x: 0, y: 0, width: 400, height: 300 });
    const big = tessellationPath(layout, { x: 0, y: 0, width: 1200, height: 800 });
    expect(big.length).toBeGreaterThan(small.length);
    expect(tessellationPath(layout, { x: 0, y: 0, width: 400, height: 300 })).toBe(small);
  });

  it('sigue a la zona: al moverse el área, cambian las celdas', () => {
    expect(tessellationPath(layout, { x: 600, y: 0, width: 400, height: 300 })).not.toBe(tessellationPath(layout, { x: 0, y: 0, width: 400, height: 300 }));
  });

  it('con celdas demasiado pequeñas o sin área no dibuja nada, y en los niveles alejados también hay teselado', () => {
    expect(tessellationPath({ ...layout, radius: 2 }, { x: 0, y: 0, width: 800, height: 500 })).toBe('');
    expect(tessellationPath(layout, { x: 0, y: 0, width: 0, height: 500 })).toBe('');
    const far = layoutMap(BOGOTA, 2);
    expect(tessellationPath(far, { x: 0, y: 0, width: 800, height: 500 }).length).toBeGreaterThan(0);
  });

  it('con un área enorme el trazo se acota', () => {
    const d = tessellationPath(layout, { x: 0, y: 0, width: 50000, height: 40000 });
    expect(d.split('M').length - 1).toBeLessThan(7000);
  });
});

describe('hexmap · zonesTessellationPath (el mapa flota)', () => {
  const AREA = { x: 0, y: 0, width: 40000, height: 40000 };
  const hexagons = (d: string): string[] => d.split('M').slice(1);
  const expectedFor = (layout: ReturnType<typeof layoutMap>): Set<string> =>
    new Set(
      layout.blocks.flatMap((block) =>
        block.cells.map((cell) => {
          const drawn = drawCell(cell, layout.origin, layout.scale);
          return `M${drawn.points.map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join('L')}Z`;
        }),
      ),
    );

  it('contiene exactamente 7 hexágonos por zona y nada fuera de ellas', () => {
    for (const apices of [[at('a', CENTRO)], [at('a', CENTRO), at('b', CHAPINERO)], BOGOTA]) {
      const layout = layoutMap(apices, 0);
      const d = zonesTessellationPath(layout, AREA);
      const cells = hexagons(d);
      expect(cells).toHaveLength(7 * layout.blocks.length);
      expect(d.split('Z').length - 1).toBe(cells.length);
      expect(new Set(cells.map((cell) => `M${cell}`))).toEqual(expectedFor(layout));
    }
  });

  it('una zona con varios Ápices sigue siendo de 7 celdas, y el terreno sin ubicar no suma celdas', () => {
    const layout = layoutMap([...crowd(9, CENTRO), nowhere('x')], 0);
    expect(hexagons(zonesTessellationPath(layout, AREA))).toHaveLength(7);
  });

  it('usa el mismo redondeo que tessellationPath: cada celda sale igual en los dos trazados', () => {
    const layout = layoutMap([at('a', CENTRO)], 0);
    const full = new Set(hexagons(tessellationPath(layout, { x: 0, y: 0, width: 800, height: 500 })).map((cell) => `M${cell}`));
    const floating = [...expectedFor(layout)];
    expect(floating.filter((cell) => full.has(cell))).toHaveLength(7);
  });

  it('sin zonas, sin Ápices ubicados, o con celdas diminutas o sin área, no dibuja nada', () => {
    expect(zonesTessellationPath(layoutMap([], 0), AREA)).toBe('');
    expect(zonesTessellationPath(layoutMap([nowhere('x')], 0), AREA)).toBe('');
    const layout = layoutMap([at('a', CENTRO)], 0);
    expect(zonesTessellationPath({ ...layout, radius: 2 }, AREA)).toBe('');
    expect(zonesTessellationPath(layout, { ...AREA, width: 0 })).toBe('');
  });

  it('recorta como tessellationPath: las celdas cuyo centro queda lejos de la ventana no entran', () => {
    const layout = layoutMap([at('a', CENTRO), at('b', MEDELLIN)], 0);
    const near = zonesTessellationPath(layout, { x: 0, y: 0, width: 800, height: 500 });
    expect(near).toBe('');
    const block = layout.blocks[0]!;
    const here = zonesTessellationPath(layout, { x: block.x, y: block.y, width: 400, height: 300 });
    expect(hexagons(here)).toHaveLength(7);
    // Una ventana que solo roza la zona deja entrar las celdas cuyo centro está a menos de dos radios del borde.
    const edge = zonesTessellationPath(layout, { x: block.x + 200 + 3 * layout.radius, y: block.y, width: 400, height: 300 });
    expect(hexagons(edge).length).toBeGreaterThan(0);
    expect(hexagons(edge).length).toBeLessThan(7);
  });

  it('en los niveles alejados no dibuja trama: cada grupo ya es una celda', () => {
    expect(zonesTessellationPath(layoutMap(BOGOTA, 1), AREA)).toBe('');
    expect(zonesTessellationPath(layoutMap(BOGOTA, 2), AREA)).toBe('');
  });
});

describe('hexmap · frameFit', () => {
  const ALL = [at('a', CENTRO), at('b', VECINA), at('c', SUBA), at('d', CENTRO), at('e', MEDELLIN)];

  it('RF-4 (024) · 4.1: dos Ápices de una misma zona caben en el nivel cercano, aunque la ventana sea angosta', () => {
    for (const viewport of [WIDE, NARROW]) {
      const frame = frameFit(ALL, ['a', 'd'], viewport);
      expect(frame.level).toBe(0);
      expect(frame.scale).toBe(LEVEL_SCALE[0]);
      const block = layoutMap(ALL, 0).blocks.find((candidate) => candidate.key === CENTRO.cell)!;
      expect(Math.abs(frame.x - block.x)).toBeLessThan(CELL_WIDTH * 1.5);
      expect(Math.abs(frame.y - block.y)).toBeLessThan(CELL_WIDTH * 1.5);
    }
  });

  it('RF-4 (024) · 4.1: dos Ápices de zonas vecinas caben en el nivel cercano y se centran entre ellos', () => {
    const frame = frameFit(ALL, ['a', 'b'], WIDE);
    expect(frame.level).toBe(0);
    const spots = layoutMap(ALL, 0).blocks.flatMap((block) => block.spots).filter((spot) => spot.id === 'a' || spot.id === 'b');
    const box = boxOf(spots.flatMap((spot) => spot.points));
    expect(frame.x).toBeCloseTo((box.minX + box.maxX) / 2);
    expect(frame.y).toBeCloseTo((box.minY + box.maxY) / 2);
  });

  it('RF-4 (024) · 4.1: dos Ápices en zonas lejanas van al nivel más cercano en que caben', () => {
    const city = frameFit(ALL, ['a', 'c'], WIDE);
    expect(city.level).toBe(1);
    expect(city.scale).toBe(LEVEL_SCALE[1]);
    const region = frameFit(ALL, ['a', 'e'], WIDE);
    expect(region.level).toBe(2);
  });

  it('RF-4 (024) · 4.1: si no caben ni en el nivel más lejano, ese nivel se aleja hasta que quepan', () => {
    const frame = frameFit(ALL, ['a', 'e'], NARROW);
    expect(frame.level).toBe(2);
    expect(frame.scale).toBeLessThan(LEVEL_SCALE[2]);
  });

  it('RF-4 (024) · 4.1: sin Ápices a la vista devuelve el encuadre inicial (RF-7 (021) · 7.4)', () => {
    expect(frameFit(ALL, ['no-existe'], WIDE)).toEqual(frameMap(ALL, WIDE));
    expect(frameFit(ALL, [], WIDE)).toEqual(frameMap(ALL, WIDE));
  });

  it('RF-4 (024) · 4.1: los ids desconocidos se ignoran', () => {
    expect(frameFit(ALL, ['a', 'fantasma'], WIDE)).toEqual(frameFit(ALL, ['a'], WIDE));
  });

  it('RF-4 (024) · 4.1: un Ápice sin ubicación lleva a su terreno', () => {
    const apices = [at('a', CENTRO), nowhere('x')];
    const frame = frameFit(apices, ['x'], WIDE);
    const spot = layoutMap(apices, 0).terrain!.spots[0]!;
    expect(frame.level).toBe(0);
    expect(frame.x).toBeCloseTo(spot.x);
    expect(frame.y).toBeCloseTo(spot.y);
  });

  it('RF-4 (024) · 4.1: un Ápice que va en el «+N» se encuadra con toda su zona', () => {
    const many = [...crowd(9, CENTRO), at('z', CHAPINERO)];
    const layout = layoutMap(many, 0);
    const block = layout.blocks.find((candidate) => candidate.key === CENTRO.cell)!;
    expect(block.spots.map((spot) => spot.id)).not.toContain('apice-8');
    const frame = frameFit(many, ['apice-8'], WIDE);
    const outline = boxOf(block.outline);
    expect(frame.level).toBe(0);
    expect(frame.x).toBeCloseTo((outline.minX + outline.maxX) / 2);
    expect(frame.y).toBeCloseTo((outline.minY + outline.maxY) / 2);
  });

  it('RF-4 (024) · 4.1: con `drawn` prefiere el primer nivel, entre los que caben, en que la Acción Común se dibuja', () => {
    const only = (level: number) => (layout: { level: number }) => layout.level === level;
    expect(frameFit(ALL, ['a', 'b'], WIDE, undefined, only(0)).level).toBe(0);
    expect(frameFit(ALL, ['a', 'b'], WIDE, undefined, only(1)).level).toBe(1);
    expect(frameFit(ALL, ['a', 'b'], WIDE, undefined, only(2)).level).toBe(2);
  });

  it('RF-4 (024) · 4.1: si la Acción Común no se dibuja en ningún nivel, queda el primero en que caben', () => {
    expect(frameFit(ALL, ['a', 'b'], WIDE, undefined, () => false)).toEqual(frameFit(ALL, ['a', 'b'], WIDE));
  });

  it('RF-4 (024) · 4.1: si la Acción Común se dibuja en un nivel pero sus paradas no caben juntas, se queda en ese nivel centrada en una de ellas', () => {
    const only0 = (layout: { level: number }) => layout.level === 0;
    const frame = frameFit(ALL, ['a', 'c'], WIDE, undefined, only0);
    expect(frame.level).toBe(0);
    expect(frame.scale).toBe(LEVEL_SCALE[0]);
    const spots = layoutMap(ALL, 0).blocks.flatMap((block) => block.spots);
    expect(spots.some((spot) => (spot.id === 'a' || spot.id === 'c') && spot.x === frame.x && spot.y === frame.y)).toBe(true);
  });

  it('RF-3 (024), D-12 (024): sin área reservada (o con 0) el encuadre es el de siempre', () => {
    expect(frameFit(ALL, ['a'], NARROW, undefined, undefined, 0)).toEqual(frameFit(ALL, ['a'], NARROW));
    expect(frameFit(ALL, ['a', 'c'], WIDE, undefined, undefined, 0)).toEqual(frameFit(ALL, ['a', 'c'], WIDE));
  });

  it('RF-3 (024), D-12 (024): reservar el borde de abajo corre el centro para que el Ápice quede en el área libre', () => {
    const plain = frameFit(ALL, ['a'], NARROW);
    const frame = frameFit(ALL, ['a'], NARROW, undefined, undefined, 260);
    expect(frame.level).toBe(plain.level);
    expect(frame.x).toBeCloseTo(plain.x);
    // El mapa se dibuja con su centro en medio de la ventana: bajar el centro 130 px sube la celda 130 px.
    expect(frame.y).toBeCloseTo(plain.y + 130);
    // La celda, con ese encuadre, queda del todo por encima del área reservada.
    const spot = layoutMap(ALL, 0).blocks.flatMap((block) => block.spots).find((candidate) => candidate.id === 'a')!;
    const bottom = NARROW.height / 2 + (boxOf(spot.points).maxY - frame.y);
    expect(bottom).toBeLessThanOrEqual(NARROW.height - 260);
  });

  it('RF-3 (024), D-12 (024): mide el ajuste con el área libre, no con toda la ventana', () => {
    // Dos Ápices de zonas vecinas caben en 720 px de alto, pero no en lo que deja libre una reserva muy grande.
    const free = frameFit(ALL, ['a', 'b'], WIDE);
    const tight = frameFit(ALL, ['a', 'b'], WIDE, undefined, undefined, 500);
    expect(free.level).toBe(0);
    expect(tight.level).toBeGreaterThan(0);
  });

  it('RF-3 (024), D-12 (024): dos Ápices de una misma zona conservan el nivel y el centro horizontal al reservar', () => {
    const plain = frameFit(ALL, ['a', 'd'], NARROW);
    const frame = frameFit(ALL, ['a', 'd'], NARROW, undefined, undefined, 200);
    expect(frame.level).toBe(plain.level);
    expect(frame.x).toBeCloseTo(plain.x);
    expect(frame.y).toBeCloseTo(plain.y + 100);
  });

  it('RF-4 (024) · 4.1: el resultado no depende del orden de los ids ni de la llegada de los Ápices', () => {
    expect(frameFit(ALL, ['c', 'a'], WIDE)).toEqual(frameFit(ALL, ['a', 'c'], WIDE));
    expect(frameFit([...ALL].reverse(), ['a', 'e'], WIDE)).toEqual(frameFit(ALL, ['a', 'e'], WIDE));
  });
});

describe('hexmap · sin ubicación', () => {
  it('RF-9 (021) · 9.1: los Ápices sin ubicación van en un terreno aparte, al sur de las zonas, en celdas del mismo tamaño', () => {
    const layout = layoutMap([at('a', CENTRO), nowhere('x'), nowhere('y'), at('b', SUBA), nowhere('w')], 0);
    const terrain = layout.terrain!;
    expect(terrain.spots.map((spot) => spot.id)).toEqual(['w', 'x', 'y']);
    for (const block of layout.blocks) expect(terrain.y).toBeGreaterThan(boxOf(block.outline).maxY);
    for (const spot of terrain.spots) {
      expect(spot.points).toHaveLength(6);
      const box = boxOf(spot.points);
      expect(box.minX).toBeGreaterThanOrEqual(terrain.x);
      expect(box.maxX).toBeLessThanOrEqual(terrain.x + terrain.width);
      expect(box.minY).toBeGreaterThanOrEqual(terrain.y);
      expect(box.maxY).toBeLessThanOrEqual(terrain.y + terrain.height);
      expect(Math.abs(widthOf(spot.points) - CELL_WIDTH)).toBeLessThan(CELL_WIDTH * 0.15);
    }
    expect(layout.bounds!.maxY).toBeGreaterThanOrEqual(terrain.y + terrain.height);
  });

  it('RF-9 (021) · 9.1: los del terreno no se encima ni comparten celda', () => {
    const { terrain } = layoutMap(Array.from({ length: 14 }, (_, index) => nowhere(`u${index}`)), 0);
    const spots = terrain!.spots;
    expect(new Set(spots.map((spot) => spot.cell)).size).toBe(14);
    spots.forEach((spot, index) => {
      for (const other of spots.slice(index + 1)) expect(Math.hypot(spot.x - other.x, spot.y - other.y)).toBeGreaterThan(CELL_WIDTH * 0.95);
    });
  });

  it('RF-9 (021) · 9.1: el terreno aparte existe aunque ningún Ápice tenga ubicación, y no hay terreno si todos la tienen', () => {
    const only = layoutMap([nowhere('x'), nowhere('y')], 0);
    expect(only.blocks).toEqual([]);
    expect(only.terrain!.spots).toHaveLength(2);
    expect(only.bounds).not.toBeNull();
    expect(frameMap([nowhere('x'), nowhere('y')], WIDE).level).toBe(0);
    expect(layoutMap([at('a', CENTRO)], 0).terrain).toBeNull();
  });

  it('RF-9 (021) · 9.1: en los niveles alejados los Ápices sin ubicación son un grupo aparte, al sur', () => {
    for (const level of [1, 2] as const) {
      const layout = layoutMap([at('a', CENTRO), at('b', SUBA), nowhere('x'), nowhere('y')], level);
      const unlocated = layout.groups.filter((group) => group.unlocated);
      expect(unlocated).toHaveLength(1);
      expect(unlocated[0]!.key).toBe(UNLOCATED_KEY);
      expect(unlocated[0]!.ids).toEqual(['x', 'y']);
      for (const group of layout.groups.filter((candidate) => !candidate.unlocated)) expect(unlocated[0]!.y).toBeGreaterThan(group.y);
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

  it('RF-8 (021) · 8.4: la flecha lleva a la celda más cercana en esa dirección', () => {
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

  it('RF-8 (021) · 8.4: sin celda en esa dirección, o con otra tecla, no hay vecino', () => {
    expect(mapNeighbor(spots, 'lejos-este', 'ArrowRight')).toBeNull();
    expect(mapNeighbor(spots, 'norte', 'ArrowUp')).toBeNull();
    expect(mapNeighbor(spots, 'centro', 'Enter')).toBeNull();
    expect(mapNeighbor(spots, 'no-existe', 'ArrowRight')).toBeNull();
  });

  it('RF-8 (021) · 8.4: las celdas reales de una zona se alcanzan unas a otras con las flechas', () => {
    const [block] = layoutMap(crowd(7, CENTRO), 0).blocks;
    const places = block!.spots;
    for (const place of places) {
      const reachable = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map((key) => mapNeighbor(places, place.id, key)).filter((id) => id !== null);
      expect(reachable.length, place.id).toBeGreaterThan(0);
    }
  });

  it('RF-4 (021) · 4.3: la escala es una distancia redonda que cabe en su barra', () => {
    expect(scaleBar(LEVEL_SCALE[0])).toEqual({ meters: 1000, px: 100, label: '1 km' });
    expect(scaleBar(LEVEL_SCALE[1]).label).toBe('5 km');
    expect(scaleBar(LEVEL_SCALE[2]).label).toBe('50 km');
    for (const scale of [LEVEL_SCALE[0], LEVEL_SCALE[1], LEVEL_SCALE[2], 0.3]) {
      const bar = scaleBar(scale);
      expect(bar.px).toBeLessThanOrEqual(120);
      expect(bar.px).toBeGreaterThan(40);
      expect(bar.px).toBeCloseTo((bar.meters / 1000) * scale);
    }
  });
});

describe('hexmap · frameAtLevel', () => {
  const APICES = [at('a', CENTRO), at('b', VECINA), at('c', SUBA), at('e', MEDELLIN)];
  const HOME = frameMap(APICES, WIDE);

  it('sin cambio de nivel devuelve el mismo encuadre', () => {
    expect(frameAtLevel(APICES, HOME, HOME.level, WIDE)).toBe(HOME);
  });

  it('con un cambio de nivel nunca deja la ventana sin contenido (zonas, grupos o terreno cerca del centro)', () => {
    const levels = [0, 1, 2] as const;
    for (const from of levels) {
      for (const to of levels) {
        if (to === from) continue;
        // Un centro lejos de todo: sobre el océano, a 40 000 unidades de las celdas.
        const lost: typeof HOME = { level: from, scale: LEVEL_SCALE[from], x: 40000, y: -40000 };
        const frame = frameAtLevel(APICES, lost, to, WIDE);
        expect(frame.level).toBe(to);
        const layout = layoutMap(APICES, to, frame.scale);
        const near = [...layout.blocks.map((block) => block.outline), ...layout.groups.map((group) => group.points)].some((points) => {
          const box = boxOf(points);
          return box.maxX >= frame.x - WIDE.width / 2 && box.minX <= frame.x + WIDE.width / 2 && box.maxY >= frame.y - WIDE.height / 2 && box.minY <= frame.y + WIDE.height / 2;
        });
        expect(near).toBe(true);
      }
    }
  });

  it('conserva el centro, en proporción a la escala, cuando ya hay contenido dentro de la ventana', () => {
    const near = layoutMap(APICES, 0).blocks[0]!;
    const from: typeof HOME = { level: 0, scale: LEVEL_SCALE[0], x: near.x + 10, y: near.y };
    const frame = frameAtLevel(APICES, from, 1, WIDE);
    expect(frame.scale).toBe(LEVEL_SCALE[1]);
    expect(frame.x).toBeCloseTo(((near.x + 10) * LEVEL_SCALE[1]) / LEVEL_SCALE[0]);
  });

  it('si en el nivel pedido caben todos en la ventana, los encuadra enteros aunque el centro conservado los recortara', () => {
    const near = [at('a', CENTRO), at('b', VECINA), at('c', SUBA), at('d', CHAPINERO), nowhere('u')];
    const tall = { width: 1000, height: 520 };
    const layout2 = layoutMap(near, 2);
    expect(layout2.bounds).not.toBeNull();
    const bounds = layout2.bounds!;
    expect(bounds.maxY - bounds.minY).toBeLessThanOrEqual(tall.height - 48);
    // Desde el nivel cercano, centrado en la zona de CENTRO: conservar el centro dejaría el grupo de abajo medio fuera.
    const block = layoutMap(near, 0).blocks.find((candidate) => candidate.ids.includes('a'))!;
    const from: typeof HOME = { level: 0, scale: LEVEL_SCALE[0], x: block.x, y: block.y };
    const keptY = (block.y * LEVEL_SCALE[2]) / LEVEL_SCALE[0];
    const keptX = (block.x * LEVEL_SCALE[2]) / LEVEL_SCALE[0];
    const clipped = bounds.minY < keptY - tall.height / 2 + 24 || bounds.maxY > keptY + tall.height / 2 - 24 || bounds.minX < keptX - tall.width / 2 + 24 || bounds.maxX > keptX + tall.width / 2 - 24;
    expect(clipped, 'premisa: conservar el centro recortaría').toBe(true);
    const frame = frameAtLevel(near, from, 2, tall);
    expect(frame.level).toBe(2);
    const shown = layoutMap(near, 2, frame.scale).bounds!;
    expect(shown.minY).toBeGreaterThanOrEqual(frame.y - tall.height / 2 + 24 - 0.5);
    expect(shown.maxY).toBeLessThanOrEqual(frame.y + tall.height / 2 - 24 + 0.5);
    expect(shown.minX).toBeGreaterThanOrEqual(frame.x - tall.width / 2 + 24 - 0.5);
    expect(shown.maxX).toBeLessThanOrEqual(frame.x + tall.width / 2 - 24 + 0.5);
    // Una ventana más baja (la leyenda con filtro ocupa más): vuelve a encuadrar.
    const low = { width: 1000, height: bounds.maxY - bounds.minY + 60 };
    const again = frameAtLevel(near, from, 2, low);
    const seen = layoutMap(near, 2, again.scale).bounds!;
    expect(seen.maxY).toBeLessThanOrEqual(again.y + low.height / 2 - 24 + 0.5);
    expect(seen.minY).toBeGreaterThanOrEqual(again.y - low.height / 2 + 24 - 0.5);
  });

  it('con un Ápice elegido a la vista en el nivel pedido, se centra en él', () => {
    const lost: typeof HOME = { level: 2, scale: LEVEL_SCALE[2], x: 40000, y: -40000 };
    const frame = frameAtLevel(APICES, lost, 0, WIDE, 'a');
    const spot = layoutMap(APICES, 0).blocks.flatMap((block) => block.spots).find((candidate) => candidate.id === 'a')!;
    expect(frame.x).toBeCloseTo(spot.x);
    expect(frame.y).toBeCloseTo(spot.y);
  });
});
