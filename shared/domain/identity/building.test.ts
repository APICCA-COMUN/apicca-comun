// Pruebas de celda base y escala para edificios de ápices (RF-7 (002) · 7.2, D-T10 (002)) y de su forma vectorial
// (RF-2 (021), RF-3 (021), D-T3 (021)).
import { describe, expect, it } from 'vitest';
import type { Axis } from '../apice';
import { BUILDING_CELL, buildingParts, buildingScale, buildingShape, type BuildingShape } from './building';

describe('building', () => {
  it('RF-4 (019) · 4.1 a 4.3, D-T19 (019): idea es solo la base; prototipo suma el cuerpo; en marcha suma el techo', () => {
    expect(buildingParts('idea')).toEqual(['base']);
    expect(buildingParts('prototipo')).toEqual(['base', 'body']);
    expect(buildingParts('en marcha')).toEqual(['base', 'body', 'roof']);
  });

  it('RF-7 (002) · 7.2: constante BUILDING_CELL fija la celda en 64 px', () => {
    expect(BUILDING_CELL).toBe(64);
  });

  it('RF-7 (002) · 7.2: ancho de 64 px escala a 1', () => {
    expect(buildingScale(64, 4)).toBe(1);
  });

  it('RF-7 (002) · 7.2: ancho de 128 px con máximo 4 escala a 2', () => {
    expect(buildingScale(128, 4)).toBe(2);
  });

  it('RF-7 (002) · 7.2: ancho de 1000 px con máximo 2 escala a 2', () => {
    expect(buildingScale(1000, 2)).toBe(2);
  });

  it('RF-7 (002) · 7.2: ancho de 1000 px con máximo 4 escala a 4', () => {
    expect(buildingScale(1000, 4)).toBe(4);
  });

  it('RF-7 (002) · 7.2: ancho defensivo de 0 px escala a 1', () => {
    expect(buildingScale(0, 4)).toBe(1);
  });

  it('RF-7 (002) · 7.2: ancho defensivo de 63 px escala a 1', () => {
    expect(buildingScale(63, 4)).toBe(1);
  });

  it('RF-7 (002) · 7.2: ancho negativo o no finito escala a 1', () => {
    expect(buildingScale(-10, 4)).toBe(1);
    expect(buildingScale(Number.NaN, 4)).toBe(1);
    expect(buildingScale(Number.POSITIVE_INFINITY, 4)).toBe(1);
  });
});

