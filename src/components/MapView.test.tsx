import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapMarker } from '../map/types';
import { MapView } from './MapView';
import { blockProblems, expectBlocks } from '../testing/expectBlocks';

const markers: MapMarker[] = [{ id: 'a1', lat: -33.45, lng: -70.66, label: 'Huerta del barrio', axes: ['agua'] }];

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../map/LeafletMap');
});

describe('MapView', () => {
  it('RF-21 (001): mientras el trozo del mapa se descarga avisa que está cargando', async () => {
    vi.doMock('../map/LeafletMap', () => new Promise(() => {}));
    const { MapView: Fresh } = await import('./MapView');
    render(<Fresh markers={markers} />);
    expect((await screen.findByRole('status')).textContent).toContain('Cargando el mapa');
  });

  it('RF-21 (001): una vez cargado el trozo pinta el mapa con los marcadores recibidos', async () => {
    const seen = vi.fn();
    vi.doMock('../map/LeafletMap', () => ({
      default: (props: { markers: MapMarker[] }) => {
        seen(props.markers);
        return <div data-testid="mapa-doble" />;
      },
    }));
    const { MapView: Fresh } = await import('./MapView');
    render(<Fresh markers={markers} />);
    expect(await screen.findByTestId('mapa-doble')).toBeTruthy();
    expect(seen).toHaveBeenCalledWith(markers);
  });

  it('RNF-10 (001): si el trozo no carga muestra «El mapa no cargó» y la lista de al lado sigue entera', async () => {
    vi.doMock('../map/LeafletMap', () => {
      throw new Error('ChunkLoadError');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { MapView: Fresh } = await import('./MapView');
    render(
      <div>
        <Fresh markers={markers} />
        <ul>
          <li>Huerta del barrio</li>
        </ul>
      </div>,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('El mapa no cargó');
    expect(screen.getByText('Huerta del barrio')).toBeTruthy();
    spy.mockRestore();
  });

  it('RNF-10 (001): si el mapa falla al pintarse, el aviso reemplaza solo al mapa', async () => {
    vi.doMock('../map/LeafletMap', () => ({
      default: () => {
        throw new Error('boom');
      },
    }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { MapView: Fresh } = await import('./MapView');
    render(
      <div>
        <p>Lista</p>
        <Fresh markers={markers} />
      </div>,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('El mapa no cargó');
    expect(screen.getByText('Lista')).toBeTruthy();
    spy.mockRestore();
  });

  it('RNF-2 (001): el mapa va en una región con nombre accesible', async () => {
    vi.doMock('../map/LeafletMap', () => ({ default: () => <div /> }));
    const { MapView: Fresh } = await import('./MapView');
    render(<Fresh markers={[]} />);
    expect(await screen.findByRole('region', { name: 'Mapa de ápices' })).toBeTruthy();
  });

  it('RF-21 (001): MapView se exporta como componente', () => {
    expect(typeof MapView).toBe('function');
    void userEvent;
  });
});

/** Estilos en línea con un tamaño escrito a mano (RF-2 (002) · 2.1, D-T20 (002)). */
const fixedSizes = (container: ParentNode): string[] =>
  [...container.querySelectorAll<HTMLElement>('[style]')]
    .filter((el) =>
      ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'font-size', 'padding', 'margin', 'top', 'left'].some(
        (property) => el.style.getPropertyValue(property) !== '',
      ),
    )
    .map((el) => el.outerHTML.slice(0, 80));

describe('MapView · bloques (002)', () => {
  it('RF-2 (002) · 2.1: la región del mapa no lleva estilo en línea (la altura mínima va en una clase)', async () => {
    vi.doMock('../map/LeafletMap', () => ({ default: () => <div /> }));
    const { MapView: Fresh } = await import('./MapView');
    const { container } = render(<Fresh markers={[]} />);
    await screen.findByRole('region', { name: 'Mapa de ápices' });
    expect(blockProblems(container).filter((p) => p.startsWith('color'))).toEqual([]);
    expect(fixedSizes(container)).toEqual([]);
  });

  it('RF-6 (002) · 6.1: el aviso de carga y el de fallo son bloques', async () => {
    vi.doMock('../map/LeafletMap', () => new Promise(() => {}));
    const { MapView: Fresh } = await import('./MapView');
    const loading = render(<Fresh markers={[]} />);
    await screen.findByRole('status');
    expectBlocks(loading.container);
    loading.unmount();
    vi.doMock('../map/LeafletMap', () => {
      throw new Error('ChunkLoadError');
    });
    vi.resetModules();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { MapView: Broken } = await import('./MapView');
    const failed = render(<Broken markers={[]} />);
    await screen.findByRole('alert');
    expectBlocks(failed.container);
    spy.mockRestore();
  });
});
