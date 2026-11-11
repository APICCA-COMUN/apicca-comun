// RF-20 (021) · 20.1 a 20.4, RF-5 (010) · 5.1, RF-2 (010), RF-3 (010), RF-7 (010), RF-4 (010) · 4.3, D-T32 (021): el panel
// de una Acción Común.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import { ApiClientError } from '../data/api';
import type { CommonActionDetail, CommonActionSource } from '../data/commonActions';
import { fakeClient } from '../testing/facilitationDoubles';
import { CommonActionView } from './CommonActionView';

const detail = (extra: Partial<CommonActionDetail> = {}): CommonActionDetail => ({
  id: 'c1',
  title: 'Agua lluvia',
  description: 'Juntemos el **agua** lluvia del barrio.',
  axis: 'agua',
  status: 'abierta',
  authorUid: 'u-ana',
  authorUsername: 'ana',
  apiceIds: ['a1', 'a2', 'a3', 'a4'],
  participantUids: ['u-ana', 'u-beto'],
  participantCount: 2,
  createdAt: 1,
  participants: [
    { uid: 'u-ana', username: 'ana' },
    { uid: 'u-beto', username: 'beto' },
  ],
  apices: [
    { id: 'a1', name: 'Huerta', status: 'idea' },
    { id: 'a2', name: 'Tanque', status: 'prototipo' },
    { id: 'a3', name: 'Radio', status: 'idea' },
  ],
  hiddenApices: 1,
  ...extra,
});

const VISITOR: SessionState = { status: 'visitor' };
const ANA: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const BETO: SessionState = { status: 'person', uid: 'u-beto', role: 'member', username: 'beto' };
const CARO: SessionState = { status: 'person', uid: 'u-caro', role: 'member', username: 'caro' };
const FABI: SessionState = { status: 'person', uid: 'u-fabi', role: 'facilitator', username: 'fabi' };

function setup(session: SessionState, first: CommonActionDetail | null = detail(), handlers: Record<string, (p: unknown) => unknown> = {}) {
  let current = first;
  const source: CommonActionSource = { list: async () => [], get: vi.fn(async () => current) };
  const { client, calls } = fakeClient({
    joinCommonAction: () => ({ participantCount: 3 }),
    leaveCommonAction: () => ({ participantCount: 1 }),
    setCommonActionStatus: () => ({}),
    editCommonAction: () => ({ version: 2 }),
    ...handlers,
  });
  const onChange = vi.fn();
  render(
    <SessionProvider initial={session}>
      <CommonActionView id="c1" source={source} client={client} onChange={onChange} />
    </SessionProvider>,
  );
  return { calls, onChange, source, set: (next: CommonActionDetail | null) => (current = next) };
}

