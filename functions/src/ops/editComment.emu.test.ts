// T-6.16 (004) · Editar un comentario propio (RF-9 (004) · 9.1, 9.3, RF-16 (004) · 16.1, D-T10 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution, seedSuspendedAccount } from '../testing/constitutionKit';
import { handleCommentAmendment } from './commentAmendment';
import { handleEditComment } from './editComment';

let ctx: TestCtx;
let ana: string;
let beto: string;
let suspended: string;
let commentId: string;

const data = async (path: string) => (await ctx.db.doc(path).get()).data() as Record<string, unknown> | undefined;
const iso = (value: unknown) => (value as { toDate(): Date }).toDate().toISOString();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  suspended = (await seedSuspendedAccount(ctx, { username: 'susi' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' } });
  commentId = (await handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Primero.' }, beto)).id;
  ctx.setNow(new Date('2026-10-02T12:00:00Z'));
});

describe('editComment', () => {
  it('RF-9 (004) · 9.1: editar guarda el texto anterior en versions/1 y sube la versión', async () => {
    expect(await handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Segundo.' }, beto)).toEqual({ ok: true, version: 2 });
    const comment = await data(`amendments/a1/comments/${commentId}`);
    expect(comment).toMatchObject({ text: 'Segundo.', version: 2 });
    expect(iso(comment!['editedAt'])).toBe('2026-10-02T12:00:00.000Z');
    expect(iso(comment!['createdAt'])).toBe('2026-10-01T12:00:00.000Z');
    expect(await data(`amendments/a1/comments/${commentId}/versions/1`)).toMatchObject({ text: 'Primero.', version: 1 });
  });

  it('RF-9 (004) · 9.1: las versiones anteriores se conservan tras varias ediciones', async () => {
    await handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Segundo.' }, beto);
    await handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Tercero.' }, beto);
    expect((await data(`amendments/a1/comments/${commentId}/versions/1`))!['text']).toBe('Primero.');
    expect((await data(`amendments/a1/comments/${commentId}/versions/2`))!['text']).toBe('Segundo.');
    expect((await data(`amendments/a1/comments/${commentId}`))!['version']).toBe(3);
  });

  it('RF-9 (004) · 9.1: otra persona, incluida quien propuso, recibe forbidden y nada cambia', async () => {
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Mía.' }, ana))).toBe('forbidden');
    expect((await data(`amendments/a1/comments/${commentId}`))!['text']).toBe('Primero.');
    expect(await data(`amendments/a1/comments/${commentId}/versions/1`)).toBeUndefined();
  });

  it('RF-9 (004) · 9.1: con la cuenta suspendida o sin sesión se rechaza', async () => {
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'x' }, suspended))).toBe('account-suspended');
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'x' }, null))).toBe('unauthenticated');
  });

  it('RF-9 (004) · 9.3: editar en una propuesta cerrada se rechaza con amendment-closed', async () => {
    await ctx.db.doc('amendments/a1').update({ isOpen: false, result: 'rejected' });
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Tarde.' }, beto))).toBe('amendment-closed');
  });

  it('RF-9 (004) · 9.3: editar en una propuesta vencida sin procesar se rechaza', async () => {
    ctx.setNow(new Date('2027-01-01T00:00:00Z'));
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Tarde.' }, beto))).toBe('amendment-closed');
  });

  it('RF-9 (004) · 9.1: un comentario inexistente da comment-not-found', async () => {
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId: 'nada', text: 'x' }, beto))).toBe('comment-not-found');
  });

  it('RF-16 (004) · 16.1: un texto de 10 001 caracteres se rechaza con text-too-long y uno vacío con text-empty', async () => {
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'a'.repeat(10001) }, beto))).toBe('text-too-long');
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: ' ' }, beto))).toBe('text-empty');
  });

  it('RF-9 (004) · 9.1: con baseVersion desfasada responde conflicto con el comentario actual (D-T10 (004))', async () => {
    await handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Segundo.' }, beto);
    const result = await handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'Otro.', baseVersion: 1 }, beto);
    expect(result).toMatchObject({ ok: false, conflict: true, current: { text: 'Segundo.', version: 2 } });
    expect((await data(`amendments/a1/comments/${commentId}`))!['text']).toBe('Segundo.');
  });

  it('RF-9 (004) · 9.1: un comentario archivado no se edita', async () => {
    await ctx.db.doc(`amendments/a1/comments/${commentId}`).update({ archived: true, archivedBy: ana });
    expect(await codeOf(handleEditComment(ctx, { amendmentId: 'a1', commentId, text: 'x' }, beto))).toBe('forbidden');
  });
});
