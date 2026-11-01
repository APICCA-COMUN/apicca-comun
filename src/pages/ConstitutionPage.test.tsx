import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import type { ConstitutionState, Section, SectionMeta } from '../../shared/domain/constitution';
import { SessionProvider, type SessionState } from '../app/session';
import type { SectionsSource } from '../data/constitution/sections';
import { ConstitutionPage } from './ConstitutionPage';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('ConstitutionPage (003)', () => {
  it('RF-15 (003) · 15.2, RF-1 (004) · 1.3: sin secciones no hay texto de respaldo, solo el aviso de que aún no está redactada', async () => {
    const { source } = fakeSections({ state: stateOf(), sections: [] });
    const { container } = render(withSession(visitor, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} />));
    expect(await screen.findByText('La constitución aún no está redactada.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Constitución de APICCA COMÚN' })).toBeTruthy();
    expect(screen.queryByText('Texto de respaldo')).toBeNull();
    expect(container.querySelectorAll('.constitution__principle')).toHaveLength(0);
    expect(container.querySelector('.constitution__note')).toBeNull();
  });

  it('RF-11 (008) · 11.2: la entrada del lienzo va bajo el título, aunque aún no haya secciones', () => {
    const { container } = render(<ConstitutionPage />);
    expect(container.querySelector('.constitution__lead')!.textContent).toBe(
      'Siete principios mandan sobre todo lo demás: sobre cada función, cada spec y cada línea de código.',
    );
  });

  it('RF-15 (003) · 15.3: enlaza a la documentación, artículo «Constitución y propuestas»', () => {
    render(<ConstitutionPage />);
    const link = screen.getByRole('link', { name: /Constitución y propuestas/ });
    expect(link.getAttribute('href')).toBe('/documentacion/constitucion-y-propuestas');
  });

  it('RF-3 (003) · 3.3: sin bloques anidados', () => {
    const { container } = render(<ConstitutionPage />);
    expectBlocks(container, { nesting: true });
  });
});

export const T0 = Date.parse('2026-09-03T15:00:00Z');
export const sec = (id: string, title: string, text = `Texto de ${title}.`, updatedAt = T0): Section => ({
  id, title, text, updatedAt, isRetired: false, retiredAt: null,
});
export const stateOf = (over: Partial<ConstitutionState> = {}): ConstitutionState => ({
  isOpen: false, openedAt: null, order: [], updatedAt: T0, logSeq: 0, ...over,
});
export const meta = (over: Partial<SectionMeta> = {}): SectionMeta => ({
  version: 3, proposedByUid: 'u1', proposedByUsername: 'ana', openAmendment: null, ...over,
});

export function fakeSections(init: { state?: ConstitutionState | null; sections?: Section[]; metas?: Record<string, SectionMeta> } = {}) {
  const audiences: string[] = [];
  const metaCalls: string[] = [];
  const source: SectionsSource = {
    onState: (cb) => { cb(init.state ?? null); return () => undefined; },
    onSections: (audience, cb) => { audiences.push(audience); cb(init.sections ?? []); return () => undefined; },
    onMeta: (audience, id, cb) => { metaCalls.push(`${audience}:${id}`); cb(audience === 'visitor' ? null : (init.metas?.[id] ?? null)); return () => undefined; },
    onVersions: (_a, _id, cb) => { cb([]); return () => undefined; },
    onLog: (_a, cb) => { cb([]); return () => undefined; },
  };
  return { source, audiences, metaCalls };
}

export const visitor: SessionState = { status: 'visitor' };
export const member: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
export const facilitator: SessionState = { status: 'person', uid: 'f1', role: 'facilitator', username: 'fabi' };
export const withSession = (session: SessionState, ui: React.ReactNode) => <SessionProvider initial={session}>{ui}</SessionProvider>;

const noDocs = { fetchPage: async () => ({ items: [], cursor: null }), onDocument: () => () => undefined, onVersions: () => () => undefined };