// Forma vectorial del edificio (RF-2 (021), RF-3 (021), D-T3 (021)).
describe('buildingShape', () => {
  const ALL: readonly Axis[] = ['agua', 'alimento', 'cobijo', 'energía', 'comunicación'];
  const STAGES = ['idea', 'prototipo', 'en marcha'] as const;
  const SEEDS = Array.from({ length: 40 }, (_, i) => `apice-${i}`);

  /** Todas las cajas de una forma: base, cuerpo, vanos, puerta, techo y motivos. */
  function boxes(shape: BuildingShape): { x: number; y: number; width: number; height: number }[] {
    const roof = shape.roof === null ? [] : shape.roof.points.map(([x, y]) => ({ x, y, width: 0, height: 0 }));
    const body = shape.body === null ? [] : [shape.body];
    const door = shape.door === null ? [] : [shape.door];
    const motifs = shape.motifs.map(({ x, y, size }) => ({ x, y, width: size, height: size }));
    return [shape.base, ...body, ...shape.windows, ...door, ...roof, ...motifs];
  }

  it('RF-2 (021) · 2.1, RNF-5 (021): la forma sale solo de los ejes, la etapa y la semilla, y cabe en la celda de 64 unidades', () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        for (const axes of [ALL.slice(0, 1), ALL.slice(1, 4), ALL]) {
          for (const box of boxes(buildingShape({ axes, stage, seed }))) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(BUILDING_CELL);
            expect(box.y + box.height).toBeLessThanOrEqual(BUILDING_CELL);
          }
        }
      }
    }
  });

  it('RF-2 (021) · 2.3: lleva un motivo por cada eje, en el orden canónico, sin repetir y en las tres etapas', () => {
    for (const stage of STAGES) {
      const shape = buildingShape({ axes: ['comunicación', 'agua', 'energía', 'agua'], stage, seed: 'a' });
      expect(shape.motifs.map((motif) => motif.axis)).toEqual(['agua', 'energía', 'comunicación']);
    }
    expect(buildingShape({ axes: ALL, stage: 'idea', seed: 'a' }).motifs).toHaveLength(5);
    expect(buildingShape({ axes: [], stage: 'idea', seed: 'a' }).motifs).toEqual([]);
  });

  it('RF-2 (021) · 2.3: los motivos no se enciman y todos miden lo mismo', () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS.slice(0, 8)) {
        const { motifs } = buildingShape({ axes: ALL, stage, seed });
        expect(new Set(motifs.map((motif) => motif.size)).size).toBe(1);
        for (let i = 1; i < motifs.length; i += 1) {
          expect(motifs[i]!.x).toBeGreaterThanOrEqual(motifs[i - 1]!.x + motifs[i - 1]!.size);
          expect(motifs[i]!.y).toBe(motifs[0]!.y);
        }
      }
    }
  });

  it('RF-2 (021) · 2.4: la misma entrada da siempre la misma forma', () => {
    const input = { axes: ['cobijo', 'agua'] as Axis[], stage: 'en marcha' as const, seed: 'Qx7ZpLm2' };
    expect(buildingShape(input)).toEqual(buildingShape({ ...input, axes: ['agua', 'cobijo'] }));
  });

  it('RF-2 (021) · 2.5: la variante sale de la semilla; entre 40 identificadores aparecen las cuatro y cambian el cuerpo y el techo', () => {
    const shapes = SEEDS.map((seed) => buildingShape({ axes: ['agua'], stage: 'en marcha', seed }));
    expect(new Set(shapes.map((shape) => shape.variant))).toEqual(new Set([0, 1, 2, 3]));
    const byVariant = new Map(shapes.map((shape) => [shape.variant, shape]));
    expect(new Set([...byVariant.values()].map((shape) => shape.roof!.kind)).size).toBe(4);
    expect(new Set([...byVariant.values()].map((shape) => `${shape.body!.width}x${shape.body!.height}`)).size).toBe(4);
  });

  it('RF-2 (021) · 2.5: sin semilla la variante es 0', () => {
    expect(buildingShape({ axes: ['agua'], stage: 'prototipo' }).variant).toBe(0);
    expect(buildingShape({ axes: ['agua'], stage: 'prototipo', seed: '' }).variant).toBe(0);
  });

  it('RF-3 (021) · 3.1: una idea es solo la base, con sus motivos sobre ella', () => {
    const shape = buildingShape({ axes: ['agua', 'cobijo'], stage: 'idea', seed: 'a' });
    expect(shape.parts).toEqual(['base']);
    expect(shape.body).toBeNull();
    expect(shape.roof).toBeNull();
    expect(shape.windows).toEqual([]);
    expect(shape.door).toBeNull();
    for (const motif of shape.motifs) expect(motif.y + motif.size).toBeLessThanOrEqual(shape.base.y);
  });

  it('RF-3 (021) · 3.2: un prototipo suma el cuerpo, que se apoya en la base, con vanos y puerta dentro', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const shape = buildingShape({ axes: ['energía'], stage: 'prototipo', seed });
      const body = shape.body!;
      expect(shape.parts).toEqual(['base', 'body']);
      expect(shape.roof).toBeNull();
      expect(body.y + body.height).toBe(shape.base.y);
      expect(body.x).toBeGreaterThanOrEqual(shape.base.x);
      expect(body.x + body.width).toBeLessThanOrEqual(shape.base.x + shape.base.width);
      expect(shape.windows.length).toBeGreaterThan(0);
      for (const box of [...shape.windows, shape.door!]) {
        expect(box.x).toBeGreaterThan(body.x);
        expect(box.x + box.width).toBeLessThan(body.x + body.width);
        expect(box.y).toBeGreaterThan(body.y);
        expect(box.y + box.height).toBeLessThanOrEqual(body.y + body.height);
      }
      for (const motif of shape.motifs) expect(motif.y + motif.size).toBeLessThanOrEqual(body.y);
    }
  });

  it('RF-3 (021) · 3.3: en marcha suma el techo, que se apoya en el cuerpo y lleva dentro los motivos de sus ejes', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const shape = buildingShape({ axes: ALL, stage: 'en marcha', seed });
      const body = shape.body!;
      const roof = shape.roof!;
      expect(shape.parts).toEqual(['base', 'body', 'roof']);
      const xs = roof.points.map(([x]) => x);
      const ys = roof.points.map(([, y]) => y);
      expect(Math.max(...ys)).toBe(body.y);
      expect(Math.min(...xs)).toBeLessThanOrEqual(body.x);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(body.x + body.width);
      expect(shape.motifs).toHaveLength(5);
      for (const motif of shape.motifs) {
        expect(motif.x).toBeGreaterThanOrEqual(roof.band.x);
        expect(motif.x + motif.size).toBeLessThanOrEqual(roof.band.x + roof.band.width);
        expect(motif.y).toBeGreaterThanOrEqual(roof.band.y);
        expect(motif.y + motif.size).toBeLessThanOrEqual(roof.band.y + roof.band.height);
      }
    }
  });

  it('RF-3 (021) · 3.1 a 3.3: al crecer, la base no se mueve y el cuerpo tampoco', () => {
    const at = (stage: (typeof STAGES)[number]) => buildingShape({ axes: ['agua'], stage, seed: 'mismo' });
    expect(at('prototipo').base).toEqual(at('idea').base);
    expect(at('en marcha').base).toEqual(at('idea').base);
    expect(at('en marcha').body).toEqual(at('prototipo').body);
    expect(at('en marcha').windows).toEqual(at('prototipo').windows);
  });
});
