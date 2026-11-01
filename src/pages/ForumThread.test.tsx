import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionProvider, VISITOR, type SessionState } from '../app/session';
import type { ForumMessage, ForumSource, ForumThread as Thread } from '../data/forum';
import { expectBlocks } from '../testing/expectBlocks';
import { fakeClient } from '../testing/facilitationDoubles';
import { ForumThread } from './ForumThread';

const member: SessionState = { status: 'person', uid: 'u-be', role: 'member', username: 'beto' };
const author: SessionState = { status: 'person', uid: 'u-lu', role: 'member', username: 'lucia' };
const facilitator: SessionState = { status: 'person', uid: 'u-fa', role: 'facilitator', username: 'fabi' };
const suspended: SessionState = { status: 'suspended', uid: 'u-su' };

const HEAD: Thread = { id: 'h1', title: '¿Cisterna o tanques?', axis: 'agua', authorUsername: 'lucia', authorUid: 'u-lu', lastMessageAt: 3, createdAt: 1, messageCount: 3, isArchived: false };
const MESSAGES: ForumMessage[] = [
  { id: 'm1', authorUid: 'u-lu', authorUsername: 'lucia', text: 'Quiero comparar.', createdAt: Date.UTC(2026, 9, 10, 15), editedAt: null, isArchived: false, isOpening: true },
  { id: 'm2', authorUid: 'u-be', authorUsername: 'beto', text: 'Prefiero **tanques**.', createdAt: Date.UTC(2026, 9, 10, 16), editedAt: Date.UTC(2026, 9, 10, 17), isArchived: false, isOpening: false },
];

function sourceOf(head: Thread | null = HEAD, messages = MESSAGES) {
  const asked: boolean[] = [];
  const source: ForumSource = {
    fetchThreads: async () => ({ threads: [], next: null }),
    fetchThread: async (_id, { includeArchived }) => {
      asked.push(includeArchived);
      return head === null ? null : { thread: head, messages };
    },
  };
  return { source, asked };
}

const client = () =>
  fakeClient({ replyThread: () => ({ id: 'n' }), editMessage: () => ({}), archiveThread: () => ({}), archiveMessage: () => ({}) });

const setup = (session: SessionState, source: ForumSource, c = client().client) => {
  window.history.replaceState(null, '', '/foro/h1');
  return render(
    <SessionProvider initial={session}>
      <ForumThread source={source} client={c} />
    </SessionProvider>,
  );
};

afterEach(() => window.history.replaceState(null, '', '/'));

