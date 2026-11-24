// T-18 (024) · RF-12 (024) · 12.1 a 12.3, D-T16 (024): sin punto, el mapa abre sobre las zonas de los ápices que la persona ve.
import L from 'leaflet';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('PointPickerMap · zonas (RF-12 (024))', () => {
  const bogota = { lat: 4.597156, lng: -74.08474 };
  const medellin = { lat: 6.243305, lng: -75.585547 };

  afterEach(() => vi.restoreAllMocks());

  /**
   * Espía las dos formas de mover la vista y deja pasar la llamada real. Leaflet llama a `setView` al crear el mapa (con la
   * vista de siempre o con el punto): esa primera llamada no cuenta como un encuadre, y `moves()` la deja fuera.
   */
  function spies() {
    const setView = vi.spyOn(L.Map.prototype, 'setView');
    const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
    const made = vi.spyOn(L, 'map');
    const moves = () => setView.mock.calls.slice(1);
    return { moves, fitBounds, instance: () => made.mock.results[0]!.value as L.Map };
  }

  it('RF-12 (024) · 12.1: con una zona y sin punto, abre centrado en ella al zoom de una celda', () => {
    const { moves, fitBounds } = spies();
    render(<PointPickerMap point={null} zones={[bogota]} onPick={vi.fn()} />);
    expect(fitBounds).not.toHaveBeenCalled();
    expect(moves()).toHaveLength(1);
    expect(moves()[0]![0]).toEqual([bogota.lat, bogota.lng]);
    expect(moves()[0]![1]).toBe(13);
  });

  it('RF-12 (024) · 12.1: con varias zonas y sin punto, encuadra la caja que las envuelve sin pasar del zoom 13', () => {
    const { fitBounds } = spies();
    render(<PointPickerMap point={null} zones={[bogota, medellin]} onPick={vi.fn()} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
    const bounds = L.latLngBounds(fitBounds.mock.calls[0]![0] as L.LatLngBoundsLiteral);
    expect(bounds.getSouth()).toBe(bogota.lat);
    expect(bounds.getNorth()).toBe(medellin.lat);
    expect(bounds.getWest()).toBe(medellin.lng);
    expect(bounds.getEast()).toBe(bogota.lng);
    expect(fitBounds.mock.calls[0]![1]).toMatchObject({ maxZoom: 13 });
  });

  it('RF-12 (024): con un punto, abre como hoy sobre él y no usa las zonas', () => {
    const { moves, fitBounds } = spies();
    render(<PointPickerMap point={{ lat: -33.45, lng: -70.66 }} zones={[bogota, medellin]} onPick={vi.fn()} />);
    expect(moves()).toHaveLength(0);
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it('RF-12 (024): sin zonas, o con una lista vacía, abre como hoy', () => {
    const { moves, fitBounds } = spies();
    const { rerender } = render(<PointPickerMap point={null} onPick={vi.fn()} />);
    rerender(<PointPickerMap point={null} zones={[]} onPick={vi.fn()} />);
    expect(moves()).toHaveLength(0);
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it('RF-12 (024): si las zonas llegan después de crear el mapa, encuadra una sola vez', () => {
    const { moves, fitBounds } = spies();
    const { rerender } = render(<PointPickerMap point={null} onPick={vi.fn()} />);
    rerender(<PointPickerMap point={null} zones={[bogota, medellin]} onPick={vi.fn()} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
    rerender(<PointPickerMap point={null} zones={[bogota, medellin, { lat: 3.4, lng: -76.5 }]} onPick={vi.fn()} />);
    rerender(<PointPickerMap point={null} zones={[bogota]} onPick={vi.fn()} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
    // `fitBounds` mueve la vista con un solo `setView`; ninguna zona nueva la mueve otra vez.
    expect(moves()).toHaveLength(1);
  });

  it('RF-12 (024): no vuelve a encuadrar tras mover el mapa', () => {
    const { moves, fitBounds, instance } = spies();
    const { rerender } = render(<PointPickerMap point={null} onPick={vi.fn()} />);
    instance().fire('dragstart');
    rerender(<PointPickerMap point={null} zones={[bogota, medellin]} onPick={vi.fn()} />);
    expect(fitBounds).not.toHaveBeenCalled();
    expect(moves()).toHaveLength(0);
  });

  it('RF-12 (024): si la persona marcó un punto y luego lo quitó, las zonas que lleguen no mueven el mapa', () => {
    const { moves, fitBounds } = spies();
    const { rerender } = render(<PointPickerMap point={{ lat: -33.45, lng: -70.66 }} onPick={vi.fn()} />);
    rerender(<PointPickerMap point={null} zones={[bogota, medellin]} onPick={vi.fn()} />);
    expect(fitBounds).not.toHaveBeenCalled();
    expect(moves()).toHaveLength(0);
  });

  it('RF-12 (024) · 12.1: el encuadre propio no cuenta como que la persona movió el mapa', () => {
    const { fitBounds } = spies();
    const { rerender } = render(<PointPickerMap point={null} zones={[bogota]} onPick={vi.fn()} />);
    rerender(<PointPickerMap point={null} zones={[bogota, medellin]} onPick={vi.fn()} />);
    expect(fitBounds).not.toHaveBeenCalled();
  });
});
