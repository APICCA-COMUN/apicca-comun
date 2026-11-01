// T-5 (012) · Fuente de avisos: ápices (notices/{uid}/items), constitución (amendments) y marca de lectura.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, fakeDb } from './constitution/fakeFirestore';
import { createNoticesSource } from './notices';

vi.mock('firebase/firestore', async () => (await import('./constitution/fakeFirestore')).fakeFirestoreModule);

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const NOW = Date.UTC(2026, 9, 10, 12);
const sec = (ms: number) => Math.floor(ms / 1000);

beforeEach(() => fake.reset());

describe('notices.ts', () => {
  it('RF-1 (012): lee los avisos de ápices de la persona con ápice, quién y fecha', async () => {
    fake.set('notices/ana/items', [
      { id: 'n1', data: { type: 'apice-editado', apiceId: 'a1', apiceName: 'Huerta', actorUsername: 'beto', createdAt: ts(sec(NOW - 1000)) } },
      { id: 'n2', data: { type: 'apice-archivado', apiceId: 'a2', apiceName: 'Pozo', actorUsername: 'fabi', createdAt: ts(sec(NOW - 5000)) } },
    ]);
    const { notices } = await createNoticesSource(fakeDb, () => NOW).fetchNotices('ana');
    expect(notices).toEqual([
      { id: 'n1', type: 'apice-editado', at: sec(NOW - 1000) * 1000, href: '/apices/a1', actor: 'beto', subject: 'Huerta' },
      { id: 'n2', type: 'apice-archivado', at: sec(NOW - 5000) * 1000, href: '/apices/a2', actor: 'fabi', subject: 'Pozo' },
    ]);
  });

  it('RF-2 (012): una propuesta abierta y una resuelta son dos avisos de constitución', async () => {
    fake.set('amendments', [
      { id: 'p1', data: { title: 'Agua', authorUsername: 'ana', openedAt: ts(sec(NOW - 3000)), closedAt: null, isOpen: true, result: null } },
      { id: 'p2', data: { title: 'Aire', authorUsername: 'beto', openedAt: ts(sec(NOW - 9000)), closedAt: ts(sec(NOW - 2000)), isOpen: false, result: 'approved' } },
    ]);
    const { notices } = await createNoticesSource(fakeDb, () => NOW).fetchNotices('ana');
    expect(notices.map((n) => [n.id, n.type, n.href])).toEqual([
      ['am-closed-p2', 'constitucion-resuelta', '/constitucion/propuestas/p2'],
      ['am-open-p1', 'constitucion-abierta', '/constitucion/propuestas/p1'],
      ['am-open-p2', 'constitucion-abierta', '/constitucion/propuestas/p2'],
    ]);
  });

  it('RF-3 (012): devuelve la marca de lectura de la cuenta, o null si no hay', async () => {
    fake.set('accounts', [{ id: 'ana', data: { noticesSeenAt: ts(sec(NOW - 500)) } }, { id: 'beto', data: {} }]);
    expect((await createNoticesSource(fakeDb, () => NOW).fetchNotices('ana')).seenAt).toBe(sec(NOW - 500) * 1000);
    expect((await createNoticesSource(fakeDb, () => NOW).fetchNotices('beto')).seenAt).toBeNull();
  });

  it('RNF-4 (012): no muestra avisos de hace más de 90 días', async () => {
    fake.set('notices/ana/items', [
      { id: 'viejo', data: { type: 'apice-editado', apiceId: 'a1', apiceName: 'X', actorUsername: 'b', createdAt: ts(sec(NOW - 91 * 86400000)) } },
    ]);
    expect((await createNoticesSource(fakeDb, () => NOW).fetchNotices('ana')).notices).toEqual([]);
  });
});
