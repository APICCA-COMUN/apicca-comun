// RF-1 (013) · D-T1 (013): la exportación diaria de Firestore, probada con un cliente falso, sin nube.
import { describe, expect, it } from 'vitest';
import { backupPrefix, exportFirestore, type ExportClient } from './firestoreBackup';

function fakeClient(projectId = 'apicca-com') {
  const calls: Parameters<ExportClient['exportDocuments']>[0][] = [];
  const client: ExportClient = {
    getProjectId: () => Promise.resolve(projectId),
    exportDocuments: (request) => {
      calls.push(request);
      return Promise.resolve([{}]);
    },
  };
  return { client, calls };
}

describe('firestoreBackup', () => {
  it('RF-1 (013) · 1.1: la ruta va al bucket de respaldo del proyecto, bajo firestore/, con fecha y hora UTC', () => {
    expect(backupPrefix('apicca-com', new Date('2026-10-15T03:07:59.123Z'))).toBe(
      'gs://apicca-com-respaldos/firestore/2026-10-15T03-07Z',
    );
  });

  it('RF-1 (013) · 1.2: la ruta no apunta al bucket de Storage del sitio', () => {
    expect(backupPrefix('apicca-com', new Date())).not.toContain('firebasestorage.app');
  });

  it('RF-1 (013) · 1.3: exporta la base (default) completa, sin filtrar colecciones', async () => {
    const { client, calls } = fakeClient();
    const prefix = await exportFirestore(client, new Date('2026-10-15T03:00:00Z'));
    expect(calls).toEqual([
      {
        name: 'projects/apicca-com/databases/(default)',
        outputUriPrefix: 'gs://apicca-com-respaldos/firestore/2026-10-15T03-00Z',
        collectionIds: [],
      },
    ]);
    expect(prefix).toBe('gs://apicca-com-respaldos/firestore/2026-10-15T03-00Z');
  });

  it('RF-1 (013) · 1.4: si la exportación falla, el error sube para que lo registre la función', async () => {
    const client: ExportClient = {
      getProjectId: () => Promise.resolve('apicca-com'),
      exportDocuments: () => Promise.reject(new Error('PERMISSION_DENIED')),
    };
    await expect(exportFirestore(client, new Date())).rejects.toThrow('PERMISSION_DENIED');
  });
});
