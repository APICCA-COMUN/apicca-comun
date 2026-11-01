// T-6.11 (004): objetar una propuesta (RF-10 (004) · 1–3, RF-16 (004) · 1–2, D-T4 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS } from '../../../shared/domain/limits';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleObjectAmendment } from './objectAmendment';

let ctx: TestCtx;
let ana: string;
let beto: string;
let cata: string;

const stance = async (uid: string) => (await ctx.db.doc(`amendments/a1/stances/${uid}`).get()).data();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  cata = (await seedAccount(ctx, { username: 'cata' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' } });
});

describe('objectAmendment', () => {
  it('RF-10 (004) · 10.1: una persona activa objeta con motivo y queda registrada en su postura y en el registro', async () => {
    const { objectionId } = await handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'No me convence.' }, beto);
    const objection = (await ctx.db.doc(`amendments/a1/objections/${objectionId}`).get()).data();
    expect(objection).toMatchObject({ uid: beto, username: 'beto', reason: 'No me convence.', status: 'open', closedAt: null, resolvedByRevision: null, closedBy: null });
    expect(await stance(beto)).toMatchObject({ agreement: 'none', openObjectionId: objectionId });
    const last = (await ctx.db.collection('amendments/a1/events').orderBy('seq').get()).docs.at(-1)?.data();
    expect(last).toMatchObject({ kind: 'objected', uid: beto, username: 'beto' });
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'x' }, ana))).toBe('own-amendment');
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'x' }, null))).toBe('unauthenticated');
  });

  it('RF-10 (004) · 10.2: una sola objeción abierta por persona', async () => {
    await handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'Una.' }, beto);
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'Dos.' }, beto))).toBe('objection-already-open');
    expect((await ctx.db.collection('amendments/a1/objections').get()).size).toBe(1);
  });

  it('RF-10 (004) · 10.3: con un acuerdo vigente se rechaza con object-with-agreement', async () => {
    await ctx.db.doc(`amendments/a1/stances/${cata}`).set({ username: 'cata', agreement: 'active', agreedAtRevision: 1, agreedAt: ctx.now(), openObjectionId: null, withdrawnReason: null });
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'Pero no.' }, cata))).toBe('object-with-agreement');
    expect((await ctx.db.collection('amendments/a1/objections').get()).size).toBe(0);
  });

  it('RF-10 (004) · 10.1: con acuerdo revocado sí puede objetar; propuesta cerrada da amendment-closed', async () => {
    await ctx.db.doc(`amendments/a1/stances/${cata}`).set({ username: 'cata', agreement: 'revoked', agreedAtRevision: 1, agreedAt: ctx.now(), openObjectionId: null, withdrawnReason: null });
    await handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'Ahora sí.' }, cata);
    ctx.setNow(new Date('2030-01-01T00:00:00Z'));
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'x' }, beto))).toBe('amendment-closed');
  });

  it('RF-16 (004) · 16.1: el motivo admite hasta el máximo; 16.2: el exceso y el vacío se rechazan', async () => {
    const ok = await handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'a'.repeat(LIMITS.reason) }, beto);
    expect(ok.objectionId).toBeTruthy();
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'a'.repeat(LIMITS.reason + 1) }, cata))).toBe('text-too-long');
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: '   ' }, cata))).toBe('text-empty');
    expect(await codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1' }, cata))).toBe('invalid-request');
  });
});
