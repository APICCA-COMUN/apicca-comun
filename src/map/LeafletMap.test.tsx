import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LeafletMap from './LeafletMap';
import { TILE_ATTRIBUTION } from './tiles';
import type { MapMarker } from './types';

const markers: MapMarker[] = [
  { id: 'a1', lat: -33.45, lng: -70.66, label: 'Huerta del barrio', axes: ['alimento', 'agua'] },
  { id: 'a2', lat: -33.5, lng: -70.7, label: 'Pozo común', axes: ['agua'] },
];

describe('LeafletMap', () => {
  it('RF-21 (001): pinta un marcador por cada punto recibido, con su nombre accesible', () => {
    const { container } = render(<LeafletMap markers={markers} />);
    const pins = container.querySelectorAll('.leaflet-marker-icon');
    expect(pins).toHaveLength(2);
    expect(pins[0]?.getAttribute('aria-label')).toBe('Huerta del barrio: agua, alimento');
  });

  it('RF-21 (001): muestra la atribución del proveedor de teselas', () => {
    const { container } = render(<LeafletMap markers={markers} />);
    expect(container.querySelector('.leaflet-control-attribution')?.innerHTML).toContain('OpenStreetMap');
    expect(TILE_ATTRIBUTION).toContain('OpenStreetMap');
  });

  it('RNF-2 (001): los marcadores se alcanzan con el teclado y Enter los selecciona', async () => {
    const onSelect = vi.fn();
    const { container } = render(<LeafletMap markers={markers} onSelect={onSelect} />);
    const pin = container.querySelector<HTMLElement>('.leaflet-marker-icon');
    expect(pin?.tabIndex).toBe(0);
    pin?.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('a1');
  });

  it('RF-21 (001): al cambiar los puntos, los marcadores se reemplazan sin duplicarse', () => {
    const { container, rerender } = render(<LeafletMap markers={markers} />);
    rerender(<LeafletMap markers={markers.slice(0, 1)} />);
    expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);
  });

  it('RF-21 (001): al desmontarse libera el mapa', () => {
    const { container, unmount } = render(<LeafletMap markers={markers} />);
    unmount();
    expect(container.querySelector('.leaflet-container')).toBeNull();
  });

  it('RF-21 (001): sin puntos pinta el mapa con la vista por defecto', () => {
    const { container } = render(<LeafletMap markers={[]} />);
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(0);
  });

  it('RF-8 (002) · 8.3, 8.4, D-T9 (002): el pin es el bloque propio, con los íconos de sus ejes y su nombre accesible', () => {
    const { container } = render(<LeafletMap markers={markers} />);
    const pin = container.querySelector<HTMLElement>('.leaflet-marker-icon')!;
    expect(pin.classList.contains('apicca-pin')).toBe(true);
    expect([...pin.querySelectorAll('.axis-icon')].map((icon) => icon.getAttribute('class'))).toEqual([
      'axis-icon axis-icon--agua',
      'axis-icon axis-icon--alimento',
    ]);
    expect(pin.style.width).toBe('34px');
    expect(pin.style.height).toBe('20px');
    expect(pin.style.marginLeft).toBe('-17px');
    expect(pin.style.marginTop).toBe('-20px');
    expect(screen.getByRole('button', { name: 'Pozo común: agua' })).toBeTruthy();
  });

  it('RF-6 (002) · 6.1, RF-2 (002) · 2.1, D-T9 (002): el contenedor usa clases, sin style, y los controles de zoom son un bloque', () => {
    const { container } = render(<LeafletMap markers={markers} />);
    const host = container.querySelector<HTMLElement>('.leaflet-container')!;
    expect(host.classList.contains('apicca-map')).toBe(true);
    expect(host.getAttribute('style') ?? '').not.toMatch(/height|width|color|background/);
    expect(container.querySelector('.leaflet-control-zoom')!.classList.contains('block')).toBe(true);
  });
});
