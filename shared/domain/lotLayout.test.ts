import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOT_CELL, TRAIL_MIN_WIDTH, lotColumns, lotLayout, lotNeighbor, lotTrail, lotTrailNeighbor } from './lotLayout';

describe('lotColumns', () => {
  it('RF-6 (005) · 6.2, D-T3 (005): caben de 1 a 6 columnas de 160 px según el ancho', () => {
    expect(LOT_CELL).toBe(160);
    expect(lotColumns(0)).toBe(1);
    expect(lotColumns(328)).toBe(2);
    expect(lotColumns(480)).toBe(3);
    expect(lotColumns(1104)).toBe(6);
    expect(lotColumns(5000)).toBe(6);
    expect(lotColumns(Number.NaN)).toBe(1);
  });
});

describe('lotLayout', () => {
  it('RF-6 (005) · 6.1: los edificios van en el orden de la lista, de izquierda a derecha y de arriba abajo', () => {
    const { cells, rows } = lotLayout(5, 3);
    expect(rows).toBe(2);
    expect(cells).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ]);
  });

  it('RF-6 (005) · 6.2: la misma lista y el mismo ancho dan siempre el mismo dibujo', () => {
    expect(lotLayout(7, 4)).toEqual(lotLayout(7, 4));
  });

  it('RF-6 (005) · 6.3: caminos entre filas y entre columnas, y un nodo en cada cruce', () => {
    const { roads, nodes } = lotLayout(6, 3);
    // Dos filas y tres columnas: un camino entre las filas y dos entre las columnas.
    expect(roads).toEqual([
      { x1: 0, y1: 1, x2: 3, y2: 1 },
      { x1: 1, y1: 0, x2: 1, y2: 2 },
      { x1: 2, y1: 0, x2: 2, y2: 2 },
    ]);
    expect(nodes).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });

  it('RF-6 (005) · 6.3: con una columna no hay cruces; con una fila, solo caminos entre columnas', () => {
    expect(lotLayout(3, 1).nodes).toEqual([]);
    expect(lotLayout(3, 1).roads).toHaveLength(2);
    const row = lotLayout(3, 4);
    expect(row.columns).toBe(3);
    expect(row.nodes).toEqual([]);
    expect(row.roads).toEqual([
      { x1: 1, y1: 0, x2: 1, y2: 1 },
      { x1: 2, y1: 0, x2: 2, y2: 1 },
    ]);
  });

  it('RF-6 (005) · 6.9: con la lista vacía no hay nada que dibujar', () => {
    expect(lotLayout(0, 4)).toEqual({ columns: 0, rows: 0, cells: [], roads: [], nodes: [] });
  });
});

describe('lotNeighbor', () => {
  it('RF-6 (005) · 6.7: las flechas llevan al vecino de la retícula y se detienen en los bordes', () => {
    // 0 1 2
    // 3 4
    expect(lotNeighbor(0, 'ArrowRight', 5, 3)).toBe(1);
    expect(lotNeighbor(2, 'ArrowRight', 5, 3)).toBeNull();
    expect(lotNeighbor(4, 'ArrowRight', 5, 3)).toBeNull();
    expect(lotNeighbor(3, 'ArrowLeft', 5, 3)).toBeNull();
    expect(lotNeighbor(4, 'ArrowLeft', 5, 3)).toBe(3);
    expect(lotNeighbor(1, 'ArrowDown', 5, 3)).toBe(4);
    expect(lotNeighbor(2, 'ArrowDown', 5, 3)).toBeNull();
    expect(lotNeighbor(4, 'ArrowUp', 5, 3)).toBe(1);
    expect(lotNeighbor(1, 'ArrowUp', 5, 3)).toBeNull();
    expect(lotNeighbor(1, 'Enter', 5, 3)).toBeNull();
  });
});

