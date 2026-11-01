// T-6.10 (004): acordar y revocar el acuerdo (RF-11 (004) · 1–3, D-T4 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleAgreeAmendment } from './agreeAmendment';
import { handleRevokeAgreement } from './revokeAgreement';

let ctx: TestCtx;
let ana: string;
let beto: string;
let cata: string;

const stance = async (uid: string) => (await ctx.db.doc(`amendments/a1/stances/${uid}`).get()).data();
const events = async () => (await ctx.db.collection('amendments/a1/events').orderBy('seq').get()).docs.map((d) => d.data());

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  cata = (await seedAccount(ctx, { username: 'cata' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, revisions: [{}] });
});

describe('agreeAmendment y revokeAgreement', () => {
  it('RF-11 (004) · 11.1: acordar guarda la postura con la revisión actual y repetir no hace nada', async () => {
    await handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto);
    expect(await stance(beto)).toMatchObject({ username: 'beto', agreement: 'active', agreedAtRevision: 2, openObjectionId: null });
    const before = (await events()).length;
    await handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto);
    expect((await events()).length).toBe(before);
    expect((await events()).at(-1)).toMatchObject({ kind: 'agreed', uid: beto, username: 'beto' });
  });

  it('RF-11 (004) · 11.1: revocar y volver a acordar; revocar sin acuerdo no hace nada', async () => {
    await handleRevokeAgreement(ctx, { amendmentId: 'a1' }, beto);
    expect(await stance(beto)).toBeUndefined();
    await handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto);
    await handleRevokeAgreement(ctx, { amendmentId: 'a1' }, beto);
    expect(await stance(beto)).toMatchObject({ agreement: 'revoked' });
    await handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto);
    expect(await stance(beto)).toMatchObject({ agreement: 'active' });
    expect((await events()).map((e) => e['kind'])).toEqual(['opened', 'agreed', 'agreement-revoked', 'agreed']);
  });

  it('RF-11 (004) · 11.2: con una objeción abierta, acordar da agree-with-objection', async () => {
    await ctx.db.doc('amendments/a1/objections/o1').set({ uid: cata, username: 'cata', reason: 'x', status: 'open', openedAt: ctx.now(), closedAt: null, resolvedByRevision: null, closedBy: null });
    await ctx.db.doc(`amendments/a1/stances/${cata}`).set({ username: 'cata', agreement: 'none', agreedAtRevision: null, agreedAt: null, openObjectionId: 'o1', withdrawnReason: null });
    expect(await codeOf(handleAgreeAmendment(ctx, { amendmentId: 'a1' }, cata))).toBe('agree-with-objection');
    expect((await stance(cata))?.['agreement']).toBe('none');
  });

  it('RF-11 (004) · 11.3: el acuerdo de quien propone no tiene documento y no acuerda ni revoca', async () => {
    expect(await codeOf(handleAgreeAmendment(ctx, { amendmentId: 'a1' }, ana))).toBe('own-amendment');
    expect(await codeOf(handleRevokeAgreement(ctx, { amendmentId: 'a1' }, ana))).toBe('own-amendment');
    expect(await stance(ana)).toBeUndefined();
  });

  it('RF-11 (004) · 11.1: sin sesión, suspendida, propuesta inexistente o cerrada', async () => {
    expect(await codeOf(handleAgreeAmendment(ctx, { amendmentId: 'a1' }, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${cata}`).update({ status: 'suspended' });
    expect(await codeOf(handleAgreeAmendment(ctx, { amendmentId: 'a1' }, cata))).toBe('account-suspended');
    expect(await codeOf(handleAgreeAmendment(ctx, { amendmentId: 'nada' }, beto))).toBe('amendment-not-found');
    expect(await codeOf(handleAgreeAmendment(ctx, {}, beto))).toBe('invalid-request');
    ctx.setNow(new Date('2030-01-01T00:00:00Z'));
    expect(await codeOf(handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto))).toBe('amendment-closed');
    expect(await codeOf(handleRevokeAgreement(ctx, { amendmentId: 'a1' }, beto))).toBe('amendment-closed');
  });
});
