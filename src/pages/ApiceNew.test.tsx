import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDrafts, DraftsContext } from '../app/drafts';
import { SessionProvider, type SessionState } from '../app/session';
import { ApiClientError } from '../data/api';
import { fakeClient } from '../testing/facilitationDoubles';
import { ApiceNew } from './ApiceNew';

const person: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };

function setup(session: SessionState, handlers: Parameters<typeof fakeClient>[0] = {}) {
  const { client, calls } = fakeClient(handlers);
  const drafts = createDrafts();
  render(
    <SessionProvider initial={session}>
      <DraftsContext.Provider value={drafts}>
        <ApiceNew client={client} />
      </DraftsContext.Provider>
    </SessionProvider>,
  );
  return { calls, drafts };
}

const fill = async (name: string, description: string) => {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: description } });
  await userEvent.click(screen.getByRole('checkbox', { name: 'Agua' }));
};

describe('ApiceNew', () => {
  it('RF-6 (001): crea con los datos mínimos, sin estado, y navega a su ficha', async () => {
    const { calls, drafts } = setup(person, { createApice: () => ({ id: 'a1' }) });
    await fill('Huerta', 'Una huerta común');
    await userEvent.click(screen.getByRole('button', { name: 'Crear ápice' }));
    await waitFor(() => expect(window.location.pathname).toBe('/apices/a1'));
    expect(calls).toEqual([
      { op: 'createApice', payload: { name: 'Huerta', description: 'Una huerta común', axes: ['agua'], needs: '', offers: '' } },
    ]);
    expect(drafts.get('apice:new')).toBeUndefined();
  });

  it('RF-6 (001): el formulario nuevo no ofrece elegir el estado, porque nace en «idea» y privado', () => {
    setup(person);
    expect(screen.queryByLabelText('Estado')).toBeNull();
    expect(screen.getByText(/privado/i)).toBeTruthy();
    expect(screen.getByText(/idea/i)).toBeTruthy();
  });

  it('RF-6 (001): un visitante es enviado a entrar y no ve el formulario', () => {
    setup({ status: 'visitor' });
    expect(screen.queryByLabelText('Nombre')).toBeNull();
    expect((screen.getByRole('link', { name: 'Entrar' }) as HTMLAnchorElement).getAttribute('href')).toBe('/entrar');
  });

  it('RF-5 (001): una cuenta suspendida no ve el formulario y se le dice por qué', () => {
    setup({ status: 'suspended', uid: 'u-x' });
    expect(screen.queryByLabelText('Nombre')).toBeNull();
    expect(screen.getByText(/suspendida/i)).toBeTruthy();
  });

  it('RNF-10 (001): si el servidor rechaza, muestra su mensaje y conserva lo escrito', async () => {
    setup(person, {
      createApice: () => {
        throw new ApiClientError('account-suspended');
      },
    });
    await fill('Huerta', 'Una huerta común');
    await userEvent.click(screen.getByRole('button', { name: 'Crear ápice' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/suspendida/);
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Huerta');
  });

  it('RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.2: el formulario se presenta dentro de un lote', () => {
    setup(person);
    const lot = document.querySelector('.lot');
    expect(lot).not.toBeNull();
    expect(lot?.querySelector('form')).not.toBeNull();
    expect(lot?.classList.contains('block')).toBe(false);
  });
});