describe('CommonActionView', () => {
  it('RF-20 (021) · 20.1, RF-5 (010) · 5.1: muestra título, estado, eje, autoría, descripción con formato, participantes y los ápices que une', async () => {
    setup(VISITOR);
    expect(await screen.findByRole('heading', { level: 1, name: 'Agua lluvia' })).toBeTruthy();
    expect(screen.getByText('Camino abierto')).toBeTruthy();
    expect(screen.getByText('Propuesto por @ana')).toBeTruthy();
    expect(screen.getByText('agua').tagName).toBe('STRONG');
    within(screen.getByRole('list', { name: 'Participantes (2)' })).getByText('@beto');
    const apices = screen.getByRole('list', { name: 'Ápices que une' });
    expect(within(apices).getByRole('link', { name: 'Tanque' }).getAttribute('href')).toBe('/apices/a2');
  });

  it('RF-4 (010) · 4.3: dice cuántos ápices une que quien mira no puede ver', async () => {
    setup(VISITOR);
    expect(await screen.findByText('Une además 1 ápice que no puedes ver.')).toBeTruthy();
  });

  it('RF-20 (021) · 20.3: sin sesión, dice que para sumarse hay que unirse y enlaza a la solicitud', async () => {
    setup(VISITOR);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(/Para sumarte a este camino, únete a APICCA/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Unirme' }).getAttribute('href')).toBe('/solicitar');
    expect(screen.queryByRole('button', { name: 'Sumarme' })).toBeNull();
  });

  it('RF-20 (021) · 20.2, RF-2 (010): quien no participa ve «Sumarme»; al sumarse, el panel y el mapa se actualizan', async () => {
    const { calls, onChange, set } = setup(CARO);
    const join = await screen.findByRole('button', { name: 'Sumarme' });
    set(detail({ participantUids: ['u-ana', 'u-beto', 'u-caro'], participants: [...detail().participants, { uid: 'u-caro', username: 'caro' }], participantCount: 3 }));
    await userEvent.click(join);
    expect(calls).toContainEqual({ op: 'joinCommonAction', payload: { actionId: 'c1' } });
    expect(await screen.findByRole('button', { name: 'Retirarme' })).toBeTruthy();
    expect(onChange).toHaveBeenCalled();
  });

  it('RF-20 (021) · 20.2, RF-3 (010): quien participa y no es la autora ve «Retirarme»', async () => {
    const { calls } = setup(BETO);
    await userEvent.click(await screen.findByRole('button', { name: 'Retirarme' }));
    expect(calls).toContainEqual({ op: 'leaveCommonAction', payload: { actionId: 'c1' } });
  });

  it('RF-7 (010), D-T32 (021): la autora no se retira mientras está abierta; ve «Editar», «Cerrar camino» y «Archivar»', async () => {
    const { calls } = setup(ANA);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Retirarme' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sumarme' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar camino' }));
    expect(calls).toContainEqual({ op: 'setCommonActionStatus', payload: { actionId: 'c1', status: 'cerrada' } });
    screen.getByRole('button', { name: 'Archivar' });
  });

  it('RF-7 (010): cerrada, la autora ve «Reabrir camino» y nadie se suma', async () => {
    setup(ANA, detail({ status: 'cerrada' }));
    expect(await screen.findByText('Camino cerrado')).toBeTruthy();
    screen.getByRole('button', { name: 'Reabrir camino' });
    expect(screen.queryByRole('button', { name: 'Sumarme' })).toBeNull();
  });

  it('RF-7 (010) · 7.3, D-T32 (021): «Editar» cambia título, descripción y eje con «Guardar»', async () => {
    const { calls } = setup(ANA);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const title = screen.getByRole('textbox', { name: 'Título' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Cosecha de agua');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Eje principal (opcional)' }), '');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(calls).toContainEqual({
      op: 'editCommonAction',
      payload: { actionId: 'c1', title: 'Cosecha de agua', description: 'Juntemos el **agua** lluvia del barrio.', axis: null },
    });
  });

  it('RF-7 (010) · 7.1: un facilitador ve solo «Archivar» en una ajena', async () => {
    const { calls } = setup(FABI);
    await userEvent.click(await screen.findByRole('button', { name: 'Archivar' }));
    expect(calls).toContainEqual({ op: 'setCommonActionStatus', payload: { actionId: 'c1', status: 'archivada' } });
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('RF-2 (010) · 2.2: si el servidor rechaza, muestra su motivo', async () => {
    setup(CARO, detail(), {
      joinCommonAction: () => {
        throw new ApiClientError('action-closed');
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Sumarme' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no admite nuevas participaciones/);
  });

  it('RF-5 (010) · 5.2: una que no existe o no se puede leer dice «Este camino no existe.», sin pistas', async () => {
    setup(VISITOR, null);
    expect(await screen.findByRole('heading', { level: 1, name: 'Camino' })).toBeTruthy();
    expect(screen.getByText('Este camino no existe.')).toBeTruthy();
  });

  it('RF-8 (010): archivada, lo dice y no ofrece acciones', async () => {
    setup(ANA, detail({ status: 'archivada' }));
    await waitFor(() => expect(screen.getByText('Archivado')).toBeTruthy());
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
