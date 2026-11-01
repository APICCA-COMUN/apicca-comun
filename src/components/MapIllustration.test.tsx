import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { MapIllustration } from './MapIllustration';

describe('MapIllustration', () => {
  it('RF-6 (008) · 6.7, RF-9 (003) · 9.3: el contenedor es una imagen con nombre accesible', () => {
    const { container } = render(<MapIllustration />);
    const map = container.firstElementChild as HTMLElement;
    expect(map.getAttribute('role')).toBe('img');
    expect(map.getAttribute('aria-label')).toBe('Mapa de ejemplo: seis ápices conectados por caminos y hebras');
  });

  it('RF-4 (005) · 4.2, D-T9 (005): seis edificios, dos pixelados sobre charcoal y cuatro con el ícono de un eje', () => {
    const { container } = render(<MapIllustration />);
    const buildings = [...container.querySelectorAll('.map-illustration__building')];
    expect(buildings).toHaveLength(6);
    const pixel = buildings.filter((building) => building.classList.contains('map-illustration__building--pixel'));
    expect(pixel).toHaveLength(2);
    for (const building of pixel) {
      // Una imagen de 8 × 8 dibujada con celdas, sin archivos.
      expect(building.querySelectorAll('.map-illustration__pixel')).toHaveLength(64);
      expect(building.querySelector('img')).toBeNull();
    }
    const axis = buildings.filter((building) => !pixel.includes(building));
    expect(axis).toHaveLength(4);
    for (const building of axis) {
      expect(AXES).toContain(building.getAttribute('data-axis'));
      expect(building.querySelector('svg.axis-icon')).not.toBeNull();
    }
  });

  it('RF-4 (005) · 4.2: los edificios van unidos por caminos y nodos', () => {
    const { container, getAllByTestId } = render(<MapIllustration />);
    expect(container.querySelectorAll('.map-illustration__roads path').length).toBeGreaterThanOrEqual(5);
    expect(getAllByTestId('node').length).toBeGreaterThanOrEqual(1);
  });

  it('RF-4 (005) · 4.3: dos hebras decorativas del color de un eje', () => {
    const { container } = render(<MapIllustration />);
    const strands = [...container.querySelectorAll('.map-illustration__strand')];
    expect(strands).toHaveLength(2);
    for (const strand of strands) {
      expect(strand.getAttribute('class')).toMatch(/map-illustration__strand--(agua|alimento|cobijo|energia|comunicacion)\b/);
      expect(strand.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('RF-9 (003) · 9.3, 9.4: la ilustración no lleva texto propio', () => {
    const { container } = render(<MapIllustration />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('a, button')).toBeNull();
  });
});
