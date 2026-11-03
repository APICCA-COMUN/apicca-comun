import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { SessionProvider, VISITOR, type SessionState } from '../app/session';
import type { ForumMessage, ForumSource, MessagePage, ForumThread as Thread } from '../data/forum';
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

// Los mensajes con `isOpening` salen como apertura y el resto como página reciente (RF-1 (018) · 1.1).
function sourceOf(head: Thread | null = HEAD, messages = MESSAGES, older: MessagePage[] = []) {
  const asked: boolean[] = [];
  const olderAsked: unknown[] = [];
  const pages = [...older];
  const source: ForumSource = {
    fetchThreads: async () => ({ threads: [], next: null }),
    fetchThread: async (_id, { includeArchived }) => {
      asked.push(includeArchived);
      const opening = messages.find((m) => m.isOpening) ?? null;
      return head === null ? null : { thread: head, opening, messages: messages.filter((m) => !m.isOpening), before: pages.length > 0 ? CURSOR : null };
    },
    fetchOlder: async (_id, options) => {
      olderAsked.push(options.before);
      return pages.shift() ?? { messages: [], before: null };
    },
  };
  return { source, asked, olderAsked };
}
const CURSOR = { id: 'cursor' } as unknown as QueryDocumentSnapshot;
const older = (id: string, text: string): ForumMessage => ({ id, authorUid: 'u-be', authorUsername: 'beto', text, createdAt: Date.UTC(2026, 9, 10, 15, 30), editedAt: null, isArchived: false, isOpening: false });

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
    expect(within(articles[0]!).queryByRole('button', { name: 'Archivar mensaje' })).toBeNull();
    expect(within(articles[1]!).getByRole('button', { name: 'Archivar mensaje' })).toBeTruthy();
  });

  it('RNF-4 (009): todo control y aviso es un bloque', async () => {
    const { container } = setup(author, sourceOf().source);
    await screen.findByRole('heading', { level: 1 });
    expectBlocks(container);
  });

  it('RF-1 (017) · 1.3: si la lectura falla por otro motivo, avisa del error y no dice que el hilo no existe', async () => {
    const failing: ForumSource = {
      fetchThreads: async () => ({ threads: [], next: null }),
      fetchThread: async () => {
        throw new Error('The query requires an index.');
      },
      fetchOlder: async () => ({ messages: [], before: null }),
    };
    setup(member, failing);
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar este hilo. Inténtalo de nuevo en un momento.');
    expect(screen.queryByText('No encontramos ese hilo')).toBeNull();
  });

  it('RF-1 (018) · 1.1: sin mensajes anteriores no hay botón «Ver mensajes anteriores»', async () => {
    setup(VISITOR, sourceOf().source);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Ver mensajes anteriores' })).toBeNull();
  });

  it('RF-1 (018) · 1.2: «Ver mensajes anteriores» añade los anteriores en orden cronológico, tras la apertura y sin quitar los mostrados', async () => {
    const { source, olderAsked } = sourceOf(HEAD, MESSAGES, [{ messages: [older('m0', 'Antes de todo')], before: null }]);
    setup(VISITOR, source);
    const button = await screen.findByRole('button', { name: 'Ver mensajes anteriores' });
    expect(button.className).toContain('block');
    expect(button.className).toContain('forum__more');
    await userEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ver mensajes anteriores' })).toBeNull());
    expect(olderAsked).toEqual([CURSOR]);
    const articles = screen.getAllByRole('article');
    expect(articles.map((a) => within(a).getByText(/^@/).textContent)).toEqual(['@lucia', '@beto', '@beto']);
    expect(within(articles[1]!).getByText('Antes de todo')).toBeTruthy();
    expect(within(articles[2]!).getByText('tanques')).toBeTruthy();
  });

  it('RF-1 (018) · 1.4: al responder se relee la página reciente y se conservan los anteriores ya cargados', async () => {
    const { client: c } = client();
    let reads = 0;
    const base = sourceOf(HEAD, MESSAGES, [{ messages: [older('m0', 'Antes de todo')], before: null }]);
    const source: ForumSource = {
      ...base.source,
      fetchThread: async (id, options) => {
        const found = await base.source.fetchThread(id, options);
        reads += 1;
        if (found === null) return null;
        return reads > 1 ? { ...found, messages: [...found.messages, { ...older('m9', 'Mi aporte nuevo'), createdAt: Date.UTC(2026, 9, 11) }] } : found;
      },
    };
    setup(member, source, c);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver mensajes anteriores' }));
    await screen.findByText('Antes de todo');
    await userEvent.type(screen.getByLabelText('Tu respuesta'), 'Mi aporte nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Responder' }));
    await screen.findByText('Mi aporte nuevo', { selector: 'p' });
    const texts = screen.getAllByRole('article').map((a) => within(a).getByText(/^@/).textContent);
    expect(texts).toEqual(['@lucia', '@beto', '@beto', '@beto']);
    expect(screen.getByText('Antes de todo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver mensajes anteriores' })).toBeNull();
  });

  it('RF-1 (018) · 1.5: editar un mensaje cargado con «Ver mensajes anteriores» muestra el texto nuevo sin releer', async () => {
    const { client: c, calls } = client();
    const mine: ForumMessage = { ...older('m0', 'Texto viejo'), authorUid: 'u-be' };
    const base = sourceOf(HEAD, MESSAGES, [{ messages: [mine], before: null }]);
    let reads = 0;
    const source: ForumSource = { ...base.source, fetchThread: async (id, options) => { reads += 1; return base.source.fetchThread(id, options); } };
    setup(member, source, c);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver mensajes anteriores' }));
    const old = (await screen.findByText('Texto viejo')).closest('article')!;
    await userEvent.click(within(old).getByRole('button', { name: 'Editar' }));
    const box = screen.getByLabelText('Tu mensaje');
    await userEvent.clear(box);
    await userEvent.type(box, 'Texto nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'editMessage', payload: { threadId: 'h1', messageId: 'm0', text: 'Texto nuevo' } }]));
    const edited = (await screen.findByText('Texto nuevo')).closest('article')!;
    expect(within(edited).getByText('editado')).toBeTruthy();
    expect(screen.queryByText('Texto viejo')).toBeNull();
    expect(reads).toBe(1);
  });

  it('RF-1 (018) · 1.1: un hilo sin mensaje de apertura se muestra sin cabecera y sin fallar', async () => {
    const [, reply] = MESSAGES as [ForumMessage, ForumMessage];
    setup(VISITOR, sourceOf(HEAD, [reply]).source);
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(1);
    expect(within(articles[0]!).getByText('@beto')).toBeTruthy();
  });
});
