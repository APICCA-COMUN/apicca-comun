// RF-5 (004) · 5.1, 5.3; RF-17 (004) · 17.1; RNF-4 (004): lista de documentos bajo la constitución y diálogo de creación.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../data/api';
import type { DocumentCursor, DocumentsSource, ListedDocument } from '../data/constitution/documents';
import { expectOnePrimary } from '../testing/expectActions';
import { fakeClient } from '../testing/facilitationDoubles';
import type { ConstitutionState, Section, SectionMeta } from '../../shared/domain/constitution';
import { SessionProvider, type SessionState } from '../app/session';
import type { SectionsSource } from '../data/constitution/sections';
import { ConstitutionPage } from './ConstitutionPage';

const settle = async () => undefined;

/** `total` documentos, de los cuales los que `archivedFrom` en adelante están archivados; la fuente pagina de 20 en 20. */
function fakeDocuments(live: number, archived = 0) {
  const all = [
    ...Array.from({ length: live }, (_, i) => ({ id: `d${i + 1}`, title: `Documento ${i + 1}`, archived: false })),
    ...Array.from({ length: archived }, (_, i) => ({ id: `x${i + 1}`, title: `Archivado ${i + 1}`, archived: true })),
  ];
  const requests: Array<{ archived: boolean; cursor: unknown }> = [];
  const source: DocumentsSource = {
    async fetchPage({ archived, cursor }) {
      requests.push({ archived, cursor: cursor ?? null });
      const rows = all.filter((d) => d.archived === archived);
      const from = typeof cursor === 'number' ? cursor : 0;
      const slice = rows.slice(from, from + 20);
      const items: ListedDocument[] = slice.map((d, i) => ({
        id: d.id, title: d.title, excerpt: `Extracto de ${d.title}`, updatedAt: T0 + i, version: 1,
      }));
      return { items, cursor: (from + 20 < rows.length ? from + 20 : null) as unknown as DocumentCursor | null };
    },
    onDocument: () => () => undefined,
    onVersions: () => () => undefined,
  };
  return { source, requests };
}

function mount(session: SessionState, documents: DocumentsSource, client = fakeClient({}).client) {
  const { source } = fakeSections({ state: stateOf({ isOpen: true, order: ['a'] }), sections: [sec('a', 'Uno')] });
  return render(withSession(session, <ConstitutionPage sectionsSource={source} documentsSource={documents} client={client} settle={settle} />));
}

const items = () => screen.queryAllByRole('listitem').filter((li) => li.closest('.constitution__documents') !== null);

describe('ConstitutionPage, documentos (004)', () => {
  it('RF-5 (004) · 5.1: con 45 documentos lista páginas de 20, 20 y 5, sin los archivados', async () => {
    const { source, requests } = fakeDocuments(45, 3);
    mount(visitor, source);
    await waitFor(() => expect(items()).toHaveLength(20));
    expect(requests[0]).toEqual({ archived: false, cursor: null });
    expect(screen.queryByText(/Archivado/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ver más documentos' }));
    await waitFor(() => expect(items()).toHaveLength(40));
    await userEvent.click(screen.getByRole('button', { name: 'Ver más documentos' }));
    await waitFor(() => expect(items()).toHaveLength(45));
    expect(screen.queryByRole('button', { name: 'Ver más documentos' })).toBeNull();
    expect(requests.every((r) => r.archived === false)).toBe(true);
  });

  it('RF-5 (004) · 5.1: cada documento muestra título enlazado, fecha y extracto', async () => {
    const { source } = fakeDocuments(1);
    mount(visitor, source);
    const link = await screen.findByRole('link', { name: 'Documento 1' });
    expect(link.getAttribute('href')).toBe('/constitucion/documentos/d1');
    const row = link.closest('li') as HTMLElement;
    expect(row.textContent).toContain('2026-09-03');
    expect(row.textContent).toContain('Extracto de Documento 1');
  });

  it('RF-5 (004) · 5.3: «Crear documento» solo aparece al facilitador, en un diálogo con un único azul', async () => {
    const { source } = fakeDocuments(0);
    const view = mount(member, source);
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expect(screen.queryByRole('button', { name: 'Nuevo documento' })).toBeNull();
    view.unmount();
    mount(facilitator, fakeDocuments(0).source);
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo documento' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Crear documento' })).toBeTruthy();
    expectOnePrimary(document.body, 'Crear documento');
  });

  it('RF-5 (004) · 5.3: título o texto vacíos se rechazan con el mensaje en español y se conserva lo escrito', async () => {
    const { client, calls } = fakeClient({ saveDocument: () => ({ ok: true, id: 'n', version: 1 }) });
    mount(facilitator, fakeDocuments(0).source, client);
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo documento' }));
    await userEvent.type(screen.getByLabelText('Título del documento'), 'Guía de acogida');
    await userEvent.click(screen.getByRole('button', { name: 'Crear documento' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/texto/i);
    expect((screen.getByLabelText('Título del documento') as HTMLInputElement).value).toBe('Guía de acogida');
    expect(calls).toEqual([]);
    await userEvent.clear(screen.getByLabelText('Título del documento'));
    await userEvent.type(screen.getByLabelText('Texto del documento'), 'Cómo recibimos a quien llega.');
    await userEvent.click(screen.getByRole('button', { name: 'Crear documento' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/título/i);
    expect((screen.getByLabelText('Texto del documento') as HTMLTextAreaElement).value).toBe('Cómo recibimos a quien llega.');
    expect(calls).toEqual([]);
  });

  it('RF-5 (004) · 5.3: con título y texto llama a saveDocument y cierra el diálogo', async () => {
    const { client, calls } = fakeClient({ saveDocument: () => ({ ok: true, id: 'n', version: 1 }) });
    mount(facilitator, fakeDocuments(0).source, client);
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo documento' }));
    await userEvent.type(screen.getByLabelText('Título del documento'), 'Guía');
    await userEvent.type(screen.getByLabelText('Texto del documento'), 'Texto.');
    await userEvent.click(screen.getByRole('button', { name: 'Crear documento' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'saveDocument', payload: { title: 'Guía', text: 'Texto.' } }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('RF-17 (004) · 17.1: si crear el documento falla, muestra el motivo y conserva lo escrito', async () => {
    const { client } = fakeClient({ saveDocument: () => { throw new ApiClientError('constitution-open'); } });
    mount(facilitator, fakeDocuments(0).source, client);
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo documento' }));
    await userEvent.type(screen.getByLabelText('Título del documento'), 'Guía');
    await userEvent.type(screen.getByLabelText('Texto del documento'), 'Texto.');
    await userEvent.click(screen.getByRole('button', { name: 'Crear documento' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya está abierta/);
    expect((screen.getByLabelText('Texto del documento') as HTMLTextAreaElement).value).toBe('Texto.');
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
