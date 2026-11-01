// RF-4 (004) · 4.1–4.3, 4.5, 4.6, 4.10; RF-17 (004) · 17.1: la constitución sin abrir, la apertura y el error al guardar.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiClientError } from '../data/api';
import { expectOnePrimary } from '../testing/expectActions';
import { fakeClient } from '../testing/facilitationDoubles';
import type { ConstitutionState, Section, SectionMeta } from '../../shared/domain/constitution';
import { SessionProvider, type SessionState } from '../app/session';
import type { SectionsSource } from '../data/constitution/sections';
import { ConstitutionPage } from './ConstitutionPage';

afterEach(() => window.history.replaceState(null, '', '/'));

const noDocs = { fetchPage: async () => ({ items: [], cursor: null }), onDocument: () => () => undefined, onVersions: () => () => undefined };
const settle = async () => undefined;

function mount(session: SessionState, init: Parameters<typeof fakeSections>[0], client = fakeClient({}).client) {
  const { source } = fakeSections(init);
  return render(withSession(session, <ConstitutionPage sectionsSource={source} documentsSource={noDocs} client={client} settle={settle} />));
}

describe('ConstitutionPage, sin abrir y apertura (004)', () => {
  it('RF-4 (004) · 4.1: sin abrir, avisa si aún no está redactada y de que las propuestas llegan con la apertura', async () => {
    mount(member, { state: stateOf(), sections: [] });
    expect(await screen.findByText(/aún no está redactada/)).toBeTruthy();
    expect(screen.getByText(/propuestas de cambio llegan con la apertura/)).toBeTruthy();
    expectOnePrimary(document.body, null);
  });

  it('RF-4 (004) · 4.1: el facilitador ve «Guardar sección» como único azul; «Quitar sección» y «Abrir la constitución» son destructivas', async () => {
    mount(facilitator, { state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] });
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expectOnePrimary(document.body, 'Guardar sección');
    expect(screen.getByRole('button', { name: 'Quitar sección' }).className).toContain('action-destructive');
    expect(screen.getByRole('button', { name: 'Abrir la constitución' }).className).toContain('action-destructive');
  });

  it('RF-4 (004) · 4.2: el facilitador crea una sección con título y texto', async () => {
    const { client, calls } = fakeClient({ saveSection: () => ({ id: 'n1' }) });
    mount(facilitator, { state: stateOf(), sections: [] }, client);
    await screen.findByText(/aún no está redactada/);
    await userEvent.type(screen.getByLabelText('Título de la sección'), 'Cuidado');
    await userEvent.type(screen.getByLabelText('Texto de la sección'), 'Nos cuidamos.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'saveSection', payload: { title: 'Cuidado', text: 'Nos cuidamos.' } }]));
  });

  it('RF-4 (004) · 4.2: «Quitar sección» pide confirmación antes de llamar', async () => {
    const { client, calls } = fakeClient({ removeSection: () => ({}) });
    mount(facilitator, { state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] }, client);
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar sección' }));
    expect(calls).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar quitar' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'removeSection', payload: { id: 'a' } }]));
  });

  it('RF-4 (004) · 4.3: confirmar la apertura llama a openConstitution; cancelar no llama', async () => {
    const { client, calls } = fakeClient({ openConstitution: () => ({}) });
    mount(facilitator, { state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] }, client);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir la constitución' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar apertura' }));
    expect(calls).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la constitución' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar apertura' }));
    await waitFor(() => expect(calls).toEqual([{ op: 'openConstitution', payload: {} }]));
  });

  it('RF-4 (004) · 4.5: si la apertura es rechazada por una apertura previa, muestra el motivo en español', async () => {
    const { client } = fakeClient({ openConstitution: () => { throw new ApiClientError('constitution-open'); } });
    mount(facilitator, { state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] }, client);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir la constitución' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar apertura' }));
    expect((await screen.findByRole('alert')).textContent).toContain('La constitución ya está abierta');
  });

  it('RF-4 (004) · 4.6: con la constitución abierta no hay apertura ni edición directa', async () => {
    mount(facilitator, { state: stateOf({ isOpen: true, order: ['a'] }), sections: [sec('a', 'Uno')] });
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expect(screen.queryByRole('button', { name: 'Abrir la constitución' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar sección' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar sección' })).toBeNull();
  });

  it('RF-4 (004) · 4.10: «Abrir la constitución» es destructiva y pide confirmación antes de aplicarse', async () => {
    const { client, calls } = fakeClient({ openConstitution: () => ({}) });
    mount(facilitator, { state: stateOf({ order: ['a'] }), sections: [sec('a', 'Uno')] }, client);
    const open = await screen.findByRole('button', { name: 'Abrir la constitución' });
    expect(open.className).toContain('action-destructive');
    expect(open.className).not.toContain('action-primary');
    await userEvent.click(open);
    expect(calls).toEqual([]);
    expect(screen.getByRole('button', { name: 'Confirmar apertura' }).className).toContain('action-destructive');
  });

  it('RF-4 (004) · 4.10: abierta, la cuenta activa ve «Abrir propuesta» como único azul', async () => {
    mount(member, { state: stateOf({ isOpen: true, order: ['a'] }), sections: [sec('a', 'Uno')] });
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expectOnePrimary(document.body, 'Abrir propuesta');
    expect(screen.getByRole('link', { name: 'Abrir propuesta' }).getAttribute('href')).toBe('/constitucion/propuestas');
  });

  it('RF-4 (004) · 4.10: el visitante no ve «Abrir propuesta» ni ningún azul', async () => {
    mount(visitor, { state: stateOf({ isOpen: true, order: ['a'] }), sections: [sec('a', 'Uno')] });
    await screen.findByRole('heading', { level: 2, name: 'Uno' });
    expectOnePrimary(document.body, null);
  });

  it('RF-17 (004) · 17.1: si guardar la sección falla, muestra el motivo en español y conserva lo escrito', async () => {
    const { client } = fakeClient({ saveSection: () => { throw new ApiClientError('constitution-open'); } });
    mount(facilitator, { state: stateOf(), sections: [] }, client);
    await screen.findByText(/aún no está redactada/);
    await userEvent.type(screen.getByLabelText('Título de la sección'), 'Cuidado');
    await userEvent.type(screen.getByLabelText('Texto de la sección'), 'Nos cuidamos.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/La constitución ya está abierta/);
    expect((screen.getByLabelText('Título de la sección') as HTMLInputElement).value).toBe('Cuidado');
    expect((screen.getByLabelText('Texto de la sección') as HTMLTextAreaElement).value).toBe('Nos cuidamos.');
  });

  it('RF-17 (004) · 17.1: un fallo sin código también da un mensaje en español y conserva lo escrito', async () => {
    const { client } = fakeClient({ saveSection: () => { throw new Error('boom'); } });
    mount(facilitator, { state: stateOf(), sections: [] }, client);
    await screen.findByText(/aún no está redactada/);
    await userEvent.type(screen.getByLabelText('Título de la sección'), 'Cuidado');
    await userEvent.type(screen.getByLabelText('Texto de la sección'), 'Nos cuidamos.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/No se pudo guardar/);
    expect((screen.getByLabelText('Texto de la sección') as HTMLTextAreaElement).value).toBe('Nos cuidamos.');
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
