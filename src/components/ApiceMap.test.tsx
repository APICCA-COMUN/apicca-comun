import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Axis } from '../../shared/domain/apice';
import type { Location } from '../../shared/domain/location';
import type { MapMarker } from '../map/types';
import { expectBlocks } from '../testing/expectBlocks';

vi.mock('./MapView', () => ({
  MapView: (props: { markers: MapMarker[]; onSelect?: (id: string) => void }) => (
    <div data-testid="mapa" className="leaflet-container">
      {props.markers.map((m) => (
        <button key={m.id} type="button" data-axes={m.axes.join(' ')} onClick={() => props.onSelect?.(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  ),
}));

const { ApiceMap } = await import('./ApiceMap');

const at = (lat: number, lng: number, precision: Location['precision'] = 'exact'): Location => ({ lat, lng, precision });
const apice = (id: string, name: string, location: Location | null, axes: Axis[] = ['agua']) => ({ id, name, location, axes });

describe('ApiceMap', () => {
  it('RF-8 (002) · 8.3: cada marcador lleva los ejes de sus ápices, sin repetir y en el orden de AXES', () => {
    render(
      <ApiceMap
        apices={[
          apice('a', 'Huerta', at(1, 1), ['energía', 'agua']),
          apice('b', 'Cocina', at(1, 1), ['alimento', 'agua']),
          apice('c', 'Pozo', at(2, 2), ['agua']),
        ]}
      />,
    );
    const [shared, single] = screen.getAllByRole('button');
    expect(shared?.dataset['axes']).toBe('agua alimento energía');
    expect(single?.dataset['axes']).toBe('agua');
  });

  it('RF-21 (001): los ápices sin ubicación no llegan al mapa', () => {
    render(<ApiceMap apices={[apice('a', 'Huerta', at(1, 1)), apice('b', 'Sin sitio', null)]} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Sin sitio')).toBeNull();
  });

  it('RF-21 (001): los ápices en la misma ubicación comparten un marcador que los nombra', () => {
    render(<ApiceMap apices={[apice('a', 'Huerta', at(1, 1)), apice('b', 'Cocina', at(1, 1)), apice('c', 'Pozo', at(2, 2))]} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toContain('2 ápices');
    expect(buttons[0]?.textContent).toContain('Huerta');
    expect(buttons[0]?.textContent).toContain('Cocina');
  });

  it('RF-21 (001): un marcador solo llama a onSelect con el id del ápice', async () => {
    const onSelect = vi.fn();
    render(<ApiceMap apices={[apice('a', 'Huerta', at(1, 1))]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Huerta' }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('RF-21 (001): un marcador de grupo ofrece a cada ápice del grupo', async () => {
    const onSelect = vi.fn();
    render(<ApiceMap apices={[apice('a', 'Huerta', at(1, 1)), apice('b', 'Cocina', at(1, 1))]} onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    await userEvent.click(screen.getByRole('button', { name: 'Cocina' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('RF-21 (001): los aproximados de la misma zona se agrupan sin mezclarse con los exactos', () => {
    render(
      <ApiceMap
        apices={[apice('a', 'Uno', at(4.5, -74.1, 'approximate')), apice('b', 'Dos', at(4.5, -74.1, 'exact'))]}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('RF-21 (001): con más de 300 ápices pinta 300 y avisa del tope', () => {
    const many = Array.from({ length: 305 }, (_, i) => apice(`a${i}`, `Ápice ${i}`, at(i / 1000, i / 1000)));
    render(<ApiceMap apices={many} />);
    expect(screen.getAllByRole('button')).toHaveLength(300);
    expect(screen.getByRole('status').textContent).toContain('300');
  });

  it('RF-21 (001): con 300 o menos no hay aviso', () => {
    render(<ApiceMap apices={[apice('a', 'Huerta', at(1, 1))]} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('RF-6 (002) · 6.1: el aviso de tope de ápices lleva la clase «block»', () => {
    const many = Array.from({ length: 305 }, (_, i) => apice(`a${i}`, `Ápice ${i}`, at(i / 1000, i / 1000)));
    const { container } = render(<ApiceMap apices={many} />);
    expectBlocks(container);
  });

  it('RF-6 (002) · 6.1, 6.3: los botones de la lista de ápices en un grupo son bloques con acción secundaria', async () => {
    const { container } = render(
      <ApiceMap apices={[apice('a', 'Huerta', at(1, 1)), apice('b', 'Cocina', at(1, 1))]} />,
    );
    await userEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    expectBlocks(container);
    const itemButton = screen.getByRole('button', { name: 'Cocina' });
    expect(itemButton.classList.contains('block')).toBe(true);
    expect(itemButton.classList.contains('action-secondary')).toBe(true);
  });
});
