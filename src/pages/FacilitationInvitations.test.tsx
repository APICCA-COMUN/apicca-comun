import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SessionProvider } from '../app/session';
import { ApiClientError } from '../data/api';
import type { InvitationRow } from '../data/facilitation';
import { AsFacilitator, at, fakeClient, fakeSource } from '../testing/facilitationDoubles';
import { FacilitationInvitations } from './FacilitationInvitations';
import { blockProblems } from '../testing/expectBlocks';

const row = (email: string, extra: Partial<InvitationRow> = {}): InvitationRow => ({
  email,
  token: `tok-${email.split('@')[0]}`,
  status: 'pending',
  issuedAt: at('2026-09-01T10:00:00Z'),
  expiresAt: at('2099-01-01T00:00:00Z'),
  ...extra,
});

const NOW = () => new Date('2026-09-02T00:00:00Z');

function setup(rows: InvitationRow[], handlers: Parameters<typeof fakeClient>[0] = {}) {
  const doubles = fakeSource({ invitations: rows });
  const { client, calls } = fakeClient(handlers);
  render(
    <AsFacilitator>
      <FacilitationInvitations source={doubles.source} client={client} now={NOW} />
    </AsFacilitator>,
  );
  return { ...doubles, calls };
}

describe('FacilitationInvitations', () => {
  it('RF-1 (001): lista de la más reciente a la más antigua con su estado', () => {
    setup([
      row('vieja@ejemplo.org', { issuedAt: at('2026-08-01T00:00:00Z'), status: 'accepted' }),
      row('nueva@ejemplo.org', { issuedAt: at('2026-09-01T00:00:00Z') }),
      row('vencida@ejemplo.org', { issuedAt: at('2026-08-15T00:00:00Z'), expiresAt: at('2026-09-01T00:00:00Z') }),
      row('anulada@ejemplo.org', { issuedAt: at('2026-08-10T00:00:00Z'), status: 'cancelled' }),
    ]);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items.map((t) => t.split(' ')[0])).toEqual(['nueva@ejemplo.org', 'vencida@ejemplo.org', 'anulada@ejemplo.org', 'vieja@ejemplo.org']);
    expect(within(screen.getByText('nueva@ejemplo.org').closest('li')!).getByText('Pendiente')).toBeTruthy();
    expect(within(screen.getByText('vencida@ejemplo.org').closest('li')!).getByText('Vencida')).toBeTruthy();
    expect(within(screen.getByText('anulada@ejemplo.org').closest('li')!).getByText('Anulada')).toBeTruthy();
    expect(within(screen.getByText('vieja@ejemplo.org').closest('li')!).getByText('Aceptada')).toBeTruthy();
  });

  it('RF-1 (001): invitar un correo muestra el enlace completo y se puede copiar', async () => {
    const user = userEvent.setup();
    const { calls } = setup([], { invite: () => ({ link: '/registro/abc123' }) });
    await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo.org');
    await user.click(screen.getByRole('button', { name: 'Invitar' }));
    expect(calls).toEqual([{ op: 'invite', payload: { email: 'ana@ejemplo.org' } }]);
    const url = `${window.location.origin}/registro/abc123`;
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain(url);
    await user.click(within(status).getByRole('button', { name: 'Copiar enlace' }));
    expect(await navigator.clipboard.readText()).toBe(url);
  });

  it('RF-1 (001): una invitación pendiente deja volver a ver y copiar su enlace', async () => {
    const user = userEvent.setup();
    setup([row('ana@ejemplo.org')]);
    const item = screen.getByText('ana@ejemplo.org').closest('li')!;
    expect(item.textContent).toContain(`${window.location.origin}/registro/tok-ana`);
    await user.click(within(item).getByRole('button', { name: 'Copiar enlace' }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/registro/tok-ana`);
  });

  it('RF-1 (001): no muestra enlace de las vencidas, anuladas ni aceptadas', () => {
    setup([
      row('a@ejemplo.org', { expiresAt: at('2026-09-01T00:00:00Z') }),
      row('b@ejemplo.org', { status: 'cancelled' }),
      row('c@ejemplo.org', { status: 'accepted' }),
    ]);
    expect(screen.queryByRole('button', { name: 'Copiar enlace' })).toBeNull();
    expect(screen.queryByText(/\/registro\//)).toBeNull();
  });

  it('RF-1 (001): renovar pide la op con el correo y muestra el enlace nuevo', async () => {
    const user = userEvent.setup();
    const { calls } = setup([row('ana@ejemplo.org', { expiresAt: at('2026-09-01T00:00:00Z') })], {
      invite: () => ({ link: '/registro/nuevo' }),
    });
    await user.click(screen.getByRole('button', { name: 'Renovar' }));
    expect(calls).toEqual([{ op: 'invite', payload: { email: 'ana@ejemplo.org' } }]);
    expect((await screen.findByRole('status')).textContent).toContain('/registro/nuevo');
  });

  it('RF-1 (001): anular pide la op y solo se ofrece en pendientes y vencidas', async () => {
    const user = userEvent.setup();
    const { calls } = setup(
      [row('ana@ejemplo.org'), row('vieja@ejemplo.org', { status: 'accepted' }), row('x@ejemplo.org', { status: 'cancelled' })],
      { cancelInvitation: () => ({}) },
    );
    expect(screen.getAllByRole('button', { name: 'Anular' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Anular' }));
    expect(calls).toEqual([{ op: 'cancelInvitation', payload: { email: 'ana@ejemplo.org' } }]);
  });

  it('RF-1 (001): un correo con cuenta muestra el aviso y no agrega nada', async () => {
    const user = userEvent.setup();
    setup([], {
      invite: () => {
        throw new ApiClientError('account-exists');
      },
    });
    await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo.org');
    await user.click(screen.getByRole('button', { name: 'Invitar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ese correo ya tiene una cuenta.');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('RF-1 (001): quien no facilita no ve la página', () => {
    const { source } = fakeSource();
    const { client } = fakeClient({});
    render(
      <SessionProvider initial={{ status: 'person', uid: 'u', role: 'member', username: 'ana' }}>
        <FacilitationInvitations source={source} client={client} />
      </SessionProvider>,
    );
    expect(screen.queryByLabelText('Correo')).toBeNull();
    expect(screen.getByText('Esta página es solo para quienes facilitan.')).toBeTruthy();
  });
});

describe('FacilitationInvitations · bloques (002)', () => {
  const kinds = (el: Element) => ['action-primary', 'action-secondary', 'action-destructive'].filter((c) => el.classList.contains(c));
  const isBlock = (el: Element) => el.classList.contains('block');

  it('RF-6 (002) · 6.1, 6.3: «Invitar» es la acción principal; «Renovar», «Anular» y «Copiar enlace» son secundarias (sin confirmación ni motivo en la 001)', () => {
    setup([
      row('ana@ejemplo.org'),
      row('vieja@ejemplo.org', { status: 'accepted' }),
    ]);
    const invite = screen.getByRole('button', { name: 'Invitar' });
    expect(isBlock(invite)).toBe(true);
    expect(kinds(invite)).toEqual(['action-primary']);
    expect(isBlock(screen.getByLabelText('Correo'))).toBe(true);
    const item = screen.getByText('ana@ejemplo.org').closest('li')!;
    expect(isBlock(item)).toBe(true);
    for (const name of ['Renovar', 'Anular', 'Copiar enlace']) {
      const button = within(item).getByRole('button', { name });
      expect(isBlock(button)).toBe(true);
      expect(kinds(button)).toEqual(['action-secondary']);
    }
    expect(isBlock(screen.getByText('vieja@ejemplo.org').closest('li')!)).toBe(true);
    // Todo control de la página, de la cabecera de facilitación incluida, es un bloque.
    expect(blockProblems(document.body)).toEqual([]);
  });

  it('RF-6 (002) · 6.1, 6.5: el estado vacío, el aviso de error y el del enlace son bloques', async () => {
    const user = userEvent.setup();
    const first = setup([], { invite: () => ({ link: '/registro/abc' }) });
    expect(screen.getByText('Aún no hay invitaciones.').className).toBe('block block-empty');
    await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo.org');
    await user.click(screen.getByRole('button', { name: 'Invitar' }));
    const status = await screen.findByRole('status');
    expect(isBlock(status)).toBe(true);
    expect(isBlock(within(status).getByRole('button', { name: 'Copiar enlace' }))).toBe(true);
    first.setInvitations([]);
    document.body.innerHTML = '';
    setup([], {
      invite: () => {
        throw new ApiClientError('account-exists');
      },
    });
    await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo.org');
    await user.click(screen.getByRole('button', { name: 'Invitar' }));
    expect(isBlock(await screen.findByRole('alert'))).toBe(true);
  });

  it('RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1: el formulario y la lista se presentan dentro de un lote', () => {
    setup([row('ana@ejemplo.org')]);
    const lots = document.querySelectorAll('.lot');
    expect(lots.length).toBeGreaterThanOrEqual(2);
    for (const lot of lots) expect(lot.classList.contains('block')).toBe(false);
    const form = screen.getByRole('button', { name: 'Invitar' }).closest('form')!;
    expect(Array.from(lots).some((lot) => lot.contains(form))).toBe(true);
    const item = screen.getByText('ana@ejemplo.org').closest('li')!;
    expect(item.classList.contains('block')).toBe(true);
    expect(Array.from(lots).some((lot) => lot.contains(item))).toBe(true);
  });
});
