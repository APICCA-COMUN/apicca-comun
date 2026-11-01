// T-9.2 · Las lecturas de secciones, estado e historiales, con un doble de Firestore.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConstitutionState, Section, SectionMeta, SectionVersion } from '../../../shared/domain/constitution';
import { createSectionsSource, orderSections, type LogEntry } from './sections';
import { fake, fakeDb } from './fakeFirestore';

vi.mock('firebase/firestore', async () => (await import('./fakeFirestore')).fakeFirestoreModule);

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const section = (id: string, isRetired = false) => ({
  id,
  data: { title: `T-${id}`, text: `texto ${id}`, updatedAt: ts(10), isRetired, retiredAt: isRetired ? ts(20) : null },
});

beforeEach(() => {
  fake.reset();
  fake.set('constitutionSections', [section('a'), section('b', true), section('c')]);
  fake.set('constitution', [{ id: 'state', data: { isOpen: true, openedAt: ts(5), order: ['c', 'b', 'a'], updatedAt: ts(30), logSeq: 2 } }]);
});

function collect<T>(subscribe: (cb: (v: T) => void) => unknown): T {
  let last: T | undefined;
  subscribe((v) => {
    last = v;
  });
  return last as T;
}

describe('sections.ts', () => {
  it('RF-2 (004) · 2.3: la consulta del visitante lleva isRetired == false y no recibe las retiradas', () => {
    const source = createSectionsSource(fakeDb);
    const sections = collect<Section[]>((cb) => source.onSections('visitor', cb));
    expect(sections.map((s) => s.id).sort()).toEqual(['a', 'c']);
    expect(fake.queries.at(-1)?.cs).toContainEqual({ t: 'where', field: 'isRetired', op: '==', value: false });
  });

  it('RF-2 (004) · 2.3: la cuenta activa pide todas, también las retiradas, con su fecha de retiro', () => {
    const source = createSectionsSource(fakeDb);
    const sections = collect<Section[]>((cb) => source.onSections('member', cb));
    expect(sections.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
    expect(sections.find((s) => s.id === 'b')).toMatchObject({ isRetired: true, retiredAt: 20000 });
  });

  it('RF-2 (004) · 2.4: el visitante no lee private, versions ni el registro', () => {
    const source = createSectionsSource(fakeDb);
    expect(collect<SectionMeta | null>((cb) => source.onMeta('visitor', 'a', cb))).toBeNull();
    expect(collect<SectionVersion[]>((cb) => source.onVersions('visitor', 'a', cb))).toEqual([]);
    expect(collect<LogEntry[]>((cb) => source.onLog('visitor', cb))).toEqual([]);
    expect(fake.reads).toEqual([]);
  });

  it('RF-2 (004) · 2.2: la cuenta activa lee autoría y propuesta abierta de private/meta', () => {
    fake.set('constitutionSections/a/private', [
      { id: 'meta', data: { version: 3, proposedByUid: 'u1', proposedByUsername: 'ana', openAmendment: { id: 'p1', kind: 'change', closesAt: ts(99) } } },
    ]);
    const meta = collect<SectionMeta | null>((cb) => createSectionsSource(fakeDb).onMeta('member', 'a', cb));
    expect(meta).toEqual({
      version: 3,
      proposedByUid: 'u1',
      proposedByUsername: 'ana',
      openAmendment: { id: 'p1', kind: 'change', closesAt: 99000 },
    });
  });

  it('RF-1 (004) · 1.1: el estado y el orden dejan las secciones en el orden de la constitución', () => {
    const source = createSectionsSource(fakeDb);
    const state = collect<ConstitutionState | null>((cb) => source.onState(cb));
    expect(state).toMatchObject({ isOpen: true, openedAt: 5000, order: ['c', 'b', 'a'], logSeq: 2 });
    const visible = collect<Section[]>((cb) => source.onSections('visitor', cb));
    expect(orderSections(state, visible).map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('RF-3 (004) · 3.2: el historial de una sección llega de la versión más reciente a la primera', () => {
    fake.set('constitutionSections/a/versions', [
      { id: '1', data: { version: 1, title: 'v1', text: 'x', kind: 'initial', amendmentId: null, proposedByUid: null, proposedByUsername: 'texto inicial', agreementsCounted: 0, authorAgreementCounted: false, objectionsResolved: 0, objectionsWithdrawn: 0, at: ts(5) } },
      { id: '2', data: { version: 2, title: 'v2', text: 'y', kind: 'change', amendmentId: 'p1', proposedByUid: 'u1', proposedByUsername: 'ana', agreementsCounted: 4, authorAgreementCounted: true, objectionsResolved: 1, objectionsWithdrawn: 2, at: ts(50) } },
    ]);
    const versions = collect<SectionVersion[]>((cb) => createSectionsSource(fakeDb).onVersions('member', 'a', cb));
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0]).toMatchObject({ kind: 'change', agreementsCounted: 4, authorAgreementCounted: true, objectionsResolved: 1, objectionsWithdrawn: 2, at: 50000 });
  });

  it('RF-3 (004) · 3.1: el registro del conjunto llega del cambio más reciente al primero, con `opened` sin sección', () => {
    fake.set('constitutionLog', [
      { id: '1', data: { seq: 1, kind: 'opened', sectionId: null, sectionTitle: null, version: null, amendmentId: null, byUid: 'f1', byUsername: 'fa', at: ts(5) } },
      { id: '2', data: { seq: 2, kind: 'changed', sectionId: 'a', sectionTitle: 'T-a', version: 2, amendmentId: 'p1', byUid: 'u1', byUsername: 'ana', at: ts(50) } },
    ]);
    const log = collect<LogEntry[]>((cb) => createSectionsSource(fakeDb).onLog('member', cb));
    expect(log.map((e) => e.seq)).toEqual([2, 1]);
    expect(log[1]).toMatchObject({ kind: 'opened', sectionId: null, version: null });
  });
});
