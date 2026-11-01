import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Amendment, Objection, Stance } from '../../shared/domain/constitution';
import { SessionProvider, type SessionState } from '../app/session';
import type { AmendmentComment, AmendmentRevision, AmendmentsSource } from '../data/constitution/amendments';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { fakeClient } from '../testing/facilitationDoubles';
import { AmendmentView } from './AmendmentView';

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-10-01T12:00:00Z');

const base = (extra: Partial<Amendment> = {}): Amendment => ({
  id: 'p1',
  kind: 'change',
  sectionId: 's1',
  after: null,
  slotKey: 'change:s1',
  title: 'Cambiar principios',
  text: 'Texto propuesto',
  motive: 'Porque conviene',
  revisionNo: 2,
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

const stance = (uid: string, extra: Partial<Stance> = {}): Stance => ({
  uid,
  username: uid.replace('u-', ''),
  agreement: 'none',
  agreedAtRevision: null,
  agreedAt: null,
  openObjectionId: null,
  withdrawnReason: null,
  ...extra,
});

const objection = (id: string, uid: string, extra: Partial<Objection> = {}): Objection => ({
  id,
  uid,
  username: uid.replace('u-', ''),
  reason: `Razón de ${id}`,
  status: 'open',
  openedAt: T0,
  closedAt: null,
  resolvedByRevision: null,
  closedBy: null,
  ...extra,
});

const comment = (id: string, uid: string): AmendmentComment => ({
  id,
  text: `Comentario ${id}`,
  authorUid: uid,
  authorUsername: uid.replace('u-', ''),
  createdAt: T0,
  editedAt: null,
  version: 1,
  archived: false,
  archivedBy: null,
  archivedByUsername: null,
  archivedAt: null,
});

const revision: AmendmentRevision = { revisionNo: 1, title: 'Título original', text: 'Texto original', motive: 'Motivo original', at: T0 };

interface Data {
  amendment?: Amendment | null;
  stances?: Stance[];
  objections?: Objection[];
  comments?: AmendmentComment[];
  revisions?: AmendmentRevision[];
}

function setup(session: SessionState, data: Data = {}, extra: { authorSuspended?: boolean; calls?: Record<string, (p: never) => unknown> } = {}) {
  const loaded = data.amendment === undefined ? base() : data.amendment;
  const amendment = loaded === null || extra.authorSuspended === undefined ? loaded : { ...loaded, authorSuspended: extra.authorSuspended };
  const order: string[] = [];
  const source = {
    onAmendment: (_id: string, cb: (a: Amendment | null) => void) => {
      order.push('read');
      cb(amendment);
      return () => {};
    },
    onRevisions: (_id: string, cb: (r: AmendmentRevision[]) => void) => (cb(data.revisions ?? [revision]), () => {}),
    onComments: (_id: string, cb: (c: AmendmentComment[]) => void) => (cb(data.comments ?? []), () => {}),
    onStances: (_id: string, cb: (s: Stance[]) => void) => (cb(data.stances ?? []), () => {}),
    onObjections: (_id: string, cb: (o: Objection[]) => void) => (cb(data.objections ?? []), () => {}),
  } as unknown as AmendmentsSource;
  const { client, calls } = fakeClient({
    agreeAmendment: () => ({}),
    revokeAgreement: () => ({}),
    objectAmendment: () => ({ objectionId: 'o9' }),
    resolveObjection: () => ({}),
    withdrawObjection: () => ({}),
    withdrawAmendment: () => ({}),
    commentAmendment: () => ({ id: 'c9' }),
    reviseAmendment: () => ({ ok: true, revisionNo: 3 }),
    ...(extra.calls as object),
  });
  const settle = vi.fn(async () => {
    order.push('settle');
    return {};
  });
  const view = render(
    <SessionProvider initial={session}>
      <AmendmentView
        id="p1"
        source={source}
        client={client}
        settle={settle}
      />
    </SessionProvider>,
  );
  return { ...view, calls, settle, order };
}

const ana: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const bea: SessionState = { status: 'person', uid: 'u-bea', role: 'member', username: 'bea' };

beforeEach(() => window.history.replaceState(null, '', '/constitucion/propuestas/p1'));
afterEach(cleanup);

describe('AmendmentView', () => {
  it('RF-7 (004) · 7.4: muestra contenido, revisión vigente, revisiones anteriores, acuerdos contados y deliberación', async () => {
    const { container } = setup(
      ana,
      {
        stances: [stance('u-cai', { agreement: 'active', agreedAtRevision: 2 }), stance('u-dan', { agreement: 'active', agreedAtRevision: 1 }), stance('u-eli', { agreement: 'revoked' })],
        comments: [comment('c1', 'u-cai')],
      },
    );
    expect((await screen.findByRole('heading', { level: 1, name: 'Cambiar principios' })).textContent).toBe('Cambiar principios');
    expect(screen.getByText('Texto propuesto')).toBeTruthy();
    expect(screen.getByText(/Revisión 2/)).toBeTruthy();
    expect(screen.getByText(/Porque conviene/)).toBeTruthy();
    // Revisión anterior conservada.
    expect(screen.getByText('Título original')).toBeTruthy();
    expect(screen.getByText(/Motivo original/)).toBeTruthy();
    // Dos acuerdos vigentes más el de quien propone.
    expect(screen.getByText(/3 acuerdos contados/)).toBeTruthy();
    expect(screen.getByText(/anterior a la revisión 2/)).toBeTruthy();
    expect(screen.getByText('Comentario c1')).toBeTruthy();
    expectBlocks(container);
  });

  it('RF-12 (004) · 12.5: llama a settle con el id antes de leer la propuesta', async () => {
    const { settle, order } = setup(ana);
    await screen.findByText('Cambiar principios');
    expect(settle).toHaveBeenCalledWith({ id: 'p1' });
    expect(order.indexOf('settle')).toBeLessThan(order.indexOf('read'));
  });

  it('RF-9 (004) · 9.4: sin cuenta activa, solo el aviso y ningún contenido', () => {
    const { settle } = setup({ status: 'visitor' });
    expect(screen.getByText(/deliberación es de las personas inscritas/)).toBeTruthy();
    expect(screen.queryByText('Texto propuesto')).toBeNull();
    expect(settle).not.toHaveBeenCalled();
  });

  it('RF-7 (004) · 7.4: una propuesta inexistente lo dice', async () => {
    setup(ana, { amendment: null });
    expect(await screen.findByText('No se encontró la propuesta.')).toBeTruthy();
  });

  it('RF-7 (004) · 7.4: una propuesta cerrada muestra el resultado y ninguna acción', async () => {
    const { container } = setup(ana, { amendment: base({ isOpen: false, result: 'rejected', reasons: ['insufficient_agreements'], closedAt: T0 + 15 * DAY }), comments: [comment('c1', 'u-cai')] });
    await screen.findByText(/No aprobada/);
    expect(screen.getByText(/Acuerdos insuficientes/)).toBeTruthy();
    expectOnePrimary(container, null);
    expect(screen.queryByRole('button', { name: 'Acordar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comentar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Objetar' })).toBeNull();
  });

  describe('tabla de botones (spec §4.3)', () => {
    it('RF-11 (004) · 11.1: quien no la abrió y aún no acordó ve «Acordar» azul, Comentar secundaria y Objetar destructiva', async () => {
      const { container } = setup(ana);
      await screen.findByText('Cambiar principios');
      expectOnePrimary(container, 'Acordar');
      expect(screen.getByRole('button', { name: 'Comentar' }).className).toContain('action-secondary');
      expect(screen.getByRole('button', { name: 'Objetar' }).className).toContain('action-destructive');
      expect(screen.queryByRole('button', { name: 'Revisar' })).toBeNull();
    });

    it('RF-11 (004) · 11.1: si ya acordó no hay botón azul y sale «Revocar acuerdo»', async () => {
      const { container } = setup(ana, { stances: [stance('u-ana', { agreement: 'active', agreedAtRevision: 2 })] });
      await screen.findByText('Cambiar principios');
      expectOnePrimary(container, null);
      expect(screen.getByRole('button', { name: 'Revocar acuerdo' })).toBeTruthy();
    });

    it('RF-8 (004) · 8.1: quien la abrió ve Revisar y Comentar secundarias y Retirar destructiva, sin azul', async () => {
      const { container } = setup(bea);
      await screen.findByText('Cambiar principios');
      expectOnePrimary(container, null);
      expect(screen.getByRole('button', { name: 'Revisar' }).className).toContain('action-secondary');
      expect(screen.getByRole('button', { name: 'Comentar' }).className).toContain('action-secondary');
      expect(screen.getByRole('button', { name: 'Retirar' }).className).toContain('action-destructive');
      expect(screen.queryByRole('button', { name: 'Acordar' })).toBeNull();
    });

    it('RF-10 (004) · 10.4: con objeción propia abierta: sin azul, «Dar por resuelta» y «Retirar objeción» secundarias', async () => {
      const { container } = setup(ana, {
        stances: [stance('u-ana', { openObjectionId: 'o1' })],
        objections: [objection('o1', 'u-ana'), objection('o2', 'u-cai')],
      });
      await screen.findByText('Cambiar principios');
      expectOnePrimary(container, null);
      expect(screen.queryByRole('button', { name: 'Acordar' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Dar por resuelta' }).className).toContain('action-secondary');
      expect(screen.getByRole('button', { name: 'Retirar objeción' }).className).toContain('action-secondary');
      // Solo la propia objeción lleva esas acciones.
      expect(screen.getAllByRole('button', { name: 'Dar por resuelta' })).toHaveLength(1);
    });
  });

  it('RF-11 (004) · 11.1: «Acordar» llama a agreeAmendment', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana);
    await user.click(await screen.findByRole('button', { name: 'Acordar' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'agreeAmendment', payload: { amendmentId: 'p1' } }));
  });

  it('RF-11 (004) · 11.1: «Revocar acuerdo» llama a revokeAgreement', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana, { stances: [stance('u-ana', { agreement: 'active', agreedAtRevision: 2 })] });
    await user.click(await screen.findByRole('button', { name: 'Revocar acuerdo' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'revokeAgreement', payload: { amendmentId: 'p1' } }));
  });

  it('RF-10 (004) · 10.1: «Objetar» pide motivo y llama a objectAmendment', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana);
    await user.click(await screen.findByRole('button', { name: 'Objetar' }));
    await user.type(screen.getByLabelText('Motivo de la objeción'), 'No me convence');
    await user.click(screen.getByRole('button', { name: 'Enviar objeción' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'objectAmendment', payload: { amendmentId: 'p1', reason: 'No me convence' } }));
  });

  it('RF-10 (004) · 10.4: «Dar por resuelta» llama a resolveObjection con su objeción', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana, { stances: [stance('u-ana', { openObjectionId: 'o1' })], objections: [objection('o1', 'u-ana')] });
    await user.click(await screen.findByRole('button', { name: 'Dar por resuelta' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'resolveObjection', payload: { amendmentId: 'p1', objectionId: 'o1' } }));
  });

  it('RF-10 (004) · 10.4: «Retirar objeción» llama a withdrawObjection', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana, { stances: [stance('u-ana', { openObjectionId: 'o1' })], objections: [objection('o1', 'u-ana')] });
    await user.click(await screen.findByRole('button', { name: 'Retirar objeción' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'withdrawObjection', payload: { amendmentId: 'p1', objectionId: 'o1' } }));
  });

  it('RF-10 (004) · 10.4: si la objeción falla, muestra el motivo en español', async () => {
    const user = userEvent.setup();
    setup(ana, {
      stances: [stance('u-ana', { openObjectionId: 'o1' })],
      objections: [objection('o1', 'u-ana')],
    }, { calls: { withdrawObjection: () => { throw new Error('falla'); } } });
    await user.click(await screen.findByRole('button', { name: 'Retirar objeción' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/No se pudo/);
  });

  it('RF-8 (004) · 8.1: «Revisar» abre el formulario con lo vigente y envía baseRevision y amendmentId', async () => {
    const user = userEvent.setup();
    const { container, calls } = setup(bea);
    await user.click(await screen.findByRole('button', { name: 'Revisar' }));
    const dialog = screen.getByRole('dialog');
    expectOnePrimary(container, 'Guardar revisión');
    const title = within(dialog).getByLabelText('Título') as HTMLInputElement;
    expect(title.value).toBe('Cambiar principios');
    await user.clear(title);
    await user.type(title, 'Título nuevo');
    await user.clear(within(dialog).getByLabelText('Motivo'));
    await user.type(within(dialog).getByLabelText('Motivo'), 'Mejor así');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        op: 'reviseAmendment',
        payload: { amendmentId: 'p1', baseRevision: 2, title: 'Título nuevo', text: 'Texto propuesto', motive: 'Mejor así' },
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('RF-17 (004) · 17.2: si la revisión choca, el formulario muestra lo vigente y el diálogo sigue abierto', async () => {
    const user = userEvent.setup();
    setup(bea, {}, {
      calls: { reviseAmendment: () => ({ ok: false, conflict: true, current: { revisionNo: 3, title: 'Otro', text: 'Otro texto', motive: 'Otro motivo' } }) },
    });
    await user.click(await screen.findByRole('button', { name: 'Revisar' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar revisión' }));
    expect(await screen.findByText(/revisión 3/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('RF-8 (004) · 8.3: «Retirar» pide confirmación y llama a withdrawAmendment', async () => {
    const user = userEvent.setup();
    const { calls } = setup(bea);
    await user.click(await screen.findByRole('button', { name: 'Retirar' }));
    expect(calls).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'withdrawAmendment', payload: { amendmentId: 'p1' } }));
  });

  it('RF-14 (004) · 14.4: si quien propuso está suspendida, se ocultan «Revisar» y «Retirar»', async () => {
    const { container } = setup(bea, {}, { authorSuspended: true });
    await screen.findByText('Cambiar principios');
    expect(screen.queryByRole('button', { name: 'Revisar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirar' })).toBeNull();
    expectOnePrimary(container, null);
  });

  it('RF-14 (004) · 14.7: con quien propuso suspendida, su acuerdo implícito no se cuenta', async () => {
    setup(ana, { stances: [stance('u-cai', { agreement: 'active', agreedAtRevision: 2 })] }, { authorSuspended: true });
    expect(await screen.findByText(/1 acuerdo contado/)).toBeTruthy();
  });

  it('RF-9 (004) · 9.1: «Comentar» abre el campo y publica con commentAmendment', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana);
    await user.click(await screen.findByRole('button', { name: 'Comentar' }));
    await user.type(screen.getByLabelText('Tu comentario'), 'Estoy de acuerdo en parte');
    await user.click(screen.getByRole('button', { name: 'Publicar comentario' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'commentAmendment', payload: { amendmentId: 'p1', text: 'Estoy de acuerdo en parte' } }));
  });

  it('RF-17 (004) · 17.1: si el comentario falla, conserva lo escrito y muestra el motivo', async () => {
    const user = userEvent.setup();
    setup(ana, {}, { calls: { commentAmendment: () => { throw new Error('falla'); } } });
    await user.click(await screen.findByRole('button', { name: 'Comentar' }));
    await user.type(screen.getByLabelText('Tu comentario'), 'Texto largo');
    await user.click(screen.getByRole('button', { name: 'Publicar comentario' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/No se pudo/);
    expect((screen.getByLabelText('Tu comentario') as HTMLTextAreaElement).value).toBe('Texto largo');
  });

  it('RF-9 (004) · 9.2: archivar un comentario propio llama a archiveComment tras confirmar', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana, { comments: [comment('c1', 'u-ana')] }, { calls: { archiveComment: () => ({}) } });
    await user.click(await screen.findByRole('button', { name: 'Archivar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
    await waitFor(() => expect(calls).toContainEqual({ op: 'archiveComment', payload: { amendmentId: 'p1', commentId: 'c1' } }));
  });

  it('RF-9 (004) · 9.1: editar un comentario propio llama a editComment con la versión base', async () => {
    const user = userEvent.setup();
    const { calls } = setup(ana, { comments: [comment('c1', 'u-ana')] }, { calls: { editComment: () => ({ ok: true, version: 2 }) } });
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const field = screen.getByLabelText('Tu comentario');
    await user.clear(field);
    await user.type(field, 'Corregido');
    await user.click(screen.getByRole('button', { name: 'Guardar comentario' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ op: 'editComment', payload: { amendmentId: 'p1', commentId: 'c1', text: 'Corregido', baseVersion: 1 } }),
    );
  });
});
