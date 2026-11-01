import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDrafts, DraftsContext } from '../app/drafts';
import { SessionProvider } from '../app/session';
import { fakeClient } from '../testing/facilitationDoubles';
import { ApiceNew } from './ApiceNew';

function setup() {
  const { client, calls } = fakeClient({ createApice: () => ({ id: 'a1' }) });
  render(
    <SessionProvider initial={{ status: 'person', uid: 'u-ana', role: 'member', username: 'ana' }}>
      <DraftsContext.Provider value={createDrafts()}>
        <ApiceNew client={client} />
      </DraftsContext.Provider>
    </SessionProvider>,
  );
  return calls;
}

const fill = async () => {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Huerta' } });
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Una huerta común' } });
  await userEvent.click(screen.getByRole('checkbox', { name: 'Agua' }));
};

describe('ApiceNew · ubicación', () => {
  it('RF-9 (001): la ubicación es opcional y por defecto aproximada', async () => {
    const calls = setup();
    expect(screen.getByText('Sin ubicación')).toBeTruthy();
    await fill();
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-33.45' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-70.66' } });
    await userEvent.click(screen.getByRole('button', { name: 'Crear ápice' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.payload).toMatchObject({ location: { mode: 'set', lat: -33.45, lng: -70.66, precision: 'approximate' } });
  });

  it('RF-9 (001): coordenadas inválidas no crean el ápice', async () => {
    const calls = setup();
    await fill();
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Crear ápice' }));
    expect(await screen.findByText(/fuera de rango/)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
