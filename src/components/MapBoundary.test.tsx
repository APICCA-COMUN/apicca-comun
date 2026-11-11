import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { MapBoundary } from './MapBoundary';

function Broken(): never {
  throw new Error('mapa roto');
}

afterEach(() => vi.restoreAllMocks());

describe('MapBoundary', () => {
  it('RF-4 (021) · 4.5, RNF-10 (001): si el mapa falla, muestra el aviso y la lista que se le dio de respaldo', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <MapBoundary fallback={<ul aria-label="Ápices"><li>Huerta</li></ul>}>
        <Broken />
      </MapBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toBe('El mapa no cargó. La lista sigue disponible.');
    expect(screen.getByRole('list', { name: 'Ápices' }).textContent).toBe('Huerta');
    expectBlocks(container);
  });

  it('RF-4 (021) · 4.5, RF-10 (021) · 10.2: mientras el mapa funciona, se ve el mapa y no la lista de respaldo', () => {
    render(
      <MapBoundary fallback={<ul aria-label="Ápices" />}>
        <section aria-label="Mapa de ápices" />
      </MapBoundary>,
    );
    expect(screen.getByRole('region', { name: 'Mapa de ápices' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Ápices' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RNF-10 (001): el fallo del mapa no tumba lo que está a su lado', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <MapBoundary>
          <Broken />
        </MapBoundary>
        <p>Panel del ápice</p>
      </>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Panel del ápice')).toBeTruthy();
  });
});
