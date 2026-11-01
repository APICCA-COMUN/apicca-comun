// T-9.7 · Aviso de propuestas abiertas: cuenta y cierre más próximo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, fakeDb } from './fakeFirestore';
import { createNoticeSource } from './notice';

vi.mock('firebase/firestore', async () => (await import('./fakeFirestore')).fakeFirestoreModule);

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const open = (id: string, closesAt: number) => ({ id, data: { isOpen: true, closesAt: ts(closesAt) } });

beforeEach(() => fake.reset());

describe('notice.ts', () => {
  it('RF-15 (004) · 15.1: sin propuestas abiertas no hay aviso', async () => {
    fake.set('amendments', [{ id: 'x', data: { isOpen: false, closesAt: ts(5) } }]);
    await expect(createNoticeSource(fakeDb).fetchNotice('member')).resolves.toEqual({ count: 0, nextCloseAt: null });
  });

  it('RF-15 (004) · 15.1: con tres abiertas cuenta tres y toma el cierre más próximo', async () => {
    fake.set('amendments', [open('a', 300), open('b', 120), open('c', 200), { id: 'x', data: { isOpen: false, closesAt: ts(5) } }]);
    await expect(createNoticeSource(fakeDb).fetchNotice('member')).resolves.toEqual({ count: 3, nextCloseAt: 120000 });
  });

  it('RF-15 (004) · 15.1: el visitante no pide nada', async () => {
    fake.set('amendments', [open('a', 300)]);
    await expect(createNoticeSource(fakeDb).fetchNotice('visitor')).resolves.toEqual({ count: 0, nextCloseAt: null });
    expect(fake.reads).toEqual([]);
  });
});
