// T-4 (009) · Fuente del foro: lista por tandas con filtro de eje, y un hilo con sus mensajes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, fakeDb } from './constitution/fakeFirestore';
import { createForumSource } from './forum';

vi.mock('firebase/firestore', async () => (await import('./constitution/fakeFirestore')).fakeFirestoreModule);

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const head = (title: string, axis: string, at: number, extra: Record<string, unknown> = {}) => ({
  title, axis, authorUid: 'u1', authorUsername: 'lucia', createdAt: ts(at), lastMessageAt: ts(at), messageCount: 3, isArchived: false, ...extra,
});

beforeEach(() => fake.reset());

describe('forum.ts', () => {
  it('RF-1 (009): lista los hilos no archivados, el de actividad más reciente primero', async () => {
    fake.set('threads', [
      { id: 'a', data: head('Vieja', 'agua', 10) },
      { id: 'b', data: head('Nueva', 'cobijo', 30) },
      { id: 'c', data: head('Oculta', 'agua', 40, { isArchived: true }) },
    ]);
    const { threads, next } = await createForumSource(fakeDb).fetchThreads({ axis: null });
    expect(threads.map((t) => t.id)).toEqual(['b', 'a']);
    expect(threads[0]).toEqual({ id: 'b', title: 'Nueva', axis: 'cobijo', authorUsername: 'lucia', lastMessageAt: 30000, messageCount: 3 });
    expect(next).toBeNull();
  });

  it('RF-2 (009): el filtro de eje deja solo los hilos de ese eje', async () => {
    fake.set('threads', [
      { id: 'a', data: head('Agua', 'agua', 10) },
      { id: 'b', data: head('Cobijo', 'cobijo', 30) },
    ]);
    const { threads } = await createForumSource(fakeDb).fetchThreads({ axis: 'agua' });
    expect(threads.map((t) => t.id)).toEqual(['a']);
  });

  it('RF-1 (009) · 1.1: una tanda llena trae cursor y la siguiente sigue desde él', async () => {
    fake.set('threads', Array.from({ length: 25 }, (_, i) => ({ id: `t${String(i).padStart(2, '0')}`, data: head(`Hilo ${i}`, 'agua', 100 - i) })));
    const source = createForumSource(fakeDb);
    const first = await source.fetchThreads({ axis: null });
    expect(first.threads).toHaveLength(20);
    expect(first.next).not.toBeNull();
    const second = await source.fetchThreads({ axis: null, after: first.next });
    expect(second.threads).toHaveLength(5);
    expect(second.next).toBeNull();
  });

  it('RF-7 (009): un hilo trae sus mensajes en orden cronológico y marca los editados', async () => {
    fake.set('threads', [{ id: 'a', data: head('Cisterna', 'agua', 10) }]);
    fake.set('threads/a/messages', [
      { id: 'm2', data: { authorUid: 'u2', authorUsername: 'beto', text: 'Segunda', createdAt: ts(20), editedAt: ts(25), isArchived: false } },
      { id: 'm1', data: { authorUid: 'u1', authorUsername: 'lucia', text: 'Primera', createdAt: ts(10), editedAt: null, isArchived: false, isOpening: true } },
      { id: 'm3', data: { authorUid: 'u2', authorUsername: 'beto', text: 'Oculta', createdAt: ts(30), editedAt: null, isArchived: true } },
    ]);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.messages.map((m) => [m.id, m.editedAt])).toEqual([['m1', null], ['m2', 25000]]);
    const all = await createForumSource(fakeDb).fetchThread('a', { includeArchived: true });
    expect(all?.messages).toHaveLength(3);
  });

  it('RF-5 (009): cada mensaje dice si es el de apertura, el que solo se archiva con el hilo', async () => {
    fake.set('threads', [{ id: 'a', data: head('Cisterna', 'agua', 10) }]);
    fake.set('threads/a/messages', [
      { id: 'm1', data: { authorUid: 'u1', authorUsername: 'lucia', text: 'Primera', createdAt: ts(10), editedAt: null, isArchived: false, isOpening: true } },
      { id: 'm2', data: { authorUid: 'u2', authorUsername: 'beto', text: 'Segunda', createdAt: ts(20), editedAt: null, isArchived: false } },
    ]);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.messages.map((m) => [m.id, m.isOpening])).toEqual([['m1', true], ['m2', false]]);
  });

  it('RF-7 (009) · 7.1: un hilo inexistente da null', async () => {
    expect(await createForumSource(fakeDb).fetchThread('nada', { includeArchived: false })).toBeNull();
  });
});