describe('ConstitutionPage, lectura de Firestore (004)', () => {
  it('RF-1 (004) · 1.2: las secciones salen en el orden del estado, con la fecha de la última modificación del conjunto', async () => {
    const { source } = fakeSections({
      state: stateOf({ isOpen: true, order: ['b', 'a'], updatedAt: Date.parse('2026-10-05T15:00:00Z') }),
      sections: [sec('a', 'Primera'), sec('b', 'Segunda')],
    });
    render(withSession(visitor, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} />));
    const headings = await screen.findAllByRole('heading', { level: 2, name: /Primera|Segunda/ });
    expect(headings.map((h) => h.textContent)).toEqual(['Segunda', 'Primera']);
    expect(screen.getByText(/Última modificación: 2026-10-05/)).toBeTruthy();
  });

  it('RF-1 (004) · 1.3: sin ninguna sección vigente la página lo indica', async () => {
    const { source } = fakeSections({ state: stateOf({ isOpen: true }), sections: [] });
    render(withSession(visitor, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} />));
    expect(await screen.findByText(/No queda ninguna sección vigente/)).toBeTruthy();
  });

  it('RF-11 (005) · 11.1 a 11.3: cada sección es una tarjeta con su número en texto y el color cíclico de un eje, sin lote', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const { source } = fakeSections({
      state: stateOf({ isOpen: true, order: ids }),
      sections: ids.map((id) => sec(id, `Sección ${id}`)),
    });
    const { container } = render(withSession(visitor, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} />));
    await screen.findAllByRole('heading', { level: 2, name: /^Sección/ });
    expect(container.querySelector('.lot')).toBeNull();
    const cards = [...container.querySelectorAll<HTMLElement>('article.section-block')];
    expect(cards).toHaveLength(6);
    const numbers = cards.map((card) => card.querySelector<HTMLElement>('.section-block__number'));
    expect(numbers.map((n) => n?.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(numbers.map((n) => n?.getAttribute('data-axis'))).toEqual([
      'agua', 'alimento', 'cobijo', 'energía', 'comunicación', 'agua',
    ]);
    for (const card of cards) expect(card.classList.contains('block')).toBe(true);
    expect(container.querySelectorAll('.constitution__node [data-testid="node"]')).toHaveLength(6);
  });

  it('RF-2 (004) · 2.1: quien no tiene cuenta activa ve título, texto y fecha, y no pide autoría ni historiales', async () => {
    const { source, audiences, metaCalls } = fakeSections({
      state: stateOf({ isOpen: true, order: ['a'] }),
      sections: [sec('a', 'Cuidado mutuo', 'Nos cuidamos.')],
      metas: { a: meta() },
    });
    const { container } = render(withSession(visitor, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} />));
    await screen.findByRole('heading', { level: 2, name: 'Cuidado mutuo' });
    expect(screen.getByText('Nos cuidamos.')).toBeTruthy();
    expect(container.textContent).toContain('2026-09-03');
    expect(container.textContent).not.toContain('Versión');
    expect(screen.queryByRole('link', { name: 'Historial general' })).toBeNull();
    expect(audiences).toEqual(['visitor']);
    expect(metaCalls.every((c) => c.startsWith('visitor:'))).toBe(true);
  });

  it('RF-2 (004) · 2.2: la cuenta activa ve además versión, autoría y enlaces a los historiales', async () => {
    const { source, audiences } = fakeSections({
      state: stateOf({ isOpen: true, order: ['a'] }),
      sections: [sec('a', 'Cuidado mutuo')],
      metas: { a: meta({ version: 4, proposedByUsername: 'beto' }) },
    });
    render(withSession(member, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} settle={async () => undefined} />));
    expect(await screen.findByText(/Versión 4/)).toBeTruthy();
    expect(screen.getByText(/Por beto/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Historial general' }).getAttribute('href')).toBe('/constitucion/historial');
    expect(audiences).toEqual(['member']);
  });

  it('RF-12 (004) · 12.5: la cuenta activa llama a settleAmendments antes de leer; el visitante no', async () => {
    const settle = vi.fn(async () => undefined);
    const a = fakeSections({ state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] });
    render(withSession(member, <ConstitutionPage sectionsSource={a.source} documentsSource={noDocs} settle={settle} />));
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expect(settle).toHaveBeenCalledTimes(1);
    cleanup();
    const settle2 = vi.fn(async () => undefined);
    const b = fakeSections({ state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] });
    render(withSession(visitor, <ConstitutionPage sectionsSource={b.source} documentsSource={noDocs} settle={settle2} />));
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    await waitFor(() => expect(settle2).not.toHaveBeenCalled());
  });

  it('RF-15 (004) · 15.1: la cuenta activa ve el aviso de propuestas abiertas; el visitante no lo pide', async () => {
    const fetchNotice = vi.fn(async () => ({ count: 2, nextCloseAt: T0 }));
    const a = fakeSections({ state: stateOf({ order: ['a'], isOpen: true }), sections: [sec('a', 'Uno')] });
    render(withSession(member, <ConstitutionPage sectionsSource={a.source} documentsSource={noDocs} noticeSource={{ fetchNotice }} settle={async () => undefined} />));
    expect(await screen.findByText(/Hay 2 propuestas abiertas/)).toBeTruthy();
    expect(fetchNotice).toHaveBeenCalledWith('member');
    cleanup();
    const fetch2 = vi.fn(async () => ({ count: 2, nextCloseAt: T0 }));
    const b = fakeSections({ state: stateOf({ order: ['a'], isOpen: true }), sections: [sec('a', 'Uno')] });
    render(withSession(visitor, <ConstitutionPage sectionsSource={b.source} documentsSource={noDocs} noticeSource={{ fetchNotice: fetch2 }} settle={async () => undefined} />));
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expect(fetch2).not.toHaveBeenCalled();
    expect(screen.queryByText(/propuestas abiertas/)).toBeNull();
  });

  it('RF-3 (003) · 3.3: con secciones de Firestore tampoco hay bloques anidados', async () => {
    const { source } = fakeSections({ state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] });
    const { container } = render(withSession(member, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} settle={async () => undefined} />));
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expectBlocks(container, { nesting: true });
  });
});
