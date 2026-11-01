// T-6.8 (004) · Comentar una propuesta abierta (RF-9 (004) · 9.1, 9.3, RF-16 (004) · 16.1, 16.2, RNF-1 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution, seedSuspendedAccount } from '../testing/constitutionKit';
import { handleCommentAmendment } from './commentAmendment';

let ctx: TestCtx;
let ana: string;
let beto: string;
let suspended: string;

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
});

describe('commentAmendment', () => {
  it('RF-9 (004) · 9.1: comentar guarda el comentario con autoría, fecha y versión 1, y deja el evento commented', async () => {
    const { id } = await handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Me parece bien.' }, beto);
    const comment = await data(`amendments/a1/comments/${id}`);
    expect(comment).toMatchObject({ text: 'Me parece bien.', authorUid: beto, authorUsername: 'beto', version: 1, editedAt: null, archived: false, archivedBy: null });
    expect(iso(comment!['createdAt'])).toBe('2026-10-01T12:00:00.000Z');
    const event = await data('amendments/a1/events/2');
    expect(event).toMatchObject({ seq: 2, kind: 'commented', uid: beto, username: 'beto', detail: { commentId: id } });
    expect((await data('amendments/a1'))!['eventSeq']).toBe(2);
  });

  it('RF-9 (004) · 9.1: quien propuso también puede comentar', async () => {
    const { id } = await handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Aclaro.' }, ana);
    expect((await data(`amendments/a1/comments/${id}`))!['authorUid']).toBe(ana);
  });

  it('RF-9 (004) · 9.1: sin sesión o con la cuenta suspendida se rechaza', async () => {
    expect(await codeOf(handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Hola' }, null))).toBe('unauthenticated');
    expect(await codeOf(handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Hola' }, suspended))).toBe('account-suspended');
  });

  it('RF-9 (004) · 9.3: comentar una propuesta cerrada se rechaza con amendment-closed', async () => {
    await seedAmendment(ctx, { id: 'a2', sectionId: 's1', author: { uid: ana, username: 'ana' }, isOpen: false, result: 'rejected' });
    expect(await codeOf(handleCommentAmendment(ctx, { amendmentId: 'a2', text: 'Tarde' }, beto))).toBe('amendment-closed');
  });

  it('RF-9 (004) · 9.3: comentar una propuesta vencida cuyo cierre no se procesó se rechaza', async () => {
    ctx.setNow(new Date('2027-01-01T00:00:00Z'));
    expect(await codeOf(handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Tarde' }, beto))).toBe('amendment-closed');
  });

  it('RF-9 (004) · 9.1: una propuesta inexistente da amendment-not-found', async () => {
    expect(await codeOf(handleCommentAmendment(ctx, { amendmentId: 'nada', text: 'Hola' }, beto))).toBe('amendment-not-found');
  });

  it('RF-16 (004) · 16.1: un comentario de 10 000 caracteres se acepta y uno de 10 001 informa el exceso', async () => {
    await handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'a'.repeat(10000) }, beto);
    const promise = handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'a'.repeat(10001) }, beto);
    expect(await codeOf(promise)).toBe('text-too-long');
    await expect(handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'a'.repeat(10001) }, beto)).rejects.toThrow(/1/);
  });

  it('RF-16 (004) · 16.2: un comentario vacío da text-empty', async () => {
    expect(await codeOf(handleCommentAmendment(ctx, { amendmentId: 'a1', text: '   ' }, beto))).toBe('text-empty');
  });
});
