import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Amendment, ConstitutionState, Section } from '../../shared/domain/constitution';
import { SessionProvider, type SessionState } from '../app/session';
import type { AmendmentsSource } from '../data/constitution/amendments';
import type { SectionsSource } from '../data/constitution/sections';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { fakeClient } from '../testing/facilitationDoubles';
import { Amendments } from './Amendments';

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-10-01T12:00:00Z');

const amendment = (id: string, extra: Partial<Amendment> = {}): Amendment => ({
  id,
  kind: 'change',
  sectionId: 's1',
  after: null,
  slotKey: `change:s1:${id}`,
  title: `Propuesta ${id}`,
  text: `Texto completo de ${id}`,
  motive: `Motivo de ${id}`,
  revisionNo: 1,
  baseSectionVersion: 1,
  authorUid: 'u-bea',
  authorUsername: 'bea',
  authorSuspended: false,
  openedAt: T0,
  closesAt: T0 + 15 * DAY,
  extended: false,
  isOpen: true,
  result: null,
  reasons: [],
  closedAt: null,
  agreementsCounted: 0,
  objectionsResolved: 0,
  objectionsWithdrawn: 0,
  newSectionId: null,
  ...extra,
});

const section = (id: string, title: string): Section => ({ id, title, text: `Texto de ${title}`, updatedAt: T0, isRetired: false, retiredAt: null });

function setup(
  session: SessionState,
  opts: { open?: Amendment[]; closed?: Amendment[]; isOpen?: boolean; hash?: string; calls?: Record<string, (p: never) => unknown> } = {},
) {
  window.history.replaceState(null, '', `/constitucion/propuestas${opts.hash ?? ''}`);
  const amendmentsSource = {
    onOpen: (cb: (a: Amendment[]) => void) => {
      cb(opts.open ?? []);
      return () => {};
    },
    fetchClosedPage: async () => ({ items: opts.closed ?? [], cursor: null }),
  } as unknown as AmendmentsSource;
  const state: ConstitutionState = { isOpen: opts.isOpen ?? true, openedAt: T0, order: ['s1', 's2'], updatedAt: T0, logSeq: 1 };
  const sectionsSource = {
    onState: (cb: (s: ConstitutionState | null) => void) => {
      cb(state);
      return () => {};
    },
    onSections: (_a: string, cb: (s: Section[]) => void) => {
      cb([section('s1', 'Principios'), section('s2', 'Reglas')]);
      return () => {};
    },
  } as unknown as SectionsSource;
  const { client, calls } = fakeClient({ openAmendment: () => ({ ok: true, id: 'nueva' }), ...(opts.calls as object) });
  const settle = vi.fn(async () => ({}));
  const view = render(
    <SessionProvider initial={session}>
      <Amendments amendmentsSource={amendmentsSource} sectionsSource={sectionsSource} client={client} settle={settle} />
    </SessionProvider>,
  );
  return { ...view, calls, settle };
}

const member: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };

beforeEach(() => window.history.replaceState(null, '', '/constitucion/propuestas'));
afterEach(cleanup);

