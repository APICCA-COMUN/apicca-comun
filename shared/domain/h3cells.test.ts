// Las celdas H3 del mapa: la zona de siete celdas, su borde, los bordes en caché, las celdas de cada nivel y las rutas.
import { cellToParent, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import {
  CELL_RESOLUTION,
  LEVEL_RESOLUTION,
  ROUTE_LIMIT,
  cellBoundary,
  cellCenter,
  cellOfPoint,
  cellsAround,
  edgeKm,
  isCellOf,
  outlineOf,
  routeCells,
  zoneCells,
  zoneCode,
} from './h3cells';

const CENTRO = '8766e092affffff';
const CHAPINERO = '8766e42d2ffffff';
const MEDELLIN = '876619d92ffffff';

describe('zoneCode', () => {
  it('es el tramo de cuatro dígitos del índice que distingue a las zonas vecinas', () => {
    expect(zoneCode(CHAPINERO)).toBe('42d2');
    expect(zoneCode(CENTRO)).toBe('092a');
  });
});

describe('isCellOf', () => {
  it('acepta una celda de la resolución pedida y rechaza lo demás sin lanzar', () => {
    expect(isCellOf(CENTRO, 7)).toBe(true);
    expect(isCellOf(CENTRO, 8)).toBe(false);
    expect(isCellOf('punto:4.6,-74.1', 7)).toBe(false);
    expect(isCellOf(undefined, 7)).toBe(false);
    expect(isCellOf('', 7)).toBe(false);
  });
});

describe('niveles', () => {
  it('cada nivel alejado usa una celda siete veces más ancha que el anterior', () => {
    expect(LEVEL_RESOLUTION[0]).toBe(CELL_RESOLUTION);
    expect(edgeKm(LEVEL_RESOLUTION[1]) / edgeKm(LEVEL_RESOLUTION[0])).toBeCloseTo(7, 1);
    expect(edgeKm(LEVEL_RESOLUTION[2]) / edgeKm(LEVEL_RESOLUTION[1])).toBeCloseTo(7, 1);
  });
});

describe('zoneCells', () => {
  it('son siete celdas de resolución 8: la central, que es la hija central de la zona, y seis alrededor', () => {
    const cells = zoneCells(CENTRO);
    expect(cells).toHaveLength(7);
    expect(new Set(cells).size).toBe(7);
    for (const cell of cells) expect(isCellOf(cell, CELL_RESOLUTION)).toBe(true);
    expect(cellToParent(cells[0]!, 7)).toBe(CENTRO);
  });

  it('el anillo va en el sentido del reloj, desde el norte', () => {
    const [center, ...ring] = zoneCells(CENTRO);
    const middle = cellCenter(center!);
    const angles = ring.map((cell) => {
      const point = cellCenter(cell);
      const dx = (point.lng - middle.lng) * Math.cos((middle.lat * Math.PI) / 180);
      return (Math.atan2(dx, point.lat - middle.lat) + 2 * Math.PI) % (2 * Math.PI);
    });
    expect([...angles].sort((a, b) => a - b)).toEqual(angles);
  });

  it('no depende de cuántas veces se pida', () => {
    expect(zoneCells(CHAPINERO)).toEqual(zoneCells(CHAPINERO));
  });

  it('lo que no es una celda de zona da lista vacía', () => {
    expect(zoneCells('nada')).toEqual([]);
    expect(zoneCells(cellToParent(CENTRO, 5))).toEqual([]);
  });
});

describe('outlineOf', () => {
  it('la zona de siete celdas tiene un solo borde exterior de 18 vértices', () => {
    expect(outlineOf(zoneCells(CENTRO))).toHaveLength(18);
  });

  it('una sola celda tiene seis vértices y sin celdas no hay borde', () => {
    expect(outlineOf([zoneCells(CENTRO)[0]!])).toHaveLength(6);
    expect(outlineOf([])).toEqual([]);
  });

  it('con celdas inválidas devuelve vacío en lugar de lanzar', () => {
    expect(outlineOf(['nada'])).toEqual([]);
  });
});

describe('cellBoundary', () => {
  it('da los seis vértices de la celda y repite el mismo arreglo mientras esté en caché', () => {
    const cell = zoneCells(CENTRO)[0]!;
    const first = cellBoundary(cell);
    expect(first).toHaveLength(6);
    expect(cellBoundary(cell)).toBe(first);
  });
});

describe('cellsAround', () => {
  it('con cero anillos es la celda del punto; con uno, siete', () => {
    const point = { lat: 4.6097, lng: -74.0817 };
    expect(cellsAround(point, 8, 0)).toEqual([cellOfPoint(point, 8)]);
    expect(cellsAround(point, 8, 1)).toHaveLength(7);
    expect(cellsAround(point, 8, 3)).toHaveLength(37);
  });

  it('una resolución imposible da lista vacía', () => {
    expect(cellsAround({ lat: 0, lng: 0 }, 99, 1)).toEqual([]);
  });
});

describe('routeCells', () => {
  const at = (lat: number, lng: number, resolution = 8) => latLngToCell(lat, lng, resolution);

  it('une las dos celdas, con las puntas, sin repetir ninguna', () => {
    const from = at(4.6, -74.08);
    const to = at(4.65, -74.05);
    const route = routeCells(from, to)!;
    expect(route[0]).toBe(from);
    expect(route[route.length - 1]).toBe(to);
    expect(new Set(route).size).toBe(route.length);
    expect(route.length).toBeGreaterThan(2);
  });

  it('celdas pegadas dan solo las dos y la misma celda da una', () => {
    const from = zoneCells(CENTRO)[0]!;
    const next = zoneCells(CENTRO)[1]!;
    expect(routeCells(from, next)).toEqual([from, next]);
    expect(routeCells(from, from)).toEqual([from]);
  });

  it('más lejos que el tope no se dibuja', () => {
    // Bogotá a Medellín son unas 270 celdas de resolución 8.
    expect(routeCells(at(4.6, -74.08), at(6.24, -75.58))).toBeNull();
    expect(routeCells(at(4.6, -74.08, 6), at(6.24, -75.58, 6))).not.toBeNull();
    expect(ROUTE_LIMIT).toBeGreaterThan(40);
  });

  it('no lanza con celdas de otra resolución o inválidas', () => {
    expect(() => routeCells(at(4.6, -74.08), at(4.6, -74.08, 6))).not.toThrow();
    expect(routeCells('nada', 'nada')).toBeNull();
  });

  it('las zonas del ejemplo caen en sitios distintos', () => {
    expect(cellCenter(CHAPINERO).lat).toBeGreaterThan(cellCenter(CENTRO).lat);
    expect(MEDELLIN).not.toBe(CENTRO);
  });
});
