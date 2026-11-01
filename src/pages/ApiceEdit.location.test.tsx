import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDrafts, DraftsContext } from '../app/drafts';
import { SessionProvider, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource } from '../data/apices';
import { fakeClient } from '../testing/facilitationDoubles';
import { ApiceEdit } from './ApiceEdit';

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
  location: { lat: 1.005, lng: 2.005, precision: 'approximate' },
  ...extra,
});

const ana: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const beto: SessionState = { status: 'person', uid: 'u-beto', role: 'member', username: 'beto' };
const fabi: SessionState = { status: 'person', uid: 'fab', role: 'facilitator', username: 'fabi' };

function setup(session: SessionState, handlers: Parameters<typeof fakeClient>[0] = { editApice: () => ({ ok: true, version: 3 }) }) {
  const { client, calls } = fakeClient(handlers);
  const asked: Array<{ id: string; version: number }> = [];
  const source: ApiceSource = {
    onApice(_id, callback) {
      callback(apice());
      return () => {};
    },
    async readExact(id, version) {
      asked.push({ id, version });
      return { lat: 1.0012, lng: 2.0034 };
    },
  };
  render(
    <SessionProvider initial={session}>
      <DraftsContext.Provider value={createDrafts()}>
        <ApiceEdit id="a1" source={source} client={client} />
      </DraftsContext.Provider>
    </SessionProvider>,
  );
  return { calls, asked };
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

describe('ApiceEdit · ubicación', () => {
  it('RF-9 (001): sin tocar la ubicación no se envía el campo y el punto exacto no viaja', async () => {
    const { calls } = setup(ana);
    await screen.findByText(/Punto exacto: 1.0012, 2.0034/);
    await save();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.payload).not.toHaveProperty('location');
  });

  it('RF-9 (001): la autora lee su punto exacto y lo ve en el formulario', async () => {
    const { asked } = setup(ana);
    expect(await screen.findByText(/Punto exacto: 1.0012, 2.0034/)).toBeTruthy();
    expect(asked).toEqual([{ id: 'a1', version: 2 }]);
  });

  it('RF-9 (001): la facilitación también lee el punto exacto', async () => {
    setup(fabi);
    expect(await screen.findByText(/Punto exacto: 1.0012, 2.0034/)).toBeTruthy();
  });

  it('RF-9 (001): otra persona no lo pide ni lo ve, y puede guardar dejando la ubicación intacta', async () => {
    const { asked, calls } = setup(beto);
    expect(screen.getByText(/Zona de ≈ 1 km alrededor de 1.005, 2.005/)).toBeTruthy();
    expect(screen.queryByText(/Punto exacto/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Otra' } });
    await save();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(asked).toEqual([]);
    expect(calls[0]?.payload).not.toHaveProperty('location');
  });

  it('RF-9 (001): quitar la ubicación se envía como «quitar»', async () => {
    const { calls } = setup(beto);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    await save();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.payload).toMatchObject({ baseVersion: 2, location: { mode: 'remove' } });
  });

  it('RF-9 (001): cambiar solo la precisión se envía como cambio de precisión', async () => {
    const { calls } = setup(ana);
    await screen.findByText(/Punto exacto/);
    await userEvent.click(screen.getByRole('radio', { name: /Exacta/ }));
    await save();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.payload).toMatchObject({ location: { mode: 'precision', precision: 'exact' } });
  });

  it('RF-9 (001): un conflicto conserva la ubicación elegida al reenviar lo propio', async () => {
    let n = 0;
    const { calls } = setup(beto, {
      editApice: () => {
        n += 1;
        return n === 1
          ? { ok: false, conflict: true, current: { version: 3, content: { name: 'Huerta', description: 'Otra', axes: ['alimento'], needs: '', offers: '', status: 'idea' } } }
          : { ok: true, version: 4 };
      },
    });
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '6' } });
    await save();
    await userEvent.click(await screen.findByRole('button', { name: /Conservar los míos/ }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]?.payload).toMatchObject({ baseVersion: 3, location: { mode: 'set', lat: 5, lng: 6, precision: 'approximate' } });
  });
});
