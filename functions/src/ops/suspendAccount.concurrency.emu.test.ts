// T-8.4 (004) · Suspensión con 120 propuestas abiertas y frente a un acuerdo concurrente (RF-14 (004) · 14.1, D-T9 (004), D-12 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment } from '../testing/constitutionKit';
import { planStanceWithdrawals } from '../withdrawStances';
import { handleAgreeAmendment } from './agreeAmendment';
import { handleSuspendAccount } from './suspendAccount';

let ctx: TestCtx;
let fabi: string;
let ana: string;
let beto: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
});

const COUNT = 120;

describe('suspendAccount · 120 propuestas y concurrencia', () => {
  it('RF-14 (004) · 14.1: 120 propuestas abiertas (sobre el máximo de 100) caben en una transacción y se retiran todas', async () => {
    for (let i = 1; i <= COUNT; i += 1) {
      const author = { uid: ana, username: 'ana' };
      const id = `a${i}`;
      await seedAmendment(
        ctx,
        i % 2 === 0
          ? { id, sectionId: `s${i}`, author, stances: [{ uid: beto, username: 'beto' }] }
          : { id, sectionId: `s${i}`, author, objections: [{ id: 'o1', uid: beto, username: 'beto' }] },
      );
    }
    const plan = await ctx.db.runTransaction((tx) => planStanceWithdrawals(ctx, tx, beto, 'beto'));
    expect(plan.withdrawals).toHaveLength(COUNT);
    // 60 × 3 + 60 × 4 = 420 escrituras más la de la cuenta: por debajo de las 500 de una transacción (peor caso: 4 × 120 + 1 = 481).
    expect(plan.writeCount + 1).toBeLessThanOrEqual(500);
    await handleSuspendAccount(ctx, { uid: beto }, fabi);
    expect((await ctx.db.doc(`accounts/${beto}`).get()).get('status')).toBe('suspended');
    expect((await ctx.db.collectionGroup('stances').where('agreement', '==', 'active').get()).size).toBe(0);
    expect((await ctx.db.collectionGroup('objections').where('status', '==', 'open').get()).size).toBe(0);
    expect((await ctx.db.collectionGroup('events').where('kind', '==', 'stance-withdrawn-inactive').get()).size).toBe(COUNT);
  }, 30_000);

  for (let round = 1; round <= 5; round += 1) {
    it(`RF-14 (004) · 14.1: un acuerdo concurrente frente a la suspensión no sobrevive (corrida ${round})`, async () => {
      await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' } });
      const [agreeCode] = await Promise.all([
        codeOf(handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto)),
        codeOf(handleSuspendAccount(ctx, { uid: beto }, fabi)),
      ]);
      expect([undefined, 'account-suspended']).toContain(agreeCode);
      expect((await ctx.db.doc(`accounts/${beto}`).get()).get('status')).toBe('suspended');
      expect((await ctx.db.collectionGroup('stances').where('agreement', '==', 'active').get()).size).toBe(0);
    }, 30_000);
  }
});
