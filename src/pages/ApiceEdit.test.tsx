import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDrafts, DraftsContext } from '../app/drafts';
import { SessionProvider, type SessionState } from '../app/session';
import { ApiClientError } from '../data/api';
import type { ApiceDoc, ApiceSource } from '../data/apices';
import { fakeClient } from '../testing/facilitationDoubles';
import { ApiceEdit } from './ApiceEdit';

const person: SessionState = { status: 'person', uid: 'u-beto', role: 'member', username: 'beto' };

const apice = (extra: Partial<ApiceDoc> = {}): ApiceDoc => ({
  id: 'a1',
  version: 2,
  name: 'Huerta',
  description: 'Vigente',
  axes: ['alimento'],
  needs: '',
  offers: '',
  status: 'idea',
  visibility: 'private',
  isArchived: false,
  authorUid: 'u-ana',
  ...extra,
});

function fakeSource(initial: ApiceDoc | null) {
  let current = initial;
  const listeners = new Set<(value: ApiceDoc | null) => void>();
  const source: ApiceSource = {
    onApice(_id, callback) {
      listeners.add(callback);
      callback(current);
      return () => listeners.delete(callback);
    },
  };
  return {
    source,
    push(next: ApiceDoc | null) {
      current = next;
      for (const listener of listeners) listener(next);
    },
  };
}

function setup(doc: ApiceDoc | null, handlers: Parameters<typeof fakeClient>[0] = {}, session: SessionState = person) {
  const { client, calls } = fakeClient(handlers);
  const drafts = createDrafts();
  const src = fakeSource(doc);
  render(
    <SessionProvider initial={session}>
      <DraftsContext.Provider value={drafts}>
        <ApiceEdit id="a1" source={src.source} client={client} />
      </DraftsContext.Provider>
    </SessionProvider>,
  );
  return { calls, drafts, ...src };
}

const edit = (value: string) => fireEvent.change(screen.getByLabelText('Descripción'), { target: { value } });
const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

