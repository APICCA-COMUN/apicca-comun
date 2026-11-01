// Pruebas de celda base y escala para edificios de ápices (RF-7 (002) · 7.2, D-T10 (002)).
import { describe, expect, it } from 'vitest';
import { BUILDING_CELL, buildingScale } from './building';

describe('building', () => {
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
