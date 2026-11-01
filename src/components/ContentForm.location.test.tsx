import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDrafts, DraftsContext } from '../app/drafts';
import { ContentForm, EMPTY_VALUES } from './ContentForm';

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
