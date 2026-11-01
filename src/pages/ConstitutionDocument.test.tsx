import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import { ApiClientError } from '../data/api';
import type { DocumentDoc, DocumentsSource, DocumentVersion } from '../data/constitution/documents';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { fakeClient } from '../testing/facilitationDoubles';
import { ConstitutionDocument } from './ConstitutionDocument';

afterEach(cleanup);

const doc = (extra: Partial<DocumentDoc> = {}): DocumentDoc => ({
  id: 'd1',
  title: 'Reglamento de huertas',
  text: 'Se riega **antes** del mediodía.',
  version: 2,
  createdAt: Date.parse('2026-09-01T15:00:00Z'),
  updatedAt: Date.parse('2026-09-03T15:00:00Z'),
  isArchived: false,
  ...extra,
});

const versions: DocumentVersion[] = [
  { version: 2, title: 'Reglamento de huertas', text: 'v2', byUid: 'fab', byUsername: 'fabi', at: Date.parse('2026-09-03T15:00:00Z') },
  { version: 1, title: 'Reglamento', text: 'v1', byUid: 'fab', byUsername: 'fabi', at: Date.parse('2026-09-01T15:00:00Z') },
];

function fakeSource(initial: DocumentDoc | null) {
  let listener: ((d: DocumentDoc | null) => void) | null = null;
  const onVersions = vi.fn((_id: string, callback: (v: DocumentVersion[]) => void) => {
    callback(versions);
    return () => {};
  });
  const source: DocumentsSource = {
    fetchPage: async () => ({ items: [], cursor: null }),
    onDocument(_id, callback) {
      listener = callback;
      callback(initial);
      return () => {
        listener = null;
      };
    },
    onVersions,
  };
  return { source, onVersions, push: (d: DocumentDoc | null) => act(() => listener?.(d)) };
}

const visitor: SessionState = { status: 'visitor' };
const ana: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const fabi: SessionState = { status: 'person', uid: 'fab', role: 'facilitator', username: 'fabi' };
const suspended: SessionState = { status: 'suspended', uid: 'u-s' };

function setup(initial: DocumentDoc | null, session: SessionState, handlers = {}) {
  const src = fakeSource(initial);
  const cl = fakeClient({ saveDocument: () => ({ ok: true, id: 'd1', version: 3 }), archiveDocument: () => ({}), restoreDocument: () => ({}), ...handlers });
  const view = render(
    <SessionProvider initial={session}>
      <ConstitutionDocument id="d1" source={src.source} client={cl.client} />
    </SessionProvider>,
  );
  return { ...src, calls: cl.calls, container: view.container };
}

