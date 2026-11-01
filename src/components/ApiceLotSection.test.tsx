import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource, ListedApice } from '../data/apices';
import { expectBlocks } from '../testing/expectBlocks';
import { fakeClient } from '../testing/facilitationDoubles';
import { listed } from '../testing/listDoubles';
import { ApiceLotSection } from './ApiceLotSection';

const person: SessionState = { status: 'person', uid: 'u-beto', role: 'member', username: 'beto' };

const source: ApiceSource = {
  onApice(id, callback) {
    const n = Number(id.slice(1));
    const doc: ApiceDoc = {
      ...listed(n),
      version: 1,
      needs: '',
      offers: '',
      visibility: 'public',
      isArchived: false,
      authorUid: 'u-ana',
    };
    callback(doc);
    return () => {};
  },
};

function setup(items: readonly ListedApice[], session: SessionState = person, always = false) {
  const { client } = fakeClient({ editApice: () => ({ ok: true, version: 2 }) });
  const onSaved = vi.fn();
  const onEditingChange = vi.fn();
  const view = (list: readonly ListedApice[]) => (
    <SessionProvider initial={session}>
      <ApiceLotSection
        items={list}
        source={source}
        client={client}
        onSaved={onSaved}
        onEditingChange={onEditingChange}
        toolbar={<p>barra</p>}
        alwaysPanel={always}
      />
    </SessionProvider>
  );
  const result = render(view(items));
  return { ...result, onSaved, onEditingChange, rerender: (list: readonly ListedApice[]) => result.rerender(view(list)) };
}

const items = [listed(1), listed(2), listed(3)];
const panel = () => screen.queryByRole('complementary', { name: 'Ápice elegido' });

describe('ApiceLotSection', () => {
  it('RF-6 (005) · 6.6, RF-7 (005) · 7.1: elegir un edificio lo marca y lo muestra en el panel', async () => {
    const { container } = setup(items, { status: 'visitor' });
    expect(panel()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 2' }));
    expect(screen.getByRole('button', { name: 'Ápice 2' }).getAttribute('aria-pressed')).toBe('true');
    expect(panel()!.querySelector('h2')!.textContent).toBe('Ápice 2');
    expect(screen.getByText('barra')).toBeTruthy();
    expectBlocks(container);
  });

  it('RF-6 (005) · 6.9, D-T8 (005): con la lista vacía no hay lote, y la barra queda suelta', () => {
    const { container } = setup([]);
    expect(container.querySelector('.apice-lot')).toBeNull();
    expect(screen.getByText('barra')).toBeTruthy();
  });

  it('RF-7 (005) · 7.11, D-T7 (005): avisa cuando la edición rápida está a la vista', async () => {
    const { onEditingChange } = setup(items);
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 1' }));
    await waitFor(() => expect(onEditingChange).toHaveBeenLastCalledWith(true));
  });

  it('RF-7 (005) · 7.9: con cambios sin guardar, pide confirmar el descarte antes de cambiar de ápice', async () => {
    const { container } = setup(items);
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 1' }));
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'A medio escribir' } });
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 2' }));
    const notice = screen.getByRole('alert');
    expect(notice.textContent).toMatch(/cambios sin guardar/);
    expectBlocks(container);
    await userEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(panel()!.querySelector('h2')!.textContent).toBe('Editar ápice');
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ápice 1');
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe('A medio escribir');
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ápice 2');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RF-7 (005) · 7.8: al guardar, avisa los datos nuevos para el edificio y la fila', async () => {
    const { onSaved } = setup(items);
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 1' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo nombre' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('a1', expect.objectContaining({ name: 'Nuevo nombre' })));
  });

  it('RF-6 (005) · 6.8: si el ápice elegido sale de la lista, el panel se cierra', async () => {
    const { rerender } = setup(items, { status: 'visitor' });
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 3' }));
    rerender(items.slice(0, 2));
    expect(panel()).toBeNull();
  });

  it('RF-7 (005) · 7.12: con el panel siempre visible, muestra el primer ápice sin elegir ninguno', async () => {
    setup(items, { status: 'visitor' }, true);
    expect(panel()!.querySelector('h2')!.textContent).toBe('Ápice 1');
    expect(screen.getByRole('button', { name: 'Ápice 1' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 3' }));
    expect(panel()!.querySelector('h2')!.textContent).toBe('Ápice 3');
  });

  it('RF-7 (005) · 7.12: si el elegido sale de la lista, el panel pasa al primero', async () => {
    const { rerender } = setup(items, { status: 'visitor' }, true);
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 3' }));
    rerender([items[0]!, items[1]!]);
    expect(panel()!.querySelector('h2')!.textContent).toBe('Ápice 1');
  });

  it('RF-6 (005) · 6.12, RF-7 (005) · 7.13: sin ápices y con el panel siempre visible, hay lote vacío, filtros y panel con aviso', () => {
    const { container } = setup([], { status: 'visitor' }, true);
    expect(container.querySelector('.apice-lot-section__lot--empty')).not.toBeNull();
    expect(container.querySelector('.apice-lot-section__toolbar--floating')).not.toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(panel()!.textContent).toContain('Aún no hay ápices para mostrar.');
    expectBlocks(container);
  });
});
