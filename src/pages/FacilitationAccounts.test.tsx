import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AccountRow } from '../data/facilitation';
import { AsFacilitator, fakeClient, fakeSource } from '../testing/facilitationDoubles';
import { FacilitationAccounts } from './FacilitationAccounts';
import { blockProblems } from '../testing/expectBlocks';

const account = (uid: string, extra: Partial<AccountRow> = {}): AccountRow => ({
  uid,
  email: `${uid}@ejemplo.org`,
  name: `Nombre ${uid}`,
  username: uid,
  role: 'member',
  status: 'active',
  ...extra,
});

const itemOf = (username: string) => screen.getByText(username).closest('li')!;

function setup(rows: AccountRow[], handlers: Parameters<typeof fakeClient>[0] = {}) {
  const doubles = fakeSource({ accounts: rows });
  const { client, calls } = fakeClient(handlers);
  render(
    <AsFacilitator uid="fab">
      <FacilitationAccounts source={doubles.source} client={client} />
    </AsFacilitator>,
  );
  return { ...doubles, calls };
}

describe('FacilitationAccounts', () => {
  it('RF-5 (001): suspender y reactivar piden la op con el uid y la lista refleja el estado', async () => {
    const user = userEvent.setup();
    const rows = [account('ana'), account('beto', { status: 'suspended' })];
    const { calls, setAccounts } = setup(rows, { suspendAccount: () => ({}), reactivateAccount: () => ({}) });
    expect(within(itemOf('ana')).getByText('Activa')).toBeTruthy();
    expect(within(itemOf('beto')).getByText('Suspendida')).toBeTruthy();

    await user.click(within(itemOf('ana')).getByRole('button', { name: 'Suspender' }));
    await user.click(within(itemOf('beto')).getByRole('button', { name: 'Reactivar' }));
    expect(calls).toEqual([
      { op: 'suspendAccount', payload: { uid: 'ana' } },
      { op: 'reactivateAccount', payload: { uid: 'beto' } },
    ]);

    act(() => setAccounts([account('ana', { status: 'suspended' }), account('beto')]));
    expect(within(itemOf('ana')).getByRole('button', { name: 'Reactivar' })).toBeTruthy();
    expect(within(itemOf('beto')).getByRole('button', { name: 'Suspender' })).toBeTruthy();
  });

  it('RF-5 (001): una cuenta de facilitación, incluida la propia, no ofrece suspender', () => {
    setup([account('fab', { role: 'facilitator' }), account('otra', { role: 'facilitator' }), account('ana')]);
    expect(within(itemOf('fab')).queryByRole('button')).toBeNull();
    expect(within(itemOf('otra')).queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Suspender' })).toHaveLength(1);
  });

  it('RF-5 (001): si el servidor rechaza, muestra su mensaje', async () => {
    const user = userEvent.setup();
    setup([account('ana')], {
      suspendAccount: () => {
        throw new Error('no importa');
      },
    });
    await user.click(screen.getByRole('button', { name: 'Suspender' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo completar la acción. Inténtalo de nuevo.');
  });
});

describe('FacilitationAccounts · bloques (002)', () => {
  const kinds = (el: Element) => ['action-primary', 'action-secondary', 'action-destructive'].filter((c) => el.classList.contains(c));

  it('RF-4 (003) · 4.6: filas y botones son bloques; «Suspender» y «Reactivar» son secundarias', async () => {
    const rows = [account('ana'), account('beto', { status: 'suspended' })];
    setup(rows, { suspendAccount: () => {
      throw new Error('falla');
    } });
    expect(itemOf('ana').classList.contains('block')).toBe(true);
    expect(itemOf('beto').classList.contains('block')).toBe(true);
    for (const [who, name] of [['ana', 'Suspender'], ['beto', 'Reactivar']] as const) {
      const button = within(itemOf(who)).getByRole('button', { name });
      expect(button.classList.contains('block')).toBe(true);
      expect(kinds(button)).toEqual(['action-secondary']);
    }
    await userEvent.click(within(itemOf('ana')).getByRole('button', { name: 'Suspender' }));
    expect((await screen.findByRole('alert')).classList.contains('block')).toBe(true);
    expect(blockProblems(document.body)).toEqual([]);
  });

  it('RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1: la lista se presenta dentro de un lote y sus filas siguen siendo bloques', () => {
    setup([account('ana')]);
    const lot = document.querySelector('.lot');
    expect(lot).not.toBeNull();
    expect(lot?.classList.contains('block')).toBe(false);
    const item = itemOf('ana');
    expect(lot?.contains(item)).toBe(true);
    expect(item.classList.contains('block')).toBe(true);
  });
});
