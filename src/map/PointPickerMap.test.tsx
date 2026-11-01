import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PointPickerMap from './PointPickerMap';

describe('PointPickerMap', () => {
  it('RF-9 (001): sin punto no pinta marcador y con punto pinta uno, y se reemplaza al cambiarlo', () => {
    const { container, rerender } = render(<PointPickerMap point={null} onPick={vi.fn()} />);
    expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(0);
    rerender(<PointPickerMap point={{ lat: -33.45, lng: -70.66 }} onPick={vi.fn()} />);
    expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);
    rerender(<PointPickerMap point={{ lat: -33.5, lng: -70.7 }} onPick={vi.fn()} />);
    expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);
  });

  it('RF-9 (001): muestra la atribución del proveedor de teselas', () => {
    const { container } = render(<PointPickerMap point={null} onPick={vi.fn()} />);
    expect(container.querySelector('.leaflet-control-attribution')?.innerHTML).toContain('OpenStreetMap');
  });

  it('RF-8 (002) · 8.3, RF-6 (002) · 6.1, RF-2 (002) · 2.1, D-T9 (002): usa clases y no style; el punto es el pin propio y el zoom, un bloque', () => {
    const { container } = render(<PointPickerMap point={{ lat: -33.45, lng: -70.66 }} onPick={vi.fn()} />);
    const host = container.querySelector<HTMLElement>('.leaflet-container')!;
    expect(host.classList.contains('apicca-map')).toBe(true);
    expect(host.classList.contains('apicca-map--picker')).toBe(true);
    expect(host.getAttribute('style') ?? '').not.toMatch(/height|width|color|background/);
    const pin = container.querySelector<HTMLElement>('.leaflet-marker-icon')!;
    expect(pin.classList.contains('apicca-pin')).toBe(true);
    expect(pin.style.width).toBe('20px');
    expect(container.querySelector('.leaflet-control-zoom')!.classList.contains('block')).toBe(true);
  });
});
