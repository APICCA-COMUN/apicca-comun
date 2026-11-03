import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Axis } from '../../shared/domain/apice';
import { SessionProvider, VISITOR, type SessionState } from '../app/session';
import type { ForumSource } from '../data/forum';
import { expectBlocks } from '../testing/expectBlocks';
import { fakeClient } from '../testing/facilitationDoubles';
import { Forum } from './Forum';

const member: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const thread = (id: string, title: string, axis: Axis, messageCount = 3) => ({ id, title, axis, authorUsername: 'lucia', lastMessageAt: 1000, messageCount });
const THREADS = [thread('a', '¿Cisterna de ferrocemento o tanques reciclados?', 'agua', 4), thread('b', 'Banco de semillas nativas', 'alimento', 2)];

const sourceOf = (all = THREADS): ForumSource & { axes: Array<Axis | null> } => {
  const axes: Array<Axis | null> = [];
  return {
    axes,
    fetchThreads: async ({ axis }) => {
      axes.push(axis);
      return { threads: all.filter((t) => axis === null || t.axis === axis), next: null };
    },
    fetchThread: async () => null,
    fetchOlder: async () => ({ messages: [], before: null }),
  };
};

const setup = (session: SessionState = VISITOR, source: ForumSource = sourceOf(), client = fakeClient({ openThread: () => ({ id: 'nuevo' }) }).client) =>
  render(
    <SessionProvider initial={session}>
      <Forum source={source} client={client} />
    </SessionProvider>,
  );

afterEach(() => window.history.replaceState(null, '', '/'));

describe('Forum', () => {
  it('RF-1 (009): lista los hilos con título, eje, autoría y respuestas, y enlaza a cada uno', async () => {
    setup();
    const list = await screen.findByRole('region', { name: 'Lista de hilos' });
    const first = within(list).getAllByRole('article')[0]!;
    expect(within(first).getByRole('link', { name: '¿Cisterna de ferrocemento o tanques reciclados?' }).getAttribute('href')).toBe('/foro/a');
    expect(within(first).getByText('@lucia')).toBeTruthy();
    expect(within(first).getByText('3 respuestas')).toBeTruthy();
    expect(within(list).getByText('1 respuesta')).toBeTruthy();
  });

  it('RF-2 (009) · 2.1: cada filtro se llama «Eje <nombre>», lleva aria-pressed y filtra', async () => {
    const source = sourceOf();
    setup(VISITOR, source);
    await screen.findByRole('region', { name: 'Lista de hilos' });
    const water = screen.getByRole('button', { name: 'Eje Agua' });
    expect(water.getAttribute('aria-pressed')).toBe('false');
    for (const name of ['Eje Alimento', 'Eje Cobijo', 'Eje Energía', 'Eje Comunicación', 'Todos los temas']) screen.getByRole('button', { name });
    await userEvent.click(water);
    await waitFor(() => expect(screen.queryByText('Banco de semillas nativas')).toBeNull());
    expect(water.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(water);
    await screen.findByText('Banco de semillas nativas');
    expect(source.axes).toEqual([null, 'agua', null]);
  });

  it('RF-1 (009) · 1.2: sin hilos hay un texto vacío; «Abrir un hilo» solo para quien puede', async () => {
    const { unmount } = setup(VISITOR, sourceOf([]));
    await screen.findByText('Todavía no hay hilos.');
    expect(screen.queryByRole('button', { name: 'Abrir un hilo' })).toBeNull();
    unmount();
    setup(member, sourceOf([]));
    await screen.findByText('Todavía no hay hilos.');
    expect(screen.getAllByRole('button', { name: 'Abrir un hilo' })).toHaveLength(2);
  });

  it('RF-1 (009) · 1.1: con tanda siguiente aparece «Ver más hilos»', async () => {
    const calls: unknown[] = [];
    const source: ForumSource = {
      fetchThreads: async (options) => {
        calls.push(options.after ?? null);
        return options.after ? { threads: [thread('c', 'Tercero', 'agua')], next: null } : { threads: THREADS, next: { id: 'cursor' } as never };
      },
      fetchThread: async () => null,
      fetchOlder: async () => ({ messages: [], before: null }),
    };
    setup(VISITOR, source);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver más hilos' }));
    await screen.findByText('Tercero');
    expect(screen.queryByRole('button', { name: 'Ver más hilos' })).toBeNull();
    expect(calls).toEqual([null, { id: 'cursor' }]);
  });

  it('RF-3 (009): una persona abre un hilo, se valida antes de enviar y navega al hilo nuevo', async () => {
    const { client, calls } = fakeClient({ openThread: () => ({ id: 'nuevo' }) });
    setup(member, sourceOf(), client);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir un hilo' }));
    const form = screen.getByRole('form', { name: 'Abrir un hilo' });
    await userEvent.type(within(form).getByLabelText('Título'), 'ab');
    await userEvent.type(within(form).getByLabelText('Mensaje'), 'Hola');
    await userEvent.click(within(form).getByRole('button', { name: 'Publicar hilo' }));
    expect((await within(form).findByRole('alert')).textContent).toContain('3 caracteres');
    expect(calls).toHaveLength(0);
    await userEvent.type(within(form).getByLabelText('Título'), 'c');
    await userEvent.selectOptions(within(form).getByLabelText('Eje'), 'cobijo');
    await userEvent.click(within(form).getByRole('button', { name: 'Publicar hilo' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'openThread', payload: { title: 'abc', axis: 'cobijo', text: 'Hola' } }]));
    await waitFor(() => expect(window.location.pathname).toBe('/foro/nuevo'));
  });

  it('RF-3 (009) · 3.3: si el servidor rechaza, se muestra su mensaje y se conserva lo escrito', async () => {
    const { client } = fakeClient({ openThread: () => Promise.reject(Object.assign(new Error('x'), { name: 'ApiClientError' })) });
    setup(member, sourceOf(), client);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir un hilo' }));
    const form = screen.getByRole('form', { name: 'Abrir un hilo' });
    await userEvent.type(within(form).getByLabelText('Título'), 'Un título');
    await userEvent.type(within(form).getByLabelText('Mensaje'), 'Hola');
    await userEvent.click(within(form).getByRole('button', { name: 'Publicar hilo' }));
    expect((await within(form).findByRole('alert')).textContent).toContain('No se pudo abrir el hilo');
    expect((within(form).getByLabelText('Título') as HTMLInputElement).value).toBe('Un título');
  });

  it('RNF-4 (009): todo control y aviso es un bloque', async () => {
    const { container } = setup(member);
    await screen.findByRole('region', { name: 'Lista de hilos' });
    await userEvent.click(screen.getByRole('button', { name: 'Abrir un hilo' }));
    expectBlocks(container);
  });
});
