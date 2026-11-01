import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource } from '../data/apices';
import { expectBlocks } from '../testing/expectBlocks';
import { fakeClient } from '../testing/facilitationDoubles';
import { listed } from '../testing/listDoubles';
import { ApiceQuickPanel } from './ApiceQuickPanel';

const person: SessionState = { status: 'person', uid: 'u-beto', role: 'member', username: 'beto' };

const doc = (extra: Partial<ApiceDoc> = {}): ApiceDoc => ({
  id: 'a1',
  version: 2,
  name: 'Ápice 1',
  description: 'Descripción 1',
  axes: ['agua'],
  needs: 'Tejas',
  offers: 'Semillas',
  status: 'idea',
  visibility: 'public',
  isArchived: false,
  authorUid: 'u-ana',
  ...extra,
});

const sourceOf = (value: ApiceDoc | null): ApiceSource => ({
  onApice(_id, callback) {
    callback(value);
    return () => {};
  },
});

function setup(
  {
    session = person,
    stored = doc(),
    handlers = {},
  }: { session?: SessionState; stored?: ApiceDoc | null; handlers?: Parameters<typeof fakeClient>[0] } = {},
) {
  const { client, calls } = fakeClient(handlers);
  const onSaved = vi.fn();
  const onDirtyChange = vi.fn();
  const onEditingChange = vi.fn();
  const { container } = render(
    <SessionProvider initial={session}>
      <ApiceQuickPanel
        apice={listed(1)}
        source={sourceOf(stored)}
        client={client}
        onSaved={onSaved}
        onDirtyChange={onDirtyChange}
        onEditingChange={onEditingChange}
      />
    </SessionProvider>,
  );
  return { container, calls, onSaved, onDirtyChange, onEditingChange };
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

describe('ApiceQuickPanel', () => {
  it('RF-7 (005) · 7.1, 7.2, 7.10: sin sesión, solo la ficha resumida, como bloque, y el enlace a la ficha', () => {
    const { container, onEditingChange } = setup({ session: { status: 'visitor' } });
    const panel = screen.getByRole('complementary', { name: 'Ápice elegido' });
    expect(panel.classList.contains('block')).toBe(true);
    expect(within(panel).getByRole('heading', { name: 'Ápice 1' })).toBeTruthy();
    expect(within(panel).getByText('Descripción 1')).toBeTruthy();
    expect(within(panel).getByText('Agua')).toBeTruthy();
    expect(within(panel).getByText('idea')).toBeTruthy();
    expect(within(panel).getByRole('img', { name: 'Sin imagen' })).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Ver ficha' }).getAttribute('href')).toBe('/apices/a1');
    expect(within(panel).queryByRole('link', { name: 'Ver historial' })).toBeNull();
    expect(within(panel).queryByRole('textbox')).toBeNull();
    expect(onEditingChange).not.toHaveBeenCalledWith(true);
    expectBlocks(container);
  });

  it('RF-7 (005) · 7.10: con la cuenta suspendida, tampoco hay edición rápida', () => {
    setup({ session: { status: 'suspended', uid: 'u-beto' } });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
  });

  it('RF-7 (005) · 7.3: un ápice archivado no ofrece edición rápida', () => {
    setup({ stored: doc({ isArchived: true }) });
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
  });

  it('RF-7 (005) · 7.2, 7.3, 7.7: quien puede editar ve nombre, descripción, ejes con aria-pressed y estado, más los enlaces', () => {
    const { container, onEditingChange } = setup();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ápice 1');
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe('Descripción 1');
    const axes = within(screen.getByRole('group', { name: 'Ejes' })).getAllByRole('button');
    expect(axes.map((button) => [button.textContent, button.getAttribute('aria-pressed')])).toEqual([
      ['Agua', 'true'],
      ['Alimento', 'false'],
      ['Cobijo', 'false'],
      ['Energía', 'false'],
      ['Comunicación', 'false'],
    ]);
    const status = within(screen.getByRole('radiogroup', { name: 'Estado' })).getAllByRole('radio') as HTMLInputElement[];
    expect(status.map((radio) => [radio.value, radio.checked])).toEqual([
      ['idea', true],
      ['prototipo', false],
      ['en marcha', false],
    ]);
    expect(screen.getByRole('link', { name: 'Editar todo' }).getAttribute('href')).toBe('/apices/a1/editar');
    expect(screen.getByRole('link', { name: 'Ver historial' }).getAttribute('href')).toBe('/apices/a1/historial');
    expect(screen.getByRole('button', { name: 'Guardar cambios' }).classList.contains('action-primary')).toBe(true);
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    expectBlocks(container);
  });

  it('RF-7 (005) · 7.4, 7.8: guarda sobre la versión leída, conserva el resto y avisa los datos nuevos', async () => {
    const { calls, onSaved, onDirtyChange } = setup({ handlers: { editApice: () => ({ ok: true, version: 3 }) } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: '  Nueva  ' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Energía' }));
    await userEvent.click(screen.getByRole('radio', { name: 'prototipo' }));
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls).toEqual([
      {
        op: 'editApice',
        payload: {
          id: 'a1',
          baseVersion: 2,
          content: { name: 'Ápice 1', description: 'Nueva', axes: ['agua', 'energía'], needs: 'Tejas', offers: 'Semillas', status: 'prototipo' },
        },
      },
    ]);
    expect(onSaved).toHaveBeenCalledWith('a1', { name: 'Ápice 1', description: 'Nueva', axes: ['agua', 'energía'], status: 'prototipo' });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('RF-7 (005) · 7.5: si otra persona guardó antes, muestra el conflicto de la 001', async () => {
    const current = { version: 5, content: { name: 'Otro', description: 'Vigente', axes: ['agua' as const], needs: '', offers: '', status: 'idea' as const } };
    setup({ handlers: { editApice: () => ({ ok: false, conflict: true, current }) } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Mía' } });
    await save();
    expect(await screen.findByRole('button', { name: 'Conservar los míos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descartar/ })).toBeTruthy();
  });

  it('RF-7 (005) · 7.6: valida con las reglas y los mensajes de «Editar ápice»', async () => {
    const { calls } = setup({ handlers: { editApice: () => ({ ok: true, version: 3 }) } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '   ' } });
    await userEvent.click(screen.getByRole('button', { name: 'Agua' }));
    await save();
    expect(screen.getByText('Escribe el nombre del ápice.')).toBeTruthy();
    expect(screen.getByText('Elige al menos un eje.')).toBeTruthy();
    expect(screen.getByLabelText('Nombre').getAttribute('aria-invalid')).toBe('true');
    expect(calls).toHaveLength(0);
  });

  it('RF-7 (005) · 7.12: quien puede editar ve «Editar ápice», la imagen sobre charcoal y «Ver historial» junto a guardar', () => {
    const { container } = setup();
    const panel = screen.getByRole('complementary', { name: 'Ápice elegido' });
    expect(within(panel).getByRole('heading', { name: 'Editar ápice' })).toBeTruthy();
    expect(panel.querySelector('.apice-panel__image .pixel-image')).not.toBeNull();
    const actions = panel.querySelector('.apice-panel__actions')!;
    expect(within(actions as HTMLElement).getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
    expect(within(actions as HTMLElement).getByRole('link', { name: 'Ver historial' })).toBeTruthy();
    for (const button of within(screen.getByRole('group', { name: 'Ejes' })).getAllByRole('button')) {
      expect(button.querySelector('svg.axis-icon')?.getAttribute('aria-hidden')).toBe('true');
    }
    expectBlocks(container);
  });
});
