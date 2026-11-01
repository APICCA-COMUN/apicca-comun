// Pruebas de tamaño, orden de ejes y nombre accesible del pin del mapa (RF-8 (002) · 8.3, RF-8 (002) · 8.4, D-T9 (002)).
import { describe, expect, it } from 'vitest';
import { AXES } from '../apice';
import { pinAccessibleName, pinSize, sortAxes } from './pin';

describe('pin', () => {
  it('RF-8 (002) · 8.3: pinSize calcula 20x20 con un eje y 76x20 con cinco ejes', () => {
    expect(pinSize(['agua'])).toEqual({ width: 20, height: 20 });
    expect(pinSize(AXES)).toEqual({ width: 76, height: 20 });
  });

  it('RF-8 (002) · 8.3: pinSize usa mínimo un eje cuando llega vacío o con duplicados', () => {
    expect(pinSize([])).toEqual({ width: 20, height: 20 });
    expect(pinSize(['agua', 'agua'])).toEqual({ width: 20, height: 20 });
    expect(pinSize(['agua', 'alimento'])).toEqual({ width: 34, height: 20 });
  });

  it('RF-8 (002) · 8.3: sortAxes elimina duplicados y conserva el orden canónico de AXES', () => {
    expect(sortAxes(['alimento', 'agua'])).toEqual(['agua', 'alimento']);
    expect(sortAxes(['comunicación', 'agua', 'comunicación'])).toEqual(['agua', 'comunicación']);
    expect(sortAxes([])).toEqual([]);
    expect(sortAxes(['energía', 'cobijo', 'alimento', 'agua', 'comunicación'])).toEqual([...AXES]);
  });

  it('RF-8 (002) · 8.4: pinAccessibleName compone nombre y ejes en orden canónico aunque lleguen desordenados', () => {
    expect(pinAccessibleName('Huerta del barrio', ['alimento', 'agua'])).toBe('Huerta del barrio: agua, alimento');
    expect(pinAccessibleName('Huerta del barrio', ['alimento', 'agua', 'alimento'])).toBe('Huerta del barrio: agua, alimento');
    expect(pinAccessibleName('Red comunitaria', ['comunicación'])).toBe('Red comunitaria: comunicación');
  });

  it('RF-8 (002) · 8.4: pinAccessibleName devuelve solo el nombre cuando no hay ejes', () => {
    expect(pinAccessibleName('Huerta del barrio', [])).toBe('Huerta del barrio');
  });
});
