import { describe, expect, it } from 'vitest';
import { AXIS_ICONS } from '../../shared/domain/identity';
import { pinHtml, pinIconOptions } from './pinHtml';

describe('pin del mapa', () => {
  it('RF-8 (002) · 8.3, D-T9 (002): lleva un ícono de 12 px por eje, en el orden de AXES y sin repetir', () => {
    const html = pinHtml(['energía', 'agua', 'agua']);
    const icons = [...html.matchAll(/class="axis-icon axis-icon--([a-z]+)"/g)].map((match) => match[1]);
    expect(icons).toEqual(['agua', 'energia']);
    expect(html.match(/width="12" height="12"/g)).toHaveLength(2);
    expect(html).toContain(`d="${AXIS_ICONS.agua.d}"`);
    expect(html).toContain(`viewBox="${AXIS_ICONS.agua.viewBox}"`);
  });

  it('RF-8 (002) · 8.4: los íconos son decorativos; el nombre accesible va en el pin', () => {
    const html = pinHtml(['agua', 'alimento']);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(html).not.toContain('aria-label');
    expect(html).not.toContain('style=');
  });

  it('RF-8 (002) · 8.3, D-T9 (002): mide lo que dice pinSize y se ancla abajo al centro', () => {
    const one = pinIconOptions(['agua']);
    expect(one.iconSize).toEqual([20, 20]);
    expect(one.iconAnchor).toEqual([10, 20]);
    const five = pinIconOptions(['agua', 'alimento', 'cobijo', 'energía', 'comunicación']);
    expect(five.iconSize).toEqual([76, 20]);
    expect(five.iconAnchor).toEqual([38, 20]);
    expect(five.className).toBe('apicca-pin');
    expect(five.html).toBe(pinHtml(['agua', 'alimento', 'cobijo', 'energía', 'comunicación']));
  });

  it('RF-8 (002) · 8.3: sin ejes (el selector de ubicación) es un bloque vacío de 20 px', () => {
    const none = pinIconOptions([]);
    expect(none.iconSize).toEqual([20, 20]);
    expect(none.html).toBe('');
  });
});
