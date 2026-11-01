// T-8.6 (004): reactivar una cuenta no restituye posturas y devuelve a quien propone sus acciones (RF-14 (004) · 14.5, 14.6, 14.8).
import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateClose } from '../../../shared/domain/constitution';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleReactivateAccount } from './reactivateAccount';
import { handleReviseAmendment } from './reviseAmendment';
import { handleSuspendAccount } from './suspendAccount';
import { handleWithdrawAmendment } from './withdrawAmendment';

let ctx: TestCtx;
let fabi: string;
let ana: string;
let beto: string;

const body = { amendmentId: 'a1', baseRevision: 1, title: 'Título nuevo', text: 'Texto nuevo.', motive: 'Motivo nuevo.' };
const accountStatus = async (uid: string) => (await ctx.db.doc(`accounts/${uid}`).get()).get('status');

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 's2' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, stances: [{ uid: beto, username: 'beto' }] });
  await seedAmendment(ctx, { id: 'a2', sectionId: 's2', author: { uid: fabi, username: 'fabi' }, objections: [{ id: 'o1', uid: ana, username: 'ana' }] });
});

describe('reactivateAccount y propuestas', () => {
  it('RF-14 (004) · 14.5: quien propuso, suspendida, no revisa ni retira; reactivada, vuelve a poder', async () => {
    await handleSuspendAccount(ctx, { uid: ana }, fabi);
    expect(await codeOf(handleReviseAmendment(ctx, body, ana))).toBe('account-suspended');
    expect(await codeOf(handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana))).toBe('account-suspended');
    await handleReactivateAccount(ctx, { uid: ana }, fabi);
    expect(await handleReviseAmendment(ctx, body, ana)).toEqual({ ok: true, revisionNo: 2 });
    await handleWithdrawAmendment(ctx, { amendmentId: 'a1' }, ana);
    expect(await ctx.db.doc('amendments/a1').get()).toMatchObject({ exists: true });
    expect((await ctx.db.doc('amendments/a1').get()).get('isOpen')).toBe(false);
  });

  it('RF-14 (004) · 14.6: reactivar no restituye el acuerdo ni la objeción retirados', async () => {
    await handleSuspendAccount(ctx, { uid: beto }, fabi);
    await handleSuspendAccount(ctx, { uid: ana }, fabi);
    await handleReactivateAccount(ctx, { uid: beto }, fabi);
    await handleReactivateAccount(ctx, { uid: ana }, fabi);
    expect((await ctx.db.doc(`amendments/a1/stances/${beto}`).get()).data()).toMatchObject({ agreement: 'withdrawn', withdrawnReason: 'inactive' });
    expect((await ctx.db.doc('amendments/a2/objections/o1').get()).data()).toMatchObject({ status: 'withdrawn', closedBy: 'inactive' });
    expect((await ctx.db.doc(`amendments/a2/stances/${ana}`).get()).get('openObjectionId')).toBeNull();
    expect((await ctx.db.doc('amendments/a1').get()).get('isOpen')).toBe(true);
  });

  it('RF-14 (004) · 14.8: el acuerdo implícito de quien propone vuelve a contar tras reactivarla (la cuenta se relee en cada cierre)', async () => {
    // 4 cuentas activas, un acuerdo ajeno: con el implícito 2 × 2 ≥ 4 aprueba; sin él, 2 × 1 < 4.
    const closeFor = async () => {
      const authorActive = (await accountStatus(ana)) === 'active';
      return evaluateClose({ activeAccounts: authorActive ? 4 : 3, otherAgreements: 1, openObjections: 0, authorActive, alreadyExtended: false });
    };
    expect((await closeFor()).result).toBe('approved');
    await handleSuspendAccount(ctx, { uid: ana }, fabi);
    expect(await closeFor()).toMatchObject({ result: 'extended', authorAgreementCounted: false });
    await handleReactivateAccount(ctx, { uid: ana }, fabi);
    expect(await closeFor()).toMatchObject({ result: 'approved', authorAgreementCounted: true });
  });
});
