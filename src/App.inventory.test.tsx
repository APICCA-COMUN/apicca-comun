// RF-6 (002) · 6.1, RF-2 (002) · 2.1, plan §0 (002): inventario de bloques. Monta la `App` real en cada ruta del
// router, como facilitador y como visitante, con las fuentes de datos reemplazadas por dobles en memoria, y aplica
// `expectBlocks` a toda la página ya pintada. Ninguna llamada sale a la red: `firebase()` falla en voz alta.
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ROUTES } from './app/router';
import { SessionProvider, VISITOR, type SessionState } from './app/session';
import { expectBlocks } from './testing/expectBlocks';

vi.mock('./components/SiteFooter', () => ({
  SiteFooter: () => (
    <footer className="site-footer" role="contentinfo">
      <p className="site-footer__support">Apoyado por</p>
    </footer>
  ),
}));


vi.mock('./data/firebase', async (importActual) => ({
  ...(await importActual<typeof import('./data/firebase')>()),
  firebase: () => {
    throw new Error('El inventario no debe iniciar Firebase.');
  },
}));

vi.mock('./data/apices', async (importActual) => {
  const actual = await importActual<typeof import('./data/apices')>();
  const stamp = { seconds: 1_790_000_000, nanoseconds: 0 };
  const listed = {
    id: 'ejemplo',
    name: 'Huerta del barrio',
    description: 'Una huerta compartida.',
    axes: ['agua', 'alimento'] as const,
    status: 'idea' as const,
    updatedAt: stamp,
    image: null,
    location: { lat: 4.6, lng: -74.08, precision: 'zone' as const },
  };
  const apice = {
    id: 'ejemplo',
    version: 3,
    name: 'Huerta del barrio',
    description: 'Una huerta compartida.',
    axes: ['agua', 'alimento'] as const,
    needs: 'Semillas',
    offers: 'Compost',
    status: 'idea' as const,
    visibility: 'public' as const,
    isArchived: false,
    authorUid: 'fab',
    authorUsername: 'fabi',
    lastEditedByUsername: 'fabi',
    updatedAt: stamp,
    image: null,
    location: { lat: 4.6, lng: -74.08, precision: 'zone' as const },
  };
  return {
    ...actual,
    firestoreListSource: { fetchPage: async () => ({ items: [{ ...listed, axes: [...listed.axes] }], cursor: null }) },
    firestoreApiceSource: {
      onApice: (_id: string, callback: (value: unknown) => void) => {
        callback({ ...apice, axes: [...apice.axes] });
        return () => {};
      },
      readExact: async () => null,
    },
  };
});

vi.mock('./data/versions', async (importActual) => {
  const actual = await importActual<typeof import('./data/versions')>();
  const stamp = { seconds: 1_790_000_000, nanoseconds: 0 };
  return {
    ...actual,
    firestoreHistorySource: {
      onApice: (_id: string, callback: (head: unknown) => void) => {
        callback({ id: 'ejemplo', version: 1, visibility: 'public', isArchived: false, authorUid: 'fab' });
        return () => {};
      },
      onVersions: (_id: string, callback: (rows: unknown[]) => void) => {
        callback([
          {
            n: 1,
            kind: 'create',
            restoredFromN: null,
            savedByUsername: 'fabi',
            savedAt: stamp,
            content: { name: 'Huerta del barrio', description: 'Una huerta compartida.', axes: ['agua'], needs: '', offers: '', status: 'idea' },
          },
        ]);
        return () => {};
      },
    },
  };
});

vi.mock('./data/facilitation', async (importActual) => {
  const actual = await importActual<typeof import('./data/facilitation')>();
  const issued = { seconds: 1_790_000_000, nanoseconds: 0 };
  const expires = { seconds: 4_000_000_000, nanoseconds: 0 };
  const watch = (rows: unknown[]) => (callback: (rows: unknown[]) => void) => {
    callback(rows);
    return () => {};
  };
  return {
    ...actual,
    firestoreFacilitationSource: {
      onInvitations: watch([{ email: 'invitada@ejemplo.org', status: 'pending', issuedAt: issued, expiresAt: expires, token: 'tok-ejemplo' }]),
      onEnrollments: watch([{ id: 'sol1', email: 'solicita@ejemplo.org', name: 'Sol Icita', message: 'Quiero sumarme.', status: 'pending', createdAt: issued }]),
      onAccounts: watch([{ uid: 'u-ana', email: 'ana@ejemplo.org', name: 'Ana', username: 'ana', role: 'member', status: 'active' }]),
    },
  };
});

