// T-9.4 y T-9.5 · Listas, detalle, deliberación, posturas y objeciones de las propuestas, con un doble de Firestore.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Amendment, Objection, Stance } from '../../../shared/domain/constitution';
import { createAmendmentsSource, type AmendmentComment, type AmendmentRevision } from './amendments';
import { fake, fakeDb } from './fakeFirestore';

vi.mock('firebase/firestore', async () => (await import('./fakeFirestore')).fakeFirestoreModule);

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const amendment = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  data: {
    kind: 'change', sectionId: 's1', after: null, slotKey: `s:${id}`, title: `T ${id}`, text: 'x', motive: 'm', revisionNo: 2,
    baseSectionVersion: 1, authorUid: 'u1', authorUsername: 'ana', openedAt: ts(1), closesAt: ts(100), extended: false,
    isOpen: true, result: null, reasons: [], closedAt: null, agreementsCounted: 0, objectionsResolved: 0, objectionsWithdrawn: 0,
    newSectionId: null, eventSeq: 3, ...extra,
  },
});
function collect<T>(subscribe: (cb: (v: T) => void) => unknown): T {
  let last: T | undefined;
  subscribe((v) => {
    last = v;
  });
  return last as T;
}

beforeEach(() => fake.reset());

describe('amendments.ts · listas y detalle', () => {
  it('RF-14 (004) · 14.7: authorSuspended llega tal como lo deja el servidor', () => {
    fake.set('amendments', [amendment('a', { authorSuspended: true }), amendment('b', { closesAt: ts(200) })]);
    const open = collect<Amendment[]>((cb) => createAmendmentsSource(fakeDb).onOpen(cb));
    expect(open.map((a) => a.authorSuspended)).toEqual([true, false]);
  });

  it('RF-7 (004) · 7.1: las abiertas llegan por closesAt ascendente y solo las abiertas', () => {
    fake.set('amendments', [
      amendment('tarde', { closesAt: ts(300) }),
      amendment('pronto', { closesAt: ts(50) }),
      amendment('media', { closesAt: ts(100) }),
      amendment('vieja', { isOpen: false, result: 'approved', closedAt: ts(20), closesAt: ts(10) }),
    ]);
    const open = collect<Amendment[]>((cb) => createAmendmentsSource(fakeDb).onOpen(cb));
    expect(open.map((a) => a.id)).toEqual(['pronto', 'media', 'tarde']);
    expect(open[0]).toMatchObject({ closesAt: 50000, revisionNo: 2, authorUsername: 'ana', sectionId: 's1', authorSuspended: false });
    expect(fake.queries[0]?.cs).toContainEqual({ t: 'orderBy', field: 'closesAt', direction: 'asc' });
  });

  it('RF-7 (004) · 7.2: las cerradas llegan de 20 en 20, la más reciente primero, con cursor', async () => {
    fake.set('amendments', [
      ...Array.from({ length: 23 }, (_, i) => amendment(`c${i + 1}`, { isOpen: false, result: 'rejected', closedAt: ts(i + 1) })),
      amendment('abierta'),
    ]);
    const source = createAmendmentsSource(fakeDb);
    const first = await source.fetchClosedPage({});
    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.id).toBe('c23');
    expect(first.items[0]).toMatchObject({ isOpen: false, result: 'rejected', closedAt: 23000 });
    const second = await source.fetchClosedPage({ cursor: first.cursor });
    expect(second.items.map((a) => a.id)).toEqual(['c3', 'c2', 'c1']);
    expect(second.cursor).toBeNull();
  });

  it('RF-7 (004) · 7.4: el detalle lee la propuesta y una inexistente llega como null', () => {
    fake.set('amendments', [amendment('a1', { extended: true, reasons: ['open_objection'] })]);
    const source = createAmendmentsSource(fakeDb);
    expect(collect<Amendment | null>((cb) => source.onAmendment('a1', cb))).toMatchObject({ id: 'a1', extended: true, reasons: ['open_objection'] });
    expect(collect<Amendment | null>((cb) => source.onAmendment('nada', cb))).toBeNull();
  });

  it('RF-8 (004) · 8.2: las revisiones anteriores llegan de la más reciente a la primera', () => {
    fake.set('amendments/a1/revisions', [
      { id: '1', data: { revisionNo: 1, title: 'a', text: 'x', motive: 'm1', at: ts(5) } },
      { id: '2', data: { revisionNo: 2, title: 'b', text: 'y', motive: 'm2', at: ts(9) } },
    ]);
    const revisions = collect<AmendmentRevision[]>((cb) => createAmendmentsSource(fakeDb).onRevisions('a1', cb));
    expect(revisions.map((r) => r.revisionNo)).toEqual([2, 1]);
    expect(revisions[0]).toEqual({ revisionNo: 2, title: 'b', text: 'y', motive: 'm2', at: 9000 });
  });
});

