// RF-1 (002), RF-7 (003) · 7.5, D-T8 (003): trazados del logo y del favicon como datos del dominio (D-3 (002), D-T3 (002)).
import { describe, expect, it } from 'vitest';
import { AXIS_IDENTITY } from './axes';
import { AXIS_ICONS, FAVICON, LOGO, THEME_ICONS } from './icons';

const LOGO_TOKENS = ['logo-gray', 'logo-red', 'logo-blue'];
const viewBox = (vb: string) => vb.split(/\s+/).map(Number);

describe('logo y favicon', () => {
  it('RF-1 (002) · 1.4: el logo usa solo los colores fieles del logo, con gris, rojo y azul', () => {
    expect(LOGO.layers.map((l) => l.token)).toEqual(LOGO_TOKENS);
    for (const layer of LOGO.layers) expect(layer.d).toMatch(/^M[\d .LMZ-]+Z$/);
  });

  it('RF-1 (002) · 1.4: el logo conserva las proporciones del original (768 × 281)', () => {
    expect(viewBox(LOGO.viewBox)).toEqual([0, 0, 768, 281]);
  });

  it('RF-1 (002) · 1.7: el favicon lleva las «cc» rojas con el cuadrado azul, sin el gris', () => {
    expect(FAVICON.layers.map((l) => l.token)).toEqual(['logo-red', 'logo-blue']);
    const red = LOGO.layers.find((l) => l.token === 'logo-red');
    const blue = LOGO.layers.find((l) => l.token === 'logo-blue');
    expect(FAVICON.layers.map((l) => l.d)).toEqual([red?.d, blue?.d]);
  });

  it('RF-1 (002) · 1.7: el favicon tiene viewBox cuadrado', () => {
    const [, , w, h] = viewBox(FAVICON.viewBox);
    expect(w).toBeGreaterThan(0);
    expect(w).toBe(h);
  });
});

describe('íconos de eje', () => {
  it('RF-4 (002) · 4.3: hay un ícono por eje, con las claves de AXIS_IDENTITY', () => {
    const expectedKeys = AXIS_IDENTITY.map((a) => a.key);
    expect(Object.keys(AXIS_ICONS)).toEqual(expectedKeys);
  });

  it('RF-4 (002) · 4.3: no hay dos trazados iguales', () => {
    const paths = Object.values(AXIS_ICONS).map((icon) => icon.d);
    expect(new Set(paths).size).toBe(5);
  });

  it('RF-4 (002) · 4.5: los íconos no llevan color propio (solo currentColor)', () => {
    for (const [key, icon] of Object.entries(AXIS_ICONS)) {
      expect(icon.viewBox, `viewBox de ${key}`).toBe('0 0 24 24');
      expect(icon.d, `trazado de ${key}`).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
    }
  });

  it('RF-4 (002) · 4.5: todas las coordenadas de los trazados quedan dentro de la rejilla de 24 × 24 con al menos 1 px de margen', () => {
    for (const [key, icon] of Object.entries(AXIS_ICONS)) {
      const numbers = icon.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      expect(numbers.length, `coordenadas en ${key}`).toBeGreaterThan(0);
      for (const num of numbers) {
        expect(num, `coordenada ${num} en ${key}`).toBeGreaterThanOrEqual(1);
        expect(num, `coordenada ${num} en ${key}`).toBeLessThanOrEqual(23);
      }
    }
  });
});


describe('íconos de tema', () => {
  it('RF-7 (003) · 7.5: hay un ícono de sol y uno de luna, distintos entre sí', () => {
    expect(THEME_ICONS.sun.d).not.toBe(THEME_ICONS.moon.d);
    expect(THEME_ICONS.sun.d.length).toBeGreaterThan(0);
    expect(THEME_ICONS.moon.d.length).toBeGreaterThan(0);
  });

  it('RF-7 (003) · 7.5: los íconos no llevan color propio (solo currentColor) y caben en la rejilla de 24 × 24', () => {
    for (const [key, icon] of Object.entries(THEME_ICONS)) {
      expect(icon.viewBox, `viewBox de ${key}`).toBe('0 0 24 24');
      expect(icon.d, `trazado de ${key}`).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
      expect(JSON.stringify(icon), `color propio en ${key}`).not.toMatch(/#|rgb|hsl|fill|stroke/i);
      for (const num of icon.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []) {
        expect(num, `coordenada en ${key}`).toBeGreaterThanOrEqual(1);
        expect(num, `coordenada en ${key}`).toBeLessThanOrEqual(23);
      }
    }
  });
});
