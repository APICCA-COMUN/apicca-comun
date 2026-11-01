// T-6.7 (004): retirar una propuesta propia (RF-8 (004) · 8.3, 8.4, RF-14 (004) · 14.4, RNF-1 (004), RF-12 (004) · 12.6).
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleWithdrawAmendment } from './withdrawAmendment';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;

const amendment = async () => (await ctx.db.doc('amendments/a1').get()).data() as Record<string, unknown>;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, {
    id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, title: 'Título', text: 'Texto.', motive: 'Motivo.',
    stances: [{ uid: beto, username: 'beto' }],
  });
});

describe('withdrawAmendment', () => {
  it('RF-8 (004) · 8.3: quien propuso la retira; result withdrawn, contenido intacto, cerradura y marca liberadas, evento registrado', async () => {
    ctx.setNow(new Date('2026-10-03T08:00:00Z'));
    expect(await handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana)).toEqual({});
    const doc = await amendment();
    expect(doc).toMatchObject({ isOpen: false, result: 'withdrawn', title: 'Título', text: 'Texto.', motive: 'Motivo.', eventSeq: 2 });
    expect((doc['closedAt'] as Timestamp).toDate().toISOString()).toBe('2026-10-03T08:00:00.000Z');
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).exists).toBe(false);
    expect((await ctx.db.doc('constitutionSections/s1/private/meta').get()).get('openAmendment')).toBeNull();
    expect((await ctx.db.doc('amendments/a1/events/2').get()).data()).toMatchObject({ seq: 2, kind: 'withdrawn', uid: ana, username: 'ana' });
    expect((await ctx.db.doc(`amendments/a1/stances/${beto}`).get()).exists).toBe(true);
  });

  it('RF-8 (004) · 8.4: otra persona, facilitador incluido, no retira una propuesta ajena', async () => {
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, beto))).toBe('not-amendment-author');
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, fabi))).toBe('not-amendment-author');
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, null))).toBe('unauthenticated');
    expect((await amendment())['isOpen']).toBe(true);
  });

  it('RF-8 (004) · 8.3: una propuesta cerrada o inexistente no se retira; retirada, el lugar queda libre', async () => {
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'nada' }, ana))).toBe('amendment-not-found');
    await handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana);
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana))).toBe('amendment-closed');
  });

  it('RF-12 (004) · 12.6: una propuesta vencida sin procesar no se retira', async () => {
    ctx.setNow(new Date('2026-10-16T12:00:00Z'));
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana))).toBe('amendment-closed');
  });

  it('RF-14 (004) · 14.4: con la cuenta suspendida la retirada se rechaza y, reactivada, se acepta (14.5)', async () => {
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'suspended' });
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana))).toBe('account-suspended');
    expect((await amendment())['isOpen']).toBe(true);
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'active' });
    await handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana);
    expect((await amendment())['result']).toBe('withdrawn');
  });
});