describe('ConstitutionDocument', () => {
  it('RF-5 (004) · 5.2: cualquier persona lee el título y el texto con formato, sin versiones ni controles', () => {
    const s = setup(doc(), visitor);
    expect(screen.getByRole('heading', { level: 1, name: 'Reglamento de huertas' })).toBeTruthy();
    expect(screen.getByText('antes').tagName).toBe('STRONG');
    expect(screen.queryByRole('list', { name: 'Historial de versiones' })).toBeNull();
    expect(s.onVersions).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
    expectBlocks(s.container, { nesting: true });
  });

  it('RF-5 (004) · 5.2: un documento que no existe o no se deja leer muestra «No se encontró el documento»', () => {
    setup(null, visitor);
    expect(screen.getByText('No se encontró el documento.')).toBeTruthy();
  });

  it('RF-5 (004) · 5.4: las versiones las ve solo una cuenta activa', () => {
    const activa = setup(doc(), ana);
    const list = screen.getByRole('list', { name: 'Historial de versiones' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(activa.onVersions).toHaveBeenCalledTimes(1);
    cleanup();
    const suspendida = setup(doc(), suspended);
    expect(screen.queryByRole('list', { name: 'Historial de versiones' })).toBeNull();
    expect(suspendida.onVersions).not.toHaveBeenCalled();
    cleanup();
    const visita = setup(doc(), visitor);
    expect(screen.queryByRole('list', { name: 'Historial de versiones' })).toBeNull();
    expect(visita.onVersions).not.toHaveBeenCalled();
  });

  it('RF-5 (004) · 5.5: quien facilita edita; «Guardar cambios» es el único botón azul y solo al haber cambios, con baseVersion', async () => {
    const user = userEvent.setup();
    const s = setup(doc(), fabi);
    expectOnePrimary(s.container, null);
    const text = screen.getByLabelText('Texto');
    await user.clear(text);
    await user.type(text, 'Texto nuevo');
    expectOnePrimary(s.container, 'Guardar cambios');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(s.calls.filter((c) => c.op === 'saveDocument')).toEqual([
      { op: 'saveDocument', payload: { id: 'd1', baseVersion: 2, title: 'Reglamento de huertas', text: 'Texto nuevo' } },
    ]);
    expectBlocks(s.container, { nesting: true });
  });

  it('RF-5 (004) · 5.5: una persona inscrita no ve el formulario de edición', () => {
    setup(doc(), ana);
    expect(screen.queryByLabelText('Texto')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull();
  });

  it('RF-5 (004) · 5.6: «Archivar» es destructiva, pide confirmación y entonces llama a archiveDocument', async () => {
    const user = userEvent.setup();
    const s = setup(doc(), fabi);
    const archive = screen.getByRole('button', { name: 'Archivar' });
    expect(archive.classList.contains('action-destructive')).toBe(true);
    await user.click(archive);
    expect(s.calls.filter((c) => c.op === 'archiveDocument')).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(s.calls.filter((c) => c.op === 'archiveDocument')).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Archivar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
    expect(s.calls.filter((c) => c.op === 'archiveDocument')).toEqual([{ op: 'archiveDocument', payload: { id: 'd1' } }]);
  });

  it('RF-5 (004) · 5.7: un documento archivado ofrece «Restaurar», secundaria, y llama a restoreDocument', async () => {
    const user = userEvent.setup();
    const s = setup(doc({ isArchived: true }), fabi);
    expect(screen.getByText(/archivado/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull();
    const restore = screen.getByRole('button', { name: 'Restaurar' });
    expect(restore.classList.contains('action-secondary')).toBe(true);
    expectOnePrimary(s.container, null);
    await user.click(restore);
    expect(s.calls.filter((c) => c.op === 'restoreDocument')).toEqual([{ op: 'restoreDocument', payload: { id: 'd1' } }]);
  });

  it('RF-17 (004) · 17.2: el conflicto de versión muestra lo vigente en español, conserva lo escrito y reintenta con la versión vigente', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const s = setup(doc(), fabi, {
      saveDocument: () =>
        ++attempt === 1
          ? { ok: false, conflict: true, current: { version: 5, title: 'Título ajeno', text: 'Texto ajeno' } }
          : { ok: true, id: 'd1', version: 6 },
    });
    const text = screen.getByLabelText('Texto');
    await user.clear(text);
    await user.type(text, 'Mi texto');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Alguien editó el documento mientras escribías');
    expect(alert.textContent).toContain('versión 5');
    expect(alert.textContent).toContain('Título ajeno');
    expect(alert.textContent).toContain('Texto ajeno');
    expect((screen.getByLabelText('Texto') as HTMLTextAreaElement).value).toBe('Mi texto');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const saves = s.calls.filter((c) => c.op === 'saveDocument');
    expect((saves[1]!.payload as { baseVersion: number }).baseVersion).toBe(5);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('RF-17 (004) · 17.1: si la callable falla al guardar, el mensaje sale en español y el texto escrito se conserva', async () => {
    const user = userEvent.setup();
    const s = setup(doc(), fabi, {
      saveDocument: () => {
        throw new ApiClientError('rate-limited');
      },
    });
    const title = screen.getByLabelText('Título');
    await user.clear(title);
    await user.type(title, 'Título nuevo');
    const text = screen.getByLabelText('Texto');
    await user.clear(text);
    await user.type(text, 'Lo que escribí');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Hiciste demasiados intentos');
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Título nuevo');
    expect((screen.getByLabelText('Texto') as HTMLTextAreaElement).value).toBe('Lo que escribí');
    expect(s.calls.filter((c) => c.op === 'saveDocument')).toHaveLength(1);
  });

  it('RF-17 (004) · 17.1: un fallo sin código conocido da un mensaje en español genérico y también conserva lo escrito', async () => {
    const user = userEvent.setup();
    setup(doc(), fabi, {
      saveDocument: () => {
        throw new Error('network down');
      },
    });
    const text = screen.getByLabelText('Texto');
    await user.type(text, ' extra');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/No se pudo guardar/);
    expect(alert.textContent).not.toContain('network down');
    expect((screen.getByLabelText('Texto') as HTMLTextAreaElement).value).toContain('extra');
  });
});
