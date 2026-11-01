// T-8.2 (004): plan de retiro de posturas al dejar de estar activa una cuenta (RF-14 (004) · 14.1, D-T9 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { seedAmendment, seedConstitution } from './testing/constitutionKit';
import { applyStanceWithdrawals, planStanceWithdrawals } from './withdrawStances';

let ctx: TestCtx;
let ana: string;
let beto: string;
let carla: string;
let dani: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  carla = (await seedAccount(ctx, { username: 'carla' })).uid;
  dani = (await seedAccount(ctx, { username: 'dani' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] });
  const author = { uid: ana, username: 'ana' };
  await seedAmendment(ctx, {
    id: 'a1', sectionId: 's1', author,
    stances: [{ uid: beto, username: 'beto' }, { uid: dani, username: 'dani' }],
  });
  await seedAmendment(ctx, { id: 'a2', sectionId: 's2', author, objections: [{ id: 'o1', uid: beto, username: 'beto' }] });
  await seedAmendment(ctx, { id: 'a3', sectionId: 's3', author, isOpen: false, result: 'approved', stances: [{ uid: beto, username: 'beto' }] });
});

describe('withdrawStances', () => {
  it('RF-14 (004) · 14.1: el plan cubre solo las propuestas abiertas donde la persona tiene postura, sin escribir', async () => {
    const plan = await ctx.db.runTransaction((tx) => planStanceWithdrawals(ctx, tx, beto, 'beto'));
    expect(plan.withdrawals.map((item) => item.open.amendment.id).sort()).toEqual(['a1', 'a2']);
    const a1 = plan.withdrawals.find((item) => item.open.amendment.id === 'a1');
    const a2 = plan.withdrawals.find((item) => item.open.amendment.id === 'a2');
    expect(a1?.stanceUpdate).toEqual({ agreement: 'withdrawn', withdrawnReason: 'inactive' });
    expect(a1?.objectionUpdate).toBeNull();
    expect(a2?.stanceUpdate).toEqual({ openObjectionId: null });
    expect(a2?.objectionUpdate).toMatchObject({ status: 'withdrawn', closedBy: 'inactive', resolvedByRevision: null });
    // postura + evento + contador (3) en a1; más la objeción (4) en a2.
    expect(plan.writeCount).toBe(7);
    expect((await ctx.db.doc(`amendments/a1/stances/${beto}`).get()).get('agreement')).toBe('active');
    expect((await ctx.db.doc('amendments/a2/objections/o1').get()).get('status')).toBe('open');
    expect((await ctx.db.collection('amendments/a1/events').get()).size).toBe(1);
  });

  it('RF-14 (004) · 14.1: quien no tiene postura o la tiene ya retirada no genera retiros', async () => {
    expect((await ctx.db.runTransaction((tx) => planStanceWithdrawals(ctx, tx, carla, 'carla'))).withdrawals).toEqual([]);
    expect((await ctx.db.runTransaction((tx) => planStanceWithdrawals(ctx, tx, ana, 'ana'))).withdrawals).toEqual([]);
  });

  it('RF-14 (004) · 14.1: aplicar el plan escribe retiro y un evento por propuesta con la hora del servidor', async () => {
    await ctx.db.runTransaction(async (tx) => {
      const plan = await planStanceWithdrawals(ctx, tx, beto, 'beto');
      applyStanceWithdrawals(ctx, tx, plan, { uid: dani, username: 'dani' });
    });
    expect((await ctx.db.doc(`amendments/a1/stances/${beto}`).get()).data()).toMatchObject({ agreement: 'withdrawn', withdrawnReason: 'inactive' });
    expect((await ctx.db.doc(`amendments/a1/stances/${dani}`).get()).get('agreement')).toBe('active');
    expect((await ctx.db.doc('amendments/a2/objections/o1').get()).data()).toMatchObject({ status: 'withdrawn', closedBy: 'inactive' });
    expect((await ctx.db.doc(`amendments/a2/stances/${beto}`).get()).get('openObjectionId')).toBeNull();
    expect((await ctx.db.doc('amendments/a3/stances/' + beto).get()).get('agreement')).toBe('active');
    const event = (await ctx.db.doc('amendments/a1/events/2').get()).data();
    expect(event).toMatchObject({ seq: 2, kind: 'stance-withdrawn-inactive', uid: dani, username: 'dani' });
    expect((await ctx.db.doc('amendments/a1').get()).get('eventSeq')).toBe(2);
  });
});
