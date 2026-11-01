import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import { ApiClientError } from '../data/api';
import type { ApiceHead, HistorySource, VersionRow } from '../data/versions';
import { fakeClient } from '../testing/facilitationDoubles';
import { ApiceHistory } from './ApiceHistory';

const at = (iso: string) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 });

const content = (name: string) => ({
  name,
  description: 'Descripción',
  axes: ['agua' as const],
  needs: '',
  offers: '',
  status: 'idea' as const,
});

const version = (n: number, by: string, extra: Partial<VersionRow> = {}): VersionRow => ({
  n,
  kind: n === 1 ? 'create' : 'edit',
  restoredFromN: null,
  savedByUsername: by,
  savedAt: at(`2026-09-0${n}T15:00:00Z`),
  content: content(`Nombre v${n}`),
  ...extra,
});

const head = (extra: Partial<ApiceHead> = {}): ApiceHead => ({
  id: 'a1',
  version: 3,
  visibility: 'private',
  isArchived: false,
  authorUid: 'u-ana',
  ...extra,
});

/** Fuente en memoria: `setVersions` y `setHead` simulan los cambios que llegan de Firestore. */
function fakeHistory(initial: { head: ApiceHead | null; versions: VersionRow[] }) {
  let current = initial;
  const headListeners = new Set<(h: ApiceHead | null) => void>();
  const versionListeners = new Set<(rows: VersionRow[]) => void>();
  const onVersions = vi.fn((_id: string, callback: (rows: VersionRow[]) => void) => {
    versionListeners.add(callback);
    callback(current.versions);
    return () => versionListeners.delete(callback);
  });
  const source: HistorySource = {
    onApice(_id, callback) {
      headListeners.add(callback);
      callback(current.head);
      return () => headListeners.delete(callback);
    },
    onVersions,
  };
  return {
    source,
    onVersions,
    setVersions(versions: VersionRow[]) {
      current = { ...current, versions };
      for (const listener of versionListeners) listener(versions);
    },
    setHead(next: ApiceHead | null) {
      current = { ...current, head: next };
      for (const listener of headListeners) listener(next);
    },
  };
}

const person: SessionState = { status: 'person', uid: 'u-beto', role: 'member', username: 'beto' };

function setup(
  history: ReturnType<typeof fakeHistory>,
  handlers: Parameters<typeof fakeClient>[0] = {},
  session: SessionState = person,
) {
  const { client, calls } = fakeClient(handlers);
  render(
    <SessionProvider initial={session}>
      <ApiceHistory id="a1" source={history.source} client={client} />
    </SessionProvider>,
  );
  return { calls };
}

const three = () => [version(1, 'ana'), version(2, 'beto'), version(3, 'cleo')];
const items = () => within(screen.getByRole('list', { name: 'Versiones' })).getAllByRole('listitem');

describe('ApiceHistory · lista', () => {
  it('RF-12 (001): lista las versiones de la más reciente a la más antigua con quién y cuándo', () => {
    setup(fakeHistory({ head: head(), versions: three() }));
    const rows = items();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText(/Versión 3/)).toBeTruthy();
    expect(within(rows[0]!).getByText(/cleo/)).toBeTruthy();
    expect(within(rows[1]!).getByText(/Versión 2/)).toBeTruthy();
    expect(within(rows[1]!).getByText(/beto/)).toBeTruthy();
    expect(within(rows[2]!).getByText(/Versión 1/)).toBeTruthy();
    expect(within(rows[2]!).getByText(/ana/)).toBeTruthy();
    // Cuándo: la fecha de cada guardado aparece en la fila (hora de Colombia).
    expect(within(rows[2]!).getByText(/2026/)).toBeTruthy();
  });

  it('RF-12 (001): una versión restaurada dice de cuál viene', () => {
    const versions = [...three(), version(4, 'ana', { kind: 'restore', restoredFromN: 1 })];
    setup(fakeHistory({ head: head({ version: 4 }), versions }));
    expect(within(items()[0]!).getByText(/restaurada de la versión 1/i)).toBeTruthy();
  });

  it('RF-12 (001): un visitante no ve el historial y no se lee ninguna versión', () => {
    const history = fakeHistory({ head: head(), versions: three() });
    setup(history, {}, { status: 'visitor' });
    expect(screen.getByText(/solo para cuentas con sesión/i)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Versiones' })).toBeNull();
    expect(history.onVersions).not.toHaveBeenCalled();
  });

  it('RF-12 (001): una cuenta suspendida tampoco ve el historial', () => {
    const history = fakeHistory({ head: head(), versions: three() });
    setup(history, {}, { status: 'suspended', uid: 'u-beto' });
    expect(screen.queryByRole('list', { name: 'Versiones' })).toBeNull();
    expect(history.onVersions).not.toHaveBeenCalled();
  });

  it('RF-12 (001): un ápice que no existe o que la persona no puede ver no muestra historial', () => {
    const history = fakeHistory({ head: null, versions: [] });
    setup(history);
    expect(screen.getByText(/no se encontró el ápice/i)).toBeTruthy();
    expect(history.onVersions).not.toHaveBeenCalled();
  });

  it('RF-12 (001): un ápice archivado ajeno no deja ver el historial a una inscrita', () => {
    const history = fakeHistory({ head: head({ isArchived: true }), versions: three() });
    setup(history);
    expect(screen.getByText(/no se encontró el ápice/i)).toBeTruthy();
    expect(history.onVersions).not.toHaveBeenCalled();
  });
});