vi.mock('./data/forum', async (importActual) => {
  const stamp = 1_790_000_000_000;
  return {
    ...(await importActual<typeof import('./data/forum')>()),
    firestoreForumSource: {
      fetchThreads: async () => ({
        threads: [{ id: 'ejemplo', title: 'Cisterna o tanques', axis: 'agua', authorUsername: 'lucia', lastMessageAt: stamp, messageCount: 3 }],
        next: null,
      }),
      fetchThread: async () => ({
        thread: { id: 'ejemplo', title: 'Cisterna o tanques', axis: 'agua', authorUsername: 'lucia', authorUid: 'u-lu', lastMessageAt: stamp, createdAt: stamp, messageCount: 2, isArchived: false },
        opening: { id: 'm1', authorUid: 'u-lu', authorUsername: 'lucia', text: 'Primera', createdAt: stamp, editedAt: null, isArchived: false, isOpening: true },
        messages: [{ id: 'm2', authorUid: 'u-be', authorUsername: 'beto', text: 'Segunda', createdAt: stamp, editedAt: stamp, isArchived: false, isOpening: false }],
        before: null,
      }),
      fetchOlder: async () => ({ messages: [], before: null }),
    },
  };
});

vi.mock('./data/references', async (importActual) => ({
  ...(await importActual<typeof import('./data/references')>()),
  firestoreReferenceSource: {
    onReferences: (_id: string, _options: unknown, callback: (rows: unknown[]) => void) => {
      callback([]);
      return () => {};
    },
    readImage: async () => 'blob:ejemplo',
  },
  storageReferenceUploader: { upload: async () => 'upload-ejemplo' },
}));

vi.mock('./data/proposals', async (importActual) => ({
  ...(await importActual<typeof import('./data/proposals')>()),
  firestoreProposalSource: {
    onProposal: (_id: string, _uid: string, callback: (row: unknown) => void) => {
      callback(null);
      return () => {};
    },
  },
}));

// Las operaciones nunca se llaman al pintar; si alguna página las llama sola, falla en voz alta.
// Constitución común (spec 004): fuentes en memoria.
vi.mock('./data/constitution/sections', async (importActual) => ({
  ...(await importActual<typeof import('./data/constitution/sections')>()),
  firestoreSectionsSource: (await import('./testing/constitutionDoubles')).sectionsDouble,
}));

vi.mock('./data/constitution/documents', async (importActual) => ({
  ...(await importActual<typeof import('./data/constitution/documents')>()),
  firestoreDocumentsSource: (await import('./testing/constitutionDoubles')).documentsDouble,
}));

vi.mock('./data/constitution/amendments', async (importActual) => ({
  ...(await importActual<typeof import('./data/constitution/amendments')>()),
  firestoreAmendmentsSource: (await import('./testing/constitutionDoubles')).amendmentsDouble,
}));

vi.mock('./data/constitution/notice', async (importActual) => ({
  ...(await importActual<typeof import('./data/constitution/notice')>()),
  firestoreNoticeSource: (await import('./testing/constitutionDoubles')).noticeDouble,
}));

vi.mock('./data/api', async (importActual) => {
  const actual = await importActual<typeof import('./data/api')>();
  const refuse = {
    call: async (op: string) => {
      throw new Error(`El inventario no debe llamar a la op ${op}.`);
    },
  };
  return { ...actual, api: refuse, media: refuse };
});

/** Cada patrón con parámetros de ejemplo, más la ruta desconocida. */
const PATHS = [...ROUTES.map((route) => route.pattern.replace(/:[a-z]+/gi, 'ejemplo')), '/ruta-que-no-existe'];

const FACILITATOR: SessionState = { status: 'person', uid: 'fab', role: 'facilitator', username: 'fabi' };
const SESSIONS: Array<[string, SessionState]> = [
  ['facilitador', FACILITATOR],
  ['visitante', VISITOR],
];

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe.each(PATHS)('inventario de bloques en %s', (path) => {
  describe.each(SESSIONS)('como %s', (_name, session) => {
    async function mountSettled() {
      window.history.replaceState(null, '', path);
      render(
        <SessionProvider initial={session}>
          <App />
        </SessionProvider>,
      );
      await waitFor(() => expect(screen.queryByText(/Cargando/)).toBeNull());
    }

    it('RF-3 (003) · 3.3, RF-6 (002) · 6.1, RF-2 (002) · 2.1: la página pinta su contenido, todo control, diálogo y aviso es un bloque, ningún style escribe un color y no hay bloques anidados', async () => {
      await mountSettled();
      expect(document.body.querySelector('main')!.textContent!.trim()).not.toBe('');
      // El edificio dentro de la tarjeta o de la ficha es la excepción de D-28 (003).
      expectBlocks(document.body, { nesting: true });
    });
  });
});
