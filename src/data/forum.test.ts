// RF-1 (018) · 1.1 a 1.3, D-T3 (018), D-T4 (018) · T-4 (009) · Fuente del foro: lista por tandas con filtro de eje, y un hilo con sus mensajes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, fakeDb } from './constitution/fakeFirestore';
import { latestMessagesQuery, openingMessageQuery } from '../../shared/domain/forum/queries';
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
    expect(found?.opening?.id).toBe('m1');
    expect(found?.messages.map((m) => [m.id, m.editedAt])).toEqual([['m2', 25000]]);
    const all = await createForumSource(fakeDb).fetchThread('a', { includeArchived: true });
    expect(all?.messages.map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('RF-5 (009): cada mensaje dice si es el de apertura, el que solo se archiva con el hilo', async () => {
    fake.set('threads', [{ id: 'a', data: head('Cisterna', 'agua', 10) }]);
    fake.set('threads/a/messages', [
      { id: 'm1', data: { authorUid: 'u1', authorUsername: 'lucia', text: 'Primera', createdAt: ts(10), editedAt: null, isArchived: false, isOpening: true } },
      { id: 'm2', data: { authorUid: 'u2', authorUsername: 'beto', text: 'Segunda', createdAt: ts(20), editedAt: null, isArchived: false } },
    ]);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.opening).toMatchObject({ id: 'm1', isOpening: true });
    expect(found?.messages.map((m) => [m.id, m.isOpening])).toEqual([['m2', false]]);
  });

  it('RF-7 (009) · 7.1: un hilo inexistente da null', async () => {
    expect(await createForumSource(fakeDb).fetchThread('nada', { includeArchived: false })).toBeNull();
  });

  it('RF-1 (018) · 1.1: las consultas de la apertura y de la página reciente son las formas declaradas, las que tienen índice (D-T2 (018))', async () => {
    fake.set('threads', [{ id: 'a', data: head('Cisterna', 'agua', 10) }]);
    fake.set('threads/a/messages', []);
    for (const includeArchived of [false, true]) {
      fake.queries.length = 0;
      await createForumSource(fakeDb).fetchThread('a', { includeArchived });
      const asked = fake.queries.filter((q) => q.path === 'threads/a/messages');
      const shapes = [openingMessageQuery({ includeArchived }), latestMessagesQuery({ includeArchived })];
      expect(asked).toHaveLength(2);
      shapes.forEach((shape, i) => {
        expect(asked[i]!.cs).toEqual([
          ...shape.conditions.map((c) => ({ t: 'where', field: c.field, op: c.op, value: c.value })),
          { t: 'orderBy', field: shape.orderBy.field, direction: shape.orderBy.direction },
          { t: 'limit', n: shape.limit },
        ]);
      });
    }
  });

  it('RF-1 (017) · 1.3: un hilo archivado sin permiso de moderar no pide sus mensajes', async () => {
    fake.set('threads', [{ id: 'a', data: head('Cisterna', 'agua', 10, { isArchived: true }) }]);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.thread.isArchived).toBe(true);
    expect(found?.messages).toEqual([]);
    expect(found?.opening).toBeNull();
    expect(fake.queries.some((q) => q.path === 'threads/a/messages')).toBe(false);
  });

  const seed = (count: number, withOpening = true) => {
    fake.set('threads', [{ id: 'a', data: head('Larga', 'agua', 10) }]);
    fake.set(
      'threads/a/messages',
      Array.from({ length: count }, (_, i) => ({
        id: `m${String(i).padStart(3, '0')}`,
        data: { authorUid: 'u1', authorUsername: 'lucia', text: `Mensaje ${i}`, createdAt: ts(10 + i), editedAt: null, isArchived: false, isOpening: withOpening && i === 0 },
      })),
    );
  };

  it('RF-1 (018) · 1.1: abrir un hilo largo trae la apertura y los 50 mensajes más recientes, y lee como mucho 51 (D-T3 (018))', async () => {
    seed(120);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.opening?.id).toBe('m000');
    expect(found?.messages).toHaveLength(50);
    expect(found?.messages[0]?.id).toBe('m070');
    expect(found?.messages[49]?.id).toBe('m119');
    expect(found?.before).not.toBeNull();
  });

  it('RF-1 (018) · 1.3: un hilo corto no tiene mensajes anteriores', async () => {
    seed(30);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.messages).toHaveLength(29);
    expect(found?.before).toBeNull();
  });

  it('RF-1 (018) · 1.2: la página llena que trae la apertura no deja cursor (D-T4 (018))', async () => {
    seed(50);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.opening?.id).toBe('m000');
    expect(found?.messages).toHaveLength(49);
    expect(found?.before).toBeNull();
  });

  it('RF-1 (018) · 1.2: «anteriores» sigue desde el cursor, en orden cronológico, y la última página no repite la apertura', async () => {
    seed(120);
    const source = createForumSource(fakeDb);
    const first = await source.fetchThread('a', { includeArchived: false });
    const second = await source.fetchOlder('a', { includeArchived: false, before: first!.before! });
    expect(second.messages.map((m) => m.id)).toEqual(Array.from({ length: 50 }, (_, i) => `m${String(20 + i).padStart(3, '0')}`));
    expect(second.before).not.toBeNull();
    const third = await source.fetchOlder('a', { includeArchived: false, before: second.before! });
    expect(third.messages.map((m) => m.id)).toEqual(Array.from({ length: 19 }, (_, i) => `m${String(1 + i).padStart(3, '0')}`));
    expect(third.messages.some((m) => m.isOpening)).toBe(false);
    expect(third.before).toBeNull();
  });

  it('RF-1 (018) · 1.2: si la página anterior llega justo a la apertura, la descarta aunque venga llena', async () => {
    seed(100);
    const source = createForumSource(fakeDb);
    const first = await source.fetchThread('a', { includeArchived: false });
    const second = await source.fetchOlder('a', { includeArchived: false, before: first!.before! });
    expect(second.messages).toHaveLength(49);
    expect(second.messages.some((m) => m.isOpening)).toBe(false);
    expect(second.before).toBeNull();
  });

  it('RF-1 (018) · 1.1: un hilo sin mensaje de apertura no falla y muestra sus mensajes', async () => {
    seed(3, false);
    const found = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(found?.opening).toMatchObject({ id: 'm000' });
    expect(found?.messages).toHaveLength(2);
    fake.set('threads/a/messages', []);
    const empty = await createForumSource(fakeDb).fetchThread('a', { includeArchived: false });
    expect(empty).toMatchObject({ opening: null, messages: [], before: null });
  });
});