describe('amendments.ts · deliberación y posturas', () => {
  it('RF-9 (004) · 9.2: los comentarios archivados llegan marcados y con su texto, no vacíos', () => {
    fake.set('amendments/a1/comments', [
      { id: 'c2', data: { text: 'segundo', authorUid: 'u3', authorUsername: 'beto', createdAt: ts(20), editedAt: ts(25), version: 2, archived: false, archivedBy: null } },
      { id: 'c1', data: { text: 'primero', authorUid: 'u2', authorUsername: 'cris', createdAt: ts(10), editedAt: null, version: 1, archived: true, archivedBy: 'f1', archivedByUsername: 'fa', archivedAt: ts(30) } },
    ]);
    const comments = collect<AmendmentComment[]>((cb) => createAmendmentsSource(fakeDb).onComments('a1', cb));
    expect(comments.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(comments[0]).toMatchObject({ text: 'primero', archived: true, archivedBy: 'f1', archivedByUsername: 'fa', archivedAt: 30000 });
    expect(comments[1]).toMatchObject({ archived: false, archivedBy: null, editedAt: 25000, version: 2 });
  });

  it('RF-11 (004) · 11.1: las posturas llevan el acuerdo, la revisión en que se dio y la objeción abierta', () => {
    fake.set('amendments/a1/stances', [
      { id: 'u2', data: { username: 'cris', agreement: 'active', agreedAtRevision: 1, agreedAt: ts(11), openObjectionId: null, withdrawnReason: null } },
      { id: 'u3', data: { username: 'beto', agreement: 'withdrawn', agreedAtRevision: 2, agreedAt: ts(12), openObjectionId: 'o1', withdrawnReason: 'inactive' } },
    ]);
    const stances = collect<Stance[]>((cb) => createAmendmentsSource(fakeDb).onStances('a1', cb));
    expect(stances).toContainEqual({ uid: 'u2', username: 'cris', agreement: 'active', agreedAtRevision: 1, agreedAt: 11000, openObjectionId: null, withdrawnReason: null });
    expect(stances.find((s) => s.uid === 'u3')).toMatchObject({ agreement: 'withdrawn', withdrawnReason: 'inactive', openObjectionId: 'o1' });
  });

  it('RF-10 (004) · 10.1: las objeciones llegan en orden de apertura con su estado y cómo se cerraron', () => {
    fake.set('amendments/a1/objections', [
      { id: 'o2', data: { uid: 'u3', username: 'beto', reason: 'no', status: 'open', openedAt: ts(40), closedAt: null, resolvedByRevision: null, closedBy: null } },
      { id: 'o1', data: { uid: 'u2', username: 'cris', reason: 'tal vez', status: 'resolved', openedAt: ts(30), closedAt: ts(35), resolvedByRevision: 2, closedBy: 'author' } },
    ]);
    const objections = collect<Objection[]>((cb) => createAmendmentsSource(fakeDb).onObjections('a1', cb));
    expect(objections.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(objections[0]).toMatchObject({ status: 'resolved', resolvedByRevision: 2, closedBy: 'author', closedAt: 35000 });
    expect(objections[1]).toMatchObject({ status: 'open', closedBy: null });
  });
});