describe('ForumThread', () => {
  it('RF-7 (009): muestra título, eje y los mensajes en orden con inicial, autoría, fecha y texto; marca lo editado', async () => {
    setup(VISITOR, sourceOf().source);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('¿Cisterna o tanques?');
    const articles = screen.getAllByRole('article');
    expect(articles.map((a) => within(a).getByText(/^@/).textContent)).toEqual(['@lucia', '@beto']);
    expect(within(articles[0]!).getByText('L')).toBeTruthy();
    expect(within(articles[0]!).getByText(/2026/)).toBeTruthy();
    expect(within(articles[1]!).getByText('editado')).toBeTruthy();
    expect(within(articles[0]!).queryByText('editado')).toBeNull();
    expect(within(articles[1]!).getByText('tanques').tagName).toBe('STRONG');
    expect(screen.getByText('Agua')).toBeTruthy();
  });

  it('RF-7 (009) · 7.2: el visitante y la cuenta suspendida no ven «Tu respuesta» y se les invita a entrar', async () => {
    const { unmount } = setup(VISITOR, sourceOf().source);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText('Tu respuesta')).toBeNull();
    expect(screen.getByRole('link', { name: 'Inicia sesión' }).getAttribute('href')).toBe('/entrar');
    unmount();
    setup(suspended, sourceOf().source);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText('Tu respuesta')).toBeNull();
    expect(screen.getByText(/suspendida/)).toBeTruthy();
  });

  it('RF-7 (009) · 7.1: un hilo inexistente o archivado (para quien no modera) muestra el mismo aviso', async () => {
    const { unmount } = setup(member, sourceOf(null).source);
    await screen.findByText('No encontramos ese hilo');
    unmount();
    setup(member, sourceOf({ ...HEAD, isArchived: true }).source);
    await screen.findByText('No encontramos ese hilo');
  });

  it('RF-4 (009): una persona responde con «Tu respuesta» y «Responder», y el campo se vacía', async () => {
    const { client: c, calls } = client();
    setup(member, sourceOf().source, c);
    await userEvent.type(await screen.findByLabelText('Tu respuesta'), 'Mi aporte');
    await userEvent.click(screen.getByRole('button', { name: 'Responder' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'replyThread', payload: { threadId: 'h1', text: 'Mi aporte' } }]));
    await waitFor(() => expect((screen.getByLabelText('Tu respuesta') as HTMLTextAreaElement).value).toBe(''));
  });

  it('RF-4 (009): una respuesta vacía no se envía', async () => {
    const { client: c, calls } = client();
    setup(member, sourceOf().source, c);
    await screen.findByLabelText('Tu respuesta');
    await userEvent.click(screen.getByRole('button', { name: 'Responder' }));
    expect((await screen.findByRole('alert')).textContent).toContain('vacío');
    expect(calls).toHaveLength(0);
  });

  it('RF-4 (009) · 4.1: en un hilo archivado (visto por quien modera) no hay campo de respuesta', async () => {
    setup(facilitator, sourceOf({ ...HEAD, isArchived: true }).source);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText('Tu respuesta')).toBeNull();
    expect(screen.getByText(/Archivado/)).toBeTruthy();
  });

  it('RF-6 (009): la autora edita su mensaje; otra persona no ve «Editar»', async () => {
    const { client: c, calls } = client();
    setup(member, sourceOf().source, c);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const box = screen.getByLabelText('Tu mensaje');
    await userEvent.clear(box);
    await userEvent.type(box, 'Corregido');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'editMessage', payload: { threadId: 'h1', messageId: 'm2', text: 'Corregido' } }]));
  });

  it('RF-5 (009): la autora archiva su hilo y un facilitador archiva mensajes ajenos; el primero solo con el hilo', async () => {
    const own = client();
    const { unmount } = setup(author, sourceOf().source, own.client);
    await userEvent.click(await screen.findByRole('button', { name: 'Archivar hilo' }));
    await waitFor(() => expect(own.calls).toEqual([{ op: 'archiveThread', payload: { threadId: 'h1' } }]));
    expect(screen.queryByRole('button', { name: 'Archivar mensaje' })).toBeNull();
    unmount();
    const mod = client();
    const { asked, source } = sourceOf();
    setup(facilitator, source, mod.client);
    await screen.findByRole('heading', { level: 1 });
    expect(asked[0]).toBe(true);
    const buttons = screen.getAllByRole('button', { name: 'Archivar mensaje' });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]!);
    await waitFor(() => expect(mod.calls).toEqual([{ op: 'archiveMessage', payload: { threadId: 'h1', messageId: 'm2' } }]));
  });

  it('RF-5 (009): el botón de archivar sigue a `isOpening`, no a la posición del mensaje', async () => {
    const [opening, reply] = MESSAGES as [ForumMessage, ForumMessage];
    setup(facilitator, sourceOf(HEAD, [reply, opening]).source);
    const articles = await screen.findAllByRole('article');
    expect(within(articles[0]!).getByRole('button', { name: 'Archivar mensaje' })).toBeTruthy();
    expect(within(articles[1]!).queryByRole('button', { name: 'Archivar mensaje' })).toBeNull();
  });

  it('RNF-4 (009): todo control y aviso es un bloque', async () => {
    const { container } = setup(author, sourceOf().source);
    await screen.findByRole('heading', { level: 1 });
    expectBlocks(container);
  });
});
