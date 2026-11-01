// T-6.9 (004) · Archivar un comentario (RF-9 (004) · 9.2, RNF-1 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution, seedSuspendedAccount } from '../testing/constitutionKit';
import { handleArchiveComment } from './archiveComment';
import { handleCommentAmendment } from './commentAmendment';

let ctx: TestCtx;
let ana: string;
let beto: string;
let cata: string;
let fabi: string;
let suspended: string;
let commentId: string;

const data = async (path: string) => (await ctx.db.doc(path).get()).data() as Record<string, unknown> | undefined;
const iso = (value: unknown) => (value as { toDate(): Date }).toDate().toISOString();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  cata = (await seedAccount(ctx, { username: 'cata' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  suspended = (await seedSuspendedAccount(ctx, { username: 'susi' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' } });
  commentId = (await handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Dije algo.' }, beto)).id;
  ctx.setNow(new Date('2026-10-02T12:00:00Z'));
});

describe('archiveComment', () => {
  it('RF-9 (004) · 9.2: la autora archiva su comentario; queda el marcador con quién y el texto se conserva', async () => {
    expect(await handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, beto)).toEqual({});
    const comment = await data(`amendments/a1/comments/${commentId}`);
    expect(comment).toMatchObject({ archived: true, archivedBy: beto, archivedByUsername: 'beto', text: 'Dije algo.' });
    expect(iso(comment!['archivedAt'])).toBe('2026-10-02T12:00:00.000Z');
  });

  it('RF-9 (004) · 9.2: un facilitador archiva el comentario de otra persona y el marcador lo nombra', async () => {
    await handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, fabi);
    expect(await data(`amendments/a1/comments/${commentId}`)).toMatchObject({ archived: true, archivedBy: fabi, archivedByUsername: 'fabi', text: 'Dije algo.' });
  });

  it('RF-9 (004) · 9.2: una tercera persona recibe forbidden y el comentario no cambia', async () => {
    expect(await codeOf(handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, cata))).toBe('forbidden');
    expect((await data(`amendments/a1/comments/${commentId}`))!['archived']).toBe(false);
  });

  it('RNF-1 (004): archivar deja el evento comment-archived con quién y cuándo', async () => {
    await handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, fabi);
    const event = await data('amendments/a1/events/3');
    expect(event).toMatchObject({ seq: 3, kind: 'comment-archived', uid: fabi, username: 'fabi', detail: { commentId } });
  });

  it('RF-9 (004) · 9.2: archivar otra vez no cambia el marcador ni suma eventos', async () => {
    await handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, beto);
    ctx.setNow(new Date('2026-10-03T12:00:00Z'));
    await handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, fabi);
    expect(await data(`amendments/a1/comments/${commentId}`)).toMatchObject({ archivedBy: beto });
    expect(await data('amendments/a1/events/4')).toBeUndefined();
  });

  it('RF-9 (004) · 9.2: sin sesión o con la cuenta suspendida se rechaza', async () => {
    expect(await codeOf(handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, null))).toBe('unauthenticated');
    expect(await codeOf(handleArchiveComment(ctx, { amendmentId: 'a1', commentId }, suspended))).toBe('account-suspended');
  });

  it('RF-9 (004) · 9.2: un comentario inexistente da comment-not-found', async () => {
    expect(await codeOf(handleArchiveComment(ctx, { amendmentId: 'a1', commentId: 'nada' }, fabi))).toBe('comment-not-found');
  });
});