describe('Amendments', () => {
  it('RF-7 (004) · 7.1: muestra las abiertas completas, la que cierra antes primero, tras reflejar el vencimiento', async () => {
    const { container, settle } = setup(member, {
      open: [amendment('tarde', { closesAt: T0 + 20 * DAY }), amendment('pronto', { closesAt: T0 + 5 * DAY })],
    });
    await screen.findByText('Propuesta pronto');
    expect(settle).toHaveBeenCalled();
    const titles = within(screen.getByRole('list', { name: 'Propuestas abiertas' })).getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Propuesta pronto', 'Propuesta tarde']);
    expect(screen.getByText('Texto completo de pronto')).toBeTruthy();
    expect(screen.getByText('Motivo de pronto', { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Propuesta pronto/ }).getAttribute('href')).toBe('/constitucion/propuestas/pronto');
    expectBlocks(container);
  });

  it('RF-7 (004) · 7.3: las dos listas viven en la misma página y las cerradas muestran su resultado', async () => {
    setup(member, {
      open: [amendment('a1')],
      closed: [amendment('c1', { isOpen: false, result: 'approved', closedAt: T0 + 3 * DAY })],
    });
    await screen.findByText('Propuesta a1');
    expect(await screen.findByText('Propuesta c1')).toBeTruthy();
    expect(screen.getByText(/Resultado: Aprobada/)).toBeTruthy();
  });

  it('RF-7 (004) · 7.3: sin propuestas abiertas lo dice', async () => {
    setup(member);
    expect(await screen.findByText('No hay propuestas abiertas.')).toBeTruthy();
  });

  it('RF-9 (004) · 9.4: sin cuenta activa muestra el aviso de las personas inscritas y no lee propuestas', () => {
    const { calls, settle } = setup({ status: 'visitor' }, { open: [amendment('a1')] });
    expect(screen.getByText(/deliberación es de las personas inscritas/)).toBeTruthy();
    expect(screen.queryByText('Propuesta a1')).toBeNull();
    expect(settle).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('RF-7 (004) · 7.1: el único botón azul es «Abrir propuesta»', async () => {
    const { container } = setup(member, { open: [amendment('a1')] });
    await screen.findByText('Propuesta a1');
    expectOnePrimary(container, 'Abrir propuesta');
  });

  it('RF-6 (004) · 6.1: «Abrir propuesta» abre el diálogo con el formulario y, al enviar, llama a openAmendment y va a la propuesta', async () => {
    const user = userEvent.setup();
    const { container, calls } = setup(member);
    await user.click(await screen.findByRole('button', { name: 'Abrir propuesta' }));
    const dialog = screen.getByRole('dialog');
    expectOnePrimary(container, 'Enviar propuesta');
    await user.selectOptions(within(dialog).getByLabelText('Sección'), 's1');
    await user.type(within(dialog).getByLabelText('Título'), 'Nuevo título');
    await user.type(within(dialog).getByLabelText('Texto'), 'Nuevo texto');
    await user.type(within(dialog).getByLabelText('Motivo'), 'Porque sí');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar propuesta' }));
    await waitFor(() => expect(window.location.pathname).toBe('/constitucion/propuestas/nueva'));
    expect(calls[0]).toEqual({
      op: 'openAmendment',
      payload: { kind: 'change', sectionId: 's1', title: 'Nuevo título', text: 'Nuevo texto', motive: 'Porque sí' },
    });
  });

  it('RF-6 (004) · 6.1: #cambiar-ID, #quitar-ID y #anadir-ID abren el diálogo', async () => {
    for (const hash of ['#cambiar-s1', '#quitar-s1', '#anadir-s1']) {
      const view = setup(member, { hash });
      expect(await screen.findByRole('dialog')).toBeTruthy();
      view.unmount();
    }
  });

  it('RF-6 (004) · 6.1: #cambiar-ID, #quitar-ID y #anadir-ID llegan con el tipo y el lugar ya elegidos', async () => {
    const cases: [string, string, string, string][] = [
      ['#cambiar-s1', 'change', 'Sección', 's1'],
      ['#quitar-s1', 'remove', 'Sección', 's1'],
      ['#anadir-s1', 'add', 'Lugar', 's1'],
    ];
    for (const [hash, kind, place, value] of cases) {
      const view = setup(member, { hash });
      const dialog = await screen.findByRole('dialog');
      expect((within(dialog).getByLabelText('Tipo de cambio') as HTMLSelectElement).value, hash).toBe(kind);
      expect((within(dialog).getByLabelText(place) as HTMLSelectElement).value, hash).toBe(value);
      view.unmount();
    }
  });

  it('RF-6 (004) · 6.2: Cancelar cierra el diálogo', async () => {
    const user = userEvent.setup();
    setup(member, { hash: '#cambiar-s1' });
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('RF-6 (004) · 6.5: si ya hay una abierta en ese lugar, enlaza a ella', async () => {
    const user = userEvent.setup();
    setup(member, { calls: { openAmendment: () => ({ ok: false, taken: true, amendmentId: 'previa' }) } });
    await user.click(await screen.findByRole('button', { name: 'Abrir propuesta' }));
    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Sección'), 's1');
    await user.type(within(dialog).getByLabelText('Título'), 'T');
    await user.type(within(dialog).getByLabelText('Texto'), 'X');
    await user.type(within(dialog).getByLabelText('Motivo'), 'M');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar propuesta' }));
    expect((await screen.findByRole('link', { name: 'Ver la propuesta abierta' })).getAttribute('href')).toBe('/constitucion/propuestas/previa');
  });

  it('RF-6 (004) · 6.1: con la constitución sin abrir no hay «Abrir propuesta»', async () => {
    setup(member, { isOpen: false });
    await screen.findByText('No hay propuestas abiertas.');
    expect(screen.queryByRole('button', { name: 'Abrir propuesta' })).toBeNull();
  });
});