describe('RNF-3 (005)', () => {
  it('RNF-3 (005): la retícula es código puro y el sitio no suma dependencias', () => {
    const source = readFileSync(new URL('./lotLayout.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/^import /m);
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['firebase', 'leaflet', 'react', 'react-dom']);
    expect(Object.keys(pkg.devDependencies).sort()).toEqual([
      '@firebase/rules-unit-testing',
      '@testing-library/dom',
      '@testing-library/react',
      '@testing-library/user-event',
      '@types/leaflet',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@vitejs/plugin-react',
      '@vitest/browser-playwright',
      'firebase-tools',
      'jsdom',
      'playwright',
      'typescript',
      'vite',
      'vitest',
    ]);
  });
});

describe('lotTrail', () => {
  it('RF-6 (005) · 6.10, D-T11 (005): con 6 ápices reproduce las posiciones del canvas', () => {
    const { points, minHeight, nodes } = lotTrail(6);
    expect(minHeight).toBe(560);
    expect(points).toEqual([
      { x: 40, y: 46 },
      { x: 18, y: 22 },
      { x: 76, y: 20 },
      { x: 82, y: 54 },
      { x: 58, y: 76 },
      { x: 18, y: 70 },
    ]);
    expect(nodes).toEqual([
      { x: 40, y: 22 },
      { x: 60, y: 46 },
      { x: 40, y: 70 },
    ]);
  });

  it('RF-6 (005) · 6.10: es determinista y no pide nada fuera de la cantidad', () => {
    expect(lotTrail(9)).toEqual(lotTrail(9));
  });

  it('RF-6 (005) · 6.10: la lista vacía no dibuja nada', () => {
    expect(lotTrail(0)).toEqual({ bands: 0, minHeight: 0, points: [], roads: [], nodes: [] });
  });

  it('RF-6 (005) · 6.10: cada ápice tiene su punto, dentro del lote y sin solaparse, de 1 a 20 ápices', () => {
    for (let count = 1; count <= 20; count += 1) {
      const { points, bands, minHeight } = lotTrail(count);
      expect(points).toHaveLength(count);
      expect(minHeight).toBe(560 * bands);
      expect(new Set(points.map((p) => `${p.x}/${p.y}`)).size).toBe(count);
      for (const p of points) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(100);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(100);
      }
    }
  });

  it('RF-6 (005) · 6.10: los caminos y los nodos aparecen según los edificios que los usan', () => {
    expect(lotTrail(1).roads).toEqual([]);
    expect(lotTrail(1).nodes).toEqual([]);
    expect(lotTrail(2).nodes).toEqual([{ x: 40, y: 22 }]);
    expect(lotTrail(3).nodes).toHaveLength(2);
    expect(lotTrail(6).roads.length).toBeGreaterThan(lotTrail(3).roads.length);
  });

  it('RF-6 (005) · 6.10: con más de 6 ápices suma una franja más, de 560 px, debajo de la anterior', () => {
    const { bands, minHeight, points } = lotTrail(7);
    expect(bands).toBe(2);
    expect(minHeight).toBe(1120);
    expect(points[6]!.y).toBeGreaterThan(50);
    expect(TRAIL_MIN_WIDTH).toBe(560);
  });
});

describe('lotTrailNeighbor', () => {
  const { points } = lotTrail(6);
  it('RF-6 (005) · 6.11: derecha e izquierda van al siguiente y al anterior del recorrido, y se detienen en los extremos', () => {
    expect(lotTrailNeighbor(0, 'ArrowRight', points)).toBe(1);
    expect(lotTrailNeighbor(1, 'ArrowLeft', points)).toBe(0);
    expect(lotTrailNeighbor(5, 'ArrowRight', points)).toBeNull();
    expect(lotTrailNeighbor(0, 'ArrowLeft', points)).toBeNull();
  });

  it('RF-6 (005) · 6.11: arriba y abajo van al más cercano por encima o por debajo, y se detienen en el borde', () => {
    // Desde (40,46): por encima, (18,22) queda más cerca que (76,20); por debajo, (18,70) más que (58,76).
    expect(lotTrailNeighbor(0, 'ArrowUp', points)).toBe(1);
    expect(lotTrailNeighbor(0, 'ArrowDown', points)).toBe(5);
    expect(lotTrailNeighbor(2, 'ArrowUp', points)).toBeNull();
    expect(lotTrailNeighbor(4, 'ArrowDown', points)).toBeNull();
    expect(lotTrailNeighbor(0, 'a', points)).toBeNull();
  });
});
