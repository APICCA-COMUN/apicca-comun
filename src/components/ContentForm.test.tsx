import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDrafts, DraftsContext } from '../app/drafts';
import { ApiClientError } from '../data/api';
import { expectBlocks } from '../testing/expectBlocks';
import { ContentForm, EMPTY_VALUES, type FormValues } from './ContentForm';

function renderForm(props: Partial<React.ComponentProps<typeof ContentForm>> = {}) {
  const drafts = createDrafts();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <DraftsContext.Provider value={drafts}>
      <ContentForm initial={EMPTY_VALUES} draftKey="t" submitLabel="Guardar" onSubmit={onSubmit} {...props} />
    </DraftsContext.Provider>,
  );
  return { drafts, onSubmit };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ContentForm', () => {
  it('RF-6 (001): ofrece nombre, descripción, ejes, necesidades y aportes', () => {
    renderForm();
    for (const label of ['Nombre', 'Descripción', 'Necesidades', 'Aportes']) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Ejes' })).toBeTruthy();
    expect(screen.queryByLabelText('Estado')).toBeNull();
  });

  it('RF-6 (001): enviar vacío no llama a onSubmit y dice qué falta', async () => {
    const { onSubmit } = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe el nombre del ápice.')).toBeTruthy();
    expect(screen.getByText('Escribe la descripción del ápice.')).toBeTruthy();
    expect(screen.getByText('Elige al menos un eje.')).toBeTruthy();
  });

  it('RF-7 (001): un texto que se pasa del límite dice cuántos caracteres sobran y no se envía', async () => {
    const { onSubmit } = renderForm();
    type('Nombre', 'a'.repeat(121));
    expect(screen.getByText('Sobra 1 carácter.')).toBeTruthy();
    expect(screen.getByText('121 / 120')).toBeTruthy();
    type('Descripción', 'd'.repeat(10_003));
    expect(screen.getByText('Sobran 3 caracteres.')).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Agua' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('RF-7 (001): en el límite exacto no sobra nada', () => {
    renderForm();
    type('Nombre', 'a'.repeat(120));
    expect(screen.getByText('120 / 120')).toBeTruthy();
    expect(screen.queryByText(/Sobra/)).toBeNull();
  });

  it('RF-6 (001): al quitar el único eje se rechaza el envío', async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();
    type('Nombre', 'Huerta');
    type('Descripción', 'Una huerta común');
    await user.click(screen.getByRole('checkbox', { name: 'Alimento' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alimento' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Elige al menos un eje.')).toBeTruthy();
  });

  it('RF-7 (001): un contenido válido se envía recortado y con los ejes en orden', async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();
    type('Nombre', '  Huerta  ');
    type('Descripción', 'Una huerta\ncomún');
    await user.click(screen.getByRole('checkbox', { name: 'Energía' }));
    await user.click(screen.getByRole('checkbox', { name: 'Agua' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Huerta',
      description: 'Una huerta\ncomún',
      axes: ['agua', 'energía'],
      needs: '',
      offers: '',
      status: 'idea',
    });
  });

  it('RF-8 (001): con showStatus ofrece el estado y lo envía', async () => {
    const initial: FormValues = { ...EMPTY_VALUES, name: 'A', description: 'B', axes: ['agua'] };
    const { onSubmit } = renderForm({ initial, showStatus: true });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Estado'), 'prototipo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: 'prototipo' })));
  });

  it('RF-7 (001): el texto se trata como texto plano, sin interpretar marcas', () => {
    renderForm({ initial: { ...EMPTY_VALUES, name: '<b>negrita</b>' } });
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('<b>negrita</b>');
    expect(document.querySelector('b')).toBeNull();
  });

  it('RNF-10 (001): si el guardado falla, muestra el error y conserva lo escrito', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('sin red'));
    renderForm({ onSubmit, initial: { ...EMPTY_VALUES, name: 'Huerta', description: 'D', axes: ['agua'] } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/No pudimos guardar/);
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Huerta');
  });

  it('RNF-10 (001): un error tipificado del servidor muestra su mensaje en español', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiClientError('account-suspended'));
    renderForm({ onSubmit, initial: { ...EMPTY_VALUES, name: 'H', description: 'D', axes: ['agua'] } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/suspend/i);
  });

  it('RNF-10 (001): lo escrito queda como borrador y un formulario nuevo con la misma clave lo recupera', () => {
    const drafts = createDrafts();
    const view = render(
      <DraftsContext.Provider value={drafts}>
        <ContentForm initial={EMPTY_VALUES} draftKey="k" submitLabel="Guardar" onSubmit={vi.fn()} />
      </DraftsContext.Provider>,
    );
    type('Nombre', 'Huerta común');
    view.unmount();
    render(
      <DraftsContext.Provider value={drafts}>
        <ContentForm initial={EMPTY_VALUES} draftKey="k" submitLabel="Guardar" onSubmit={vi.fn()} />
      </DraftsContext.Provider>,
    );
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Huerta común');
  });

  it('RF-6 (002) · 6.1, 6.3: campos y avisos son bloques y «Guardar» es la acción principal, con su etiqueta', async () => {
    renderForm({ onSubmit: vi.fn().mockRejectedValue(new Error('caída')), initial: { ...EMPTY_VALUES, name: 'Huerta', description: 'D', axes: ['agua'] } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Guardar' }).className).toBe('block action-primary');
    expectBlocks(document.body);
  });

  it('RF-5 (003) · 5.2; RF-17 (003) · 17.1: cada campo tiene su etiqueta visible encima, asociada con for/id', () => {
    renderForm({ showStatus: true });
    for (const name of ['Nombre', 'Descripción', 'Necesidades', 'Aportes', 'Estado']) {
      const control = screen.getByLabelText(name);
      const label = document.querySelector(`label[for="${control.id}"]`);
      expect(label, name).not.toBeNull();
      expect(label?.textContent).toBe(name);
      expect((label?.compareDocumentPosition(control) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING, name).toBeTruthy();
    }
  });

  it('RF-5 (003) · 5.3: un campo con error lleva aria-invalid y el texto del error, descrito por aria-describedby', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const expected: Array<[string, string]> = [['Nombre', 'Escribe el nombre del ápice.'], ['Descripción', 'Escribe la descripción del ápice.']];
    for (const [name, text] of expected) {
      const control = screen.getByLabelText(name);
      expect(control.getAttribute('aria-invalid'), name).toBe('true');
      const described = document.getElementById(control.getAttribute('aria-describedby') ?? '');
      expect(described?.textContent, name).toBe(text);
    }
    expect(screen.getByLabelText('Necesidades').getAttribute('aria-invalid')).toBe('false');
  });
});
