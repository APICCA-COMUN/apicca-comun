// T-5.3 (004): archivar y restaurar un documento de la constitución (RF-5 (004) · 5.6, 5.7).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedDocuments } from '../testing/constitutionKit';
import { handleArchiveDocument } from './archiveDocument';
import { handleRestoreDocument } from './restoreDocument';

let ctx: TestCtx;
let fabi: string;
let ana: string;

const data = async (id: string) => (await ctx.db.doc(`constitutionDocuments/${id}`).get()).data() as Record<string, unknown>;
// Lo que ve un visitante: la consulta de la lista pide `isArchived == false` (regla de plan §5.9).
const visibleIds = async () =>
  (await ctx.db.collection('constitutionDocuments').where('isArchived', '==', false).get()).docs.map((d) => d.id).sort();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  await seedDocuments(ctx, [
    { id: 'd1', title: 'Uno', version: 2, updatedAt: new Date('2026-08-30T10:00:00Z') },
    { id: 'd2', title: 'Dos' },
  ]);
});

describe('archiveDocument y restoreDocument', () => {
  it('RF-5 (004) · 5.6: el facilitador archiva sin crear versión y el documento sale de la lista de un visitante', async () => {
    expect(await visibleIds()).toEqual(['d1', 'd2']);
    expect(await handleArchiveDocument(ctx, { id: 'd1' }, fabi)).toEqual({});
    expect(await data('d1')).toMatchObject({ isArchived: true, version: 2, title: 'Uno' });
    expect(((await data('d1'))['updatedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-08-30T10:00:00.000Z');
    expect((await ctx.db.collection('constitutionDocuments/d1/versions').get()).size).toBe(2);
    expect(await visibleIds()).toEqual(['d2']);
  });

  it('RF-5 (004) · 5.6: una persona inscrita, sin sesión o un documento inexistente se rechazan y nada cambia', async () => {
    expect(await codeOf(handleArchiveDocument(ctx, { id: 'd1' }, ana))).toBe('forbidden');
    expect(await codeOf(handleArchiveDocument(ctx, { id: 'd1' }, null))).toBe('unauthenticated');
    expect(await codeOf(handleArchiveDocument(ctx, { id: 'nada' }, fabi))).toBe('invalid-request');
    expect((await data('d1'))['isArchived']).toBe(false);
  });

  it('RF-5 (004) · 5.7: el facilitador restaura el documento archivado y vuelve a la lista, con las mismas versiones', async () => {
    await handleArchiveDocument(ctx, { id: 'd1' }, fabi);
    expect(await codeOf(handleRestoreDocument(ctx, { id: 'd1' }, ana))).toBe('forbidden');
    expect(await visibleIds()).toEqual(['d2']);
    expect(await handleRestoreDocument(ctx, { id: 'd1' }, fabi)).toEqual({});
    expect(await data('d1')).toMatchObject({ isArchived: false, version: 2 });
    expect(await visibleIds()).toEqual(['d1', 'd2']);
    expect((await ctx.db.collection('constitutionDocuments/d1/versions').get()).size).toBe(2);
  });

  it('RF-5 (004) · 5.7: archivar o restaurar dos veces es idempotente', async () => {
    await handleArchiveDocument(ctx, { id: 'd1' }, fabi);
    await handleArchiveDocument(ctx, { id: 'd1' }, fabi);
    expect((await data('d1'))['isArchived']).toBe(true);
    await handleRestoreDocument(ctx, { id: 'd2' }, fabi);
    expect((await data('d2'))['isArchived']).toBe(false);
  });
});
