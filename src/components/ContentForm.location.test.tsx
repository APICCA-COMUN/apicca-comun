import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDrafts, DraftsContext } from '../app/drafts';
import type { ListSource } from '../data/apices';
import { listed } from '../testing/listDoubles';
import { ContentForm, EMPTY_VALUES } from './ContentForm';
import type { PointMapProps } from './LocationPicker';

const filled = { ...EMPTY_VALUES, name: 'Huerta', description: 'Cultivamos.', axes: ['alimento' as const] };

function renderForm(props: Partial<React.ComponentProps<typeof ContentForm>> = {}, withLocation = true) {
  const drafts = createDrafts();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <DraftsContext.Provider value={drafts}>
      <ContentForm
        initial={filled}
        draftKey="t"
        submitLabel="Guardar"
        onSubmit={onSubmit}
        {...(withLocation ? { location: { stored: null, map: null } } : {})}
        {...props}
      />
    </DraftsContext.Provider>,
  );
  return { drafts, onSubmit };
}

describe('ContentForm con ubicación', () => {
  it('RF-9 (001): sin la opción de ubicación el formulario no la muestra ni la envía', async () => {
    const { onSubmit } = renderForm({}, false);
    expect(screen.queryByRole('group', { name: 'Ubicación' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]).toHaveLength(1);
  });

  it('RF-9 (001): sin tocar la ubicación se envía «conservar»', async () => {
    const { onSubmit } = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Huerta' }), { mode: 'keep' });
  });

  it('RF-9 (001): coordenadas válidas se envían como números con su precisión', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-33.45' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-70.66' } });
    await userEvent.click(screen.getByRole('radio', { name: /Exacta/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), { mode: 'set', lat: -33.45, lng: -70.66, precision: 'exact' });
  });

  it('RF-9 (001): coordenadas fuera de rango no se envían y se dice por qué', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '0' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent).toContain('fuera de rango');
  });

  it('RF-9 (001): quitar la ubicación guardada se envía como «quitar»', async () => {
    const { onSubmit } = renderForm({ location: { stored: { lat: 1.005, lng: 2.005, precision: 'approximate' }, map: null } });
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), { mode: 'remove' });
  });

  it('RF-9 (001): la ubicación escrita se conserva como borrador', () => {
    const { drafts } = renderForm();
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '5' } });
    expect(drafts.get('t')).toContain('"lat":"5"');
  });
});

// T-18 (024) · RF-12 (024) · 12.1 a 12.3, D-T16 (024): el formulario lee las zonas de los ápices que la persona ve y las pasa al mapa.
describe('ContentForm con las zonas de los ápices visibles (RF-12 (024))', () => {
  function ZonesMap({ zones }: PointMapProps) {
    return <p data-testid="zonas">{zones === undefined ? 'sin zonas' : JSON.stringify(zones)}</p>;
  }
  const zoneOf = (lat: number, lng: number) => ({ cell: `c${lat}`, lat, lng });
  const near = (n: number, lat: number, lng: number, precision: 'approximate' | 'exact' = 'approximate') =>
    listed(n, { location: { lat: lat + 0.01, lng: lng + 0.01, precision, zone: zoneOf(lat, lng) } });

  it('RF-12 (024) · 12.1: las zonas de la primera tanda llegan al mapa al abrirlo', async () => {
    const zonesSource: ListSource = { fetchPage: async () => ({ items: [near(1, 4.6, -74.08), near(2, 6.24, -75.58)], cursor: null }) };
    renderForm({ location: { stored: null, map: ZonesMap, zonesSource } });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    await waitFor(() => expect(screen.getByTestId('zonas').textContent).toBe(JSON.stringify([{ lat: 4.6, lng: -74.08 }, { lat: 6.24, lng: -75.58 }])));
  });

  it('RF-12 (024) · 12.1, D-10 (024): el punto exacto de un ápice nunca llega al mapa, solo su zona', async () => {
    const zonesSource: ListSource = { fetchPage: async () => ({ items: [near(1, 4.6, -74.08, 'exact')], cursor: null }) };
    renderForm({ location: { stored: null, map: ZonesMap, zonesSource } });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    await waitFor(() => expect(screen.getByTestId('zonas').textContent).toBe(JSON.stringify([{ lat: 4.6, lng: -74.08 }])));
    expect(screen.getByTestId('zonas').textContent).not.toContain('4.61');
  });

  it('RF-12 (024): sin ápices con zona, el mapa recibe una lista vacía y el formulario se guarda como siempre', async () => {
    const zonesSource: ListSource = { fetchPage: async () => ({ items: [listed(1)], cursor: null }) };
    const { onSubmit } = renderForm({ location: { stored: null, map: ZonesMap, zonesSource } });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    await waitFor(() => expect(screen.getByTestId('zonas').textContent).toBe('[]'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), { mode: 'keep' });
  });

  it('RF-12 (024): si no hay mapa (`map: null`), el formulario no lee ninguna lista', async () => {
    const fetchPage = vi.fn(async () => ({ items: [], cursor: null }));
    const zonesSource: ListSource = { fetchPage };
    renderForm({ location: { stored: null, map: null, zonesSource } });
    await new Promise((done) => setTimeout(done, 20));
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
