// Dobles en memoria de las fuentes de datos para montar la `App` real sin red (RF-17 (003) · 17.3, D-T21 (003)).
// Importar este módulo antes que `App` registra los `vi.mock`; `firebase()` y las operaciones fallan en voz alta.
import { vi } from 'vitest';

vi.mock('../data/firebase', async (importActual) => ({
  ...(await importActual<typeof import('../data/firebase')>()),
  firebase: () => {
    throw new Error('La App de prueba no debe iniciar Firebase.');
  },
}));

vi.mock('../data/apices', async (importActual) => {
  const actual = await importActual<typeof import('../data/apices')>();
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

vi.mock('../data/versions', async (importActual) => {
  const actual = await importActual<typeof import('../data/versions')>();
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

vi.mock('../data/facilitation', async (importActual) => {
  const actual = await importActual<typeof import('../data/facilitation')>();
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

vi.mock('../data/references', async (importActual) => ({
  ...(await importActual<typeof import('../data/references')>()),
  firestoreReferenceSource: {
    onReferences: (_id: string, _options: unknown, callback: (rows: unknown[]) => void) => {
      callback([]);
      return () => {};
    },
    readImage: async () => 'blob:ejemplo',
  },
  storageReferenceUploader: { upload: async () => 'upload-ejemplo' },
}));

vi.mock('../data/proposals', async (importActual) => ({
  ...(await importActual<typeof import('../data/proposals')>()),
  firestoreProposalSource: {
    onProposal: (_id: string, _uid: string, callback: (row: unknown) => void) => {
      callback(null);
      return () => {};
    },
  },
}));

// Las operaciones nunca se llaman al pintar; si alguna página las llama sola, falla en voz alta.
// Constitución común (spec 004): fuentes en memoria.
vi.mock('../data/constitution/sections', async (importActual) => ({
  ...(await importActual<typeof import('../data/constitution/sections')>()),
  firestoreSectionsSource: (await import('./constitutionDoubles')).sectionsDouble,
}));

vi.mock('../data/constitution/documents', async (importActual) => ({
  ...(await importActual<typeof import('../data/constitution/documents')>()),
  firestoreDocumentsSource: (await import('./constitutionDoubles')).documentsDouble,
}));

vi.mock('../data/constitution/amendments', async (importActual) => ({
  ...(await importActual<typeof import('../data/constitution/amendments')>()),
  firestoreAmendmentsSource: (await import('./constitutionDoubles')).amendmentsDouble,
}));

vi.mock('../data/constitution/notice', async (importActual) => ({
  ...(await importActual<typeof import('../data/constitution/notice')>()),
  firestoreNoticeSource: (await import('./constitutionDoubles')).noticeDouble,
}));

vi.mock('../data/api', async (importActual) => {
  const actual = await importActual<typeof import('../data/api')>();
  const refuse = {
    call: async (op: string) => {
      throw new Error(`La App de prueba no debe llamar a la op ${op}.`);
    },
  };
  return { ...actual, api: refuse, media: refuse };
});