describe('ApiceHistory · restaurar', () => {
  it('RF-12 (001): restaurar pide la op con la versión abierta y la nueva aparece en la lista', async () => {
    const user = userEvent.setup();
    const history = fakeHistory({ head: head(), versions: three() });
    const { calls } = setup(history, { restoreVersion: () => ({ ok: true, version: 4 }) });

    await user.click(within(items()[2]!).getByRole('button', { name: 'Restaurar' }));
    expect(calls).toEqual([{ op: 'restoreVersion', payload: { id: 'a1', n: 1, baseVersion: 3 } }]);
    expect(await screen.findByText(/versión 1 quedó como versión 4/i)).toBeTruthy();

    act(() => {
      history.setHead(head({ version: 4 }));
      history.setVersions([...three(), version(4, 'beto', { kind: 'restore', restoredFromN: 1 })]);
    });
    expect(items()).toHaveLength(4);
    expect(within(items()[0]!).getByText(/restaurada de la versión 1/i)).toBeTruthy();
  });

  it('RF-12 (001): la versión vigente no ofrece restaurar', () => {
    setup(fakeHistory({ head: head(), versions: three() }));
    expect(within(items()[0]!).queryByRole('button', { name: 'Restaurar' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Restaurar' })).toHaveLength(2);
  });

  it('RF-12 (001): con conflicto avisa, no escribe y deja reintentar sobre la versión vigente', async () => {
    const user = userEvent.setup();
    const history = fakeHistory({ head: head(), versions: three() });
    let attempt = 0;
    const { calls } = setup(history, {
      restoreVersion: () => {
        attempt += 1;
        return attempt === 1
          ? { ok: false, conflict: true, current: { version: 5, content: content('Otra') } }
          : { ok: true, version: 6 };
      },
    });

    await user.click(within(items()[2]!).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByText(/alguien guardó otra versión/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restaurar sobre la versión vigente' }));
    expect(calls.map((c) => c.payload)).toEqual([
      { id: 'a1', n: 1, baseVersion: 3 },
      { id: 'a1', n: 1, baseVersion: 5 },
    ]);
    expect(await screen.findByText(/versión 1 quedó como versión 6/i)).toBeTruthy();
  });

  it('RF-12 (001): en un ápice archivado avisa y no ofrece restaurar', () => {
    const history = fakeHistory({ head: head({ isArchived: true, authorUid: 'u-beto' }), versions: three() });
    setup(history);
    expect(screen.getByText(/está archivado/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restaurar' })).toBeNull();
    expect(items()).toHaveLength(3);
  });

  it('RF-12 (001): si el servidor rechaza, muestra su mensaje', async () => {
    const user = userEvent.setup();
    setup(fakeHistory({ head: head(), versions: three() }), {
      restoreVersion: () => {
        throw new ApiClientError('forbidden');
      },
    });
    await user.click(within(items()[2]!).getByRole('button', { name: 'Restaurar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/\S/);
  });
});

describe('ApiceHistory · bloques (002)', () => {
  const kinds = (el: Element) => ['action-primary', 'action-secondary', 'action-destructive'].filter((c) => el.classList.contains(c));

  it('RF-4 (003) · 4.6: filas, avisos y botones son bloques; «Restaurar» en cada fila es secundaria', async () => {
    const { calls } = setup(
      fakeHistory({ head: head(), versions: three() }),
      {
        restoreVersion: () => {
          throw new ApiClientError('apice-archived');
        },
      },
    );
    for (const row of items()) expect(row.classList.contains('block')).toBe(true);
    const buttons = screen.getAllByRole('button', { name: 'Restaurar' });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.classList.contains('block')).toBe(true);
      expect(kinds(button)).toEqual(['action-secondary']);
    }
    await userEvent.click(buttons[0]!);
    expect(calls).toHaveLength(1);
    expect((await screen.findByRole('alert')).classList.contains('block')).toBe(true);
  });

  it('RF-6 (002) · 6.1, 6.3: el aviso de éxito y el de conflicto, con su botón, son bloques', async () => {
    let n = 0;
    setup(fakeHistory({ head: head(), versions: three() }), {
      restoreVersion: () =>
        ++n === 1
          ? { ok: false, conflict: true, current: { version: 5, content: content('Otra') } }
          : { ok: true, version: 6 },
    });
    await userEvent.click(screen.getAllByRole('button', { name: 'Restaurar' })[0]!);
    const alert = await screen.findByRole('alert');
    expect(alert.classList.contains('block')).toBe(true);
    const retry = screen.getByRole('button', { name: 'Restaurar sobre la versión vigente' });
    expect(retry.classList.contains('block')).toBe(true);
    expect(kinds(retry)).toEqual(['action-secondary']);
    await userEvent.click(retry);
    expect((await screen.findByRole('status')).classList.contains('block')).toBe(true);
  });

  it('RF-6 (002) · 6.1: el aviso de lectura fallida es un bloque', () => {
    const history = fakeHistory({ head: head(), versions: [] });
    (history.onVersions as unknown as { mockImplementation(f: (id: string, ok: unknown, onError: () => void) => () => void): void }).mockImplementation((_id, _ok, onError) => {
      onError();
      return () => undefined;
    });
    setup(history);
    expect(screen.getByRole('alert').classList.contains('block')).toBe(true);
  });

  it('RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.3: el historial se apoya en un lote con las filas como bloques y sus botones dentro (D-24 (003))', () => {
    setup(fakeHistory({ head: head(), versions: three() }));
    const lot = document.querySelector('.lot');
    expect(lot).not.toBeNull();
    expect(lot?.classList.contains('block')).toBe(false);
    const list = screen.getByRole('list', { name: 'Versiones' });
    expect(lot?.contains(list)).toBe(true);
    for (const row of within(list).getAllByRole('listitem')) {
      expect(row.classList.contains('block')).toBe(true);
    }
  });
});
