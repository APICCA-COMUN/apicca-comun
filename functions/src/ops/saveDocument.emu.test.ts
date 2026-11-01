// T-5.1 y T-5.2 (004): crear y editar un documento de la constitución (RF-5 (004), RF-16 (004), RF-17 (004) · 17.2).
import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS } from '../../../shared/domain/limits';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedDocuments } from '../testing/constitutionKit';
import { handleSaveDocument } from './saveDocument';

let ctx: TestCtx;
let fabi: string;
let flor: string;
let ana: string;

const doc = async (id: string) => (await ctx.db.doc(`constitutionDocuments/${id}`).get()).data() as Record<string, unknown>;
const versions = async (id: string) => (await ctx.db.collection(`constitutionDocuments/${id}/versions`).get()).docs;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  flor = (await seedAccount(ctx, { username: 'flor', role: 'facilitator' })).uid;
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('saveDocument', () => {
  it('RF-5 (004) · 5.3: el facilitador crea un documento con título y texto, versión 1 y su `versions/1`', async () => {
    const result = await handleSaveDocument(ctx, { title: 'Acuerdos de uso', text: 'Texto del documento.' }, fabi);
    expect(result).toMatchObject({ ok: true, version: 1 });
    const id = (result as { id: string }).id;
    expect(await doc(id)).toMatchObject({ title: 'Acuerdos de uso', text: 'Texto del documento.', version: 1, isArchived: false });
    const [v1] = await versions(id);
    expect(v1?.id).toBe('1');
    expect(v1?.data()).toMatchObject({ title: 'Acuerdos de uso', text: 'Texto del documento.', version: 1, byUid: fabi, byUsername: 'fabi' });
    expect(((await doc(id))['createdAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
  });

  it('RF-5 (004) · 5.3: sin título o sin texto se rechaza con text-empty y nada se escribe', async () => {
    expect(await codeOf(handleSaveDocument(ctx, { title: '', text: 'x' }, fabi))).toBe('text-empty');
    expect(await codeOf(handleSaveDocument(ctx, { title: 'T', text: '   ' }, fabi))).toBe('text-empty');
    expect((await ctx.db.collection('constitutionDocuments').get()).size).toBe(0);
  });

  it('RF-16 (004) · 16.2: un exceso informa los caracteres que sobran', async () => {
    await expect(handleSaveDocument(ctx, { title: 'a'.repeat(LIMITS.title + 4), text: 'x' }, fabi)).rejects.toThrow('sobran 4 caracteres');
    await expect(handleSaveDocument(ctx, { title: 'T', text: 'a'.repeat(LIMITS.text + 1) }, fabi)).rejects.toThrow('sobra 1 carácter');
  });

  it('RF-5 (004) · 5.3: una persona inscrita recibe forbidden y sin sesión unauthenticated', async () => {
    expect(await codeOf(handleSaveDocument(ctx, { title: 'T', text: 'x' }, ana))).toBe('forbidden');
    expect(await codeOf(handleSaveDocument(ctx, { title: 'T', text: 'x' }, null))).toBe('unauthenticated');
    expect((await ctx.db.collection('constitutionDocuments').get()).size).toBe(0);
  });

  it('RF-5 (004) · 5.5: editar con la versión vigente guarda `versions/2` y conserva la 1', async () => {
    await seedDocuments(ctx, [{ id: 'd1', title: 'Viejo', text: 'Texto viejo.' }]);
    ctx.setNow(new Date('2026-09-02T10:00:00Z'));
    expect(await handleSaveDocument(ctx, { id: 'd1', baseVersion: 1, title: 'Nuevo', text: 'Texto nuevo.' }, flor)).toEqual({ ok: true, id: 'd1', version: 2 });
    expect(await doc('d1')).toMatchObject({ title: 'Nuevo', text: 'Texto nuevo.', version: 2 });
    expect(((await doc('d1'))['updatedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-02T10:00:00.000Z');
    const stored = await versions('d1');
    expect(stored.map((d) => d.id).sort()).toEqual(['1', '2']);
    expect(stored.find((d) => d.id === '1')?.data()).toMatchObject({ title: 'Viejo', text: 'Texto viejo.' });
    expect(stored.find((d) => d.id === '2')?.data()).toMatchObject({ title: 'Nuevo', byUsername: 'flor' });
  });

  it('RF-5 (004) · 5.5: guardar sin cambios no crea versión', async () => {
    await seedDocuments(ctx, [{ id: 'd1', title: 'Igual', text: 'Mismo.' }]);
    expect(await handleSaveDocument(ctx, { id: 'd1', baseVersion: 1, title: 'Igual', text: 'Mismo.' }, fabi)).toEqual({ ok: true, id: 'd1', version: 1 });
    expect((await versions('d1')).length).toBe(1);
  });

  it('RF-17 (004) · 17.2: dos ediciones del mismo documento con la misma base: la segunda recibe conflict y no escribe', async () => {
    await seedDocuments(ctx, [{ id: 'd1', title: 'Base', text: 'Texto base.' }]);
    const first = await handleSaveDocument(ctx, { id: 'd1', baseVersion: 1, title: 'De Fabi', text: 'A.' }, fabi);
    const second = await handleSaveDocument(ctx, { id: 'd1', baseVersion: 1, title: 'De Flor', text: 'B.' }, flor);
    expect(first).toMatchObject({ ok: true, version: 2 });
    expect(second).toEqual({ ok: false, conflict: true, current: { version: 2, title: 'De Fabi', text: 'A.' } });
    expect(await doc('d1')).toMatchObject({ title: 'De Fabi', version: 2 });
    expect((await versions('d1')).length).toBe(2);
  });

  it('RF-5 (004) · 5.5: editar un documento que no existe o sin `baseVersion` se rechaza como solicitud inválida', async () => {
    expect(await codeOf(handleSaveDocument(ctx, { id: 'nada', baseVersion: 1, title: 'T', text: 'x' }, fabi))).toBe('invalid-request');
    await seedDocuments(ctx, [{ id: 'd1' }]);
    expect(await codeOf(handleSaveDocument(ctx, { id: 'd1', title: 'T', text: 'x' }, fabi))).toBe('invalid-request');
  });
});