describe('ApiceEdit', () => {
  it('RF-10 (001): muestra la ficha vigente, la edita y guarda con la versión que abrió', async () => {
    const { calls, drafts } = setup(apice(), { editApice: () => ({ ok: true, version: 3 }) });
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Huerta');
    edit('Nueva descripción');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'prototipo');
    await save();
    await waitFor(() => expect(window.location.pathname).toBe('/apices/a1'));
    expect(calls).toEqual([
      {
        op: 'editApice',
        payload: {
          id: 'a1',
          baseVersion: 2,
          content: { name: 'Huerta', description: 'Nueva descripción', axes: ['alimento'], needs: '', offers: '', status: 'prototipo' },
        },
      },
    ]);
    expect(drafts.get('apice:a1')).toBeUndefined();
  });

  it('RF-10 (001): cualquier cuenta activa edita un ápice ajeno', () => {
    setup(apice({ authorUid: 'u-otra' }));
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
  });

  it('RF-14 (001): un ápice archivado no se puede editar', () => {
    setup(apice({ isArchived: true, authorUid: 'u-beto' }));
    expect(screen.queryByLabelText('Nombre')).toBeNull();
    expect(screen.getByText(/archivado/i)).toBeTruthy();
  });

  it('RF-10 (001): un ápice que no existe o no se puede leer dice que no se encontró', () => {
    setup(null);
    expect(screen.getByText('No se encontró el ápice.')).toBeTruthy();
  });

  it('RF-10 (001): un visitante es enviado a entrar', () => {
    setup(apice(), {}, { status: 'visitor' });
    expect(screen.queryByLabelText('Nombre')).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeTruthy();
  });

  it('RNF-10 (001): con la red caída el texto sigue en el formulario y se puede reintentar', async () => {
    let attempts = 0;
    const { calls } = setup(apice(), {
      editApice: () => {
        attempts += 1;
        if (attempts === 1) throw new Error('sin red');
        return { ok: true, version: 3 };
      },
    });
    edit('Escrito sin red');
    await save();
    expect((await screen.findByRole('alert')).textContent).toMatch(/No pudimos guardar/);
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe('Escrito sin red');
    await save();
    await waitFor(() => expect(window.location.pathname).toBe('/apices/a1'));
    expect(calls).toHaveLength(2);
  });

  it('RNF-10 (001): un error tipificado del servidor muestra su mensaje', async () => {
    setup(apice(), {
      editApice: () => {
        throw new ApiClientError('apice-archived');
      },
    });
    edit('Otra');
    await save();
    expect((await screen.findByRole('alert')).textContent).toMatch(/archivado/);
  });

  it('RF-11 (001): si alguien guardó antes, muestra el conflicto con lo vigente y lo propio', async () => {
    const vigente = { version: 3, content: { ...apice(), description: 'De otra persona' } };
    setup(apice(), { editApice: () => ({ ok: false, conflict: true, current: vigente }) });
    edit('Mía');
    await save();
    expect((await screen.findByRole('alert')).textContent).toMatch(/alguien más guardó cambios/i);
    const group = screen.getByRole('group', { name: 'Descripción' });
    expect(group.textContent).toContain('De otra persona');
    expect(group.textContent).toContain('Mía');
    expect(screen.queryByLabelText('Nombre')).toBeNull();
  });

  it('RF-11 (001): «Conservar los míos» reenvía mis cambios con la versión vigente', async () => {
    const vigente = { version: 3, content: { ...apice(), description: 'De otra persona' } };
    let n = 0;
    const { calls } = setup(apice(), {
      editApice: () => (++n === 1 ? { ok: false, conflict: true, current: vigente } : { ok: true, version: 4 }),
    });
    edit('Mía');
    await save();
    await userEvent.click(await screen.findByRole('button', { name: 'Conservar los míos' }));
    await waitFor(() => expect(window.location.pathname).toBe('/apices/a1'));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({
      op: 'editApice',
      payload: {
        id: 'a1',
        baseVersion: 3,
        content: { name: 'Huerta', description: 'Mía', axes: ['alimento'], needs: '', offers: '', status: 'idea' },
      },
    });
  });

  it('RF-11 (001): «Descartar» muestra el contenido vigente en el formulario y guarda con su versión', async () => {
    const vigente = { version: 3, content: { ...apice(), description: 'De otra persona' } };
    let n = 0;
    const { calls, drafts } = setup(apice(), {
      editApice: () => (++n === 1 ? { ok: false, conflict: true, current: vigente } : { ok: true, version: 4 }),
    });
    edit('Mía');
    await save();
    await userEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe('De otra persona');
    expect(drafts.get('apice:a1')).toBeUndefined();
    edit('Sobre lo vigente');
    await save();
    await waitFor(() => expect(calls).toHaveLength(2));
    expect((calls[1]?.payload as { baseVersion: number }).baseVersion).toBe(3);
  });

  it('RF-11 (001): si un cambio llega mientras se edita, no se pisa lo escrito ni se cambia la versión base', async () => {
    const { calls, push } = setup(apice(), { editApice: () => ({ ok: true, version: 3 }) });
    edit('Mía');
    act(() => push(apice({ version: 3, description: 'Otro cambio' })));
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value).toBe('Mía');
    await save();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0]?.payload as { baseVersion: number }).baseVersion).toBe(2);
  });
});

describe('ApiceEdit · bloques (002)', () => {
  // El formulario es ContentForm y la comparación es ConflictDiff (componentes con sus propias pruebas);
  // aquí se comprueba lo que la página renderiza: el aviso de fallo al reenviar lo propio.
  it('RF-6 (002) · 6.1, 6.3: el aviso de fallo al conservar lo propio es un bloque, y los botones del conflicto siguen su clase', async () => {
    const vigente = { version: 3, content: { ...apice(), description: 'De otra persona' } };
    let n = 0;
    setup(apice(), {
      editApice: () => {
        if (++n === 1) return { ok: false, conflict: true, current: vigente };
        throw new Error('sin red');
      },
    });
    edit('Mía');
    await save();
    const keep = await screen.findByRole('button', { name: 'Conservar los míos' });
    expect(keep.classList.contains('action-primary')).toBe(true);
    expect(screen.getByRole('button', { name: /Descartar/ }).classList.contains('action-secondary')).toBe(true);
    await userEvent.click(keep);
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    for (const alert of screen.getAllByRole('alert')) expect(alert.classList.contains('block')).toBe(true);
  });

  it('RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.2: el formulario se presenta dentro de un lote', () => {
    setup(apice());
    const lot = document.querySelector('.lot');
    expect(lot).not.toBeNull();
    expect(lot?.querySelector('form')).not.toBeNull();
    expect(lot?.classList.contains('block')).toBe(false);
  });

  it('RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.2: la vista de conflicto se presenta dentro de un lote', async () => {
    const vigente = { version: 3, content: { ...apice(), description: 'De otra persona' } };
    setup(apice(), { editApice: () => ({ ok: false, conflict: true, current: vigente }) });
    edit('Mía');
    await save();
    const lot = document.querySelector('.lot');
    expect(lot).not.toBeNull();
    expect(lot?.classList.contains('block')).toBe(false);
  });
});
