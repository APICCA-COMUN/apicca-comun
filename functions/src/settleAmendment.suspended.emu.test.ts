// T-8.5 (004) · Cierre con cuentas suspendidas (RF-14 (004) · 14.2, 14.3, 14.7, 14.8; D-10 (004), D-T8 (004)).
import { describe, expect, it } from 'vitest';
import { settleAmendment } from './amendmentStore';
import { handleReactivateAccount } from './ops/reactivateAccount';
import { handleSuspendAccount } from './ops/suspendAccount';
import { clearEmulators, createTestCtx, seedAccount } from './testing';
import { seedAmendment, seedConstitution } from './testing/constitutionKit';

const OPENED = new Date('2026-10-01T12:00:00Z');
const CLOSES = new Date('2026-10-16T12:00:00Z');

/** `n` cuentas activas (ana propone), `agreements` ajenos de acuerdo y `suspended` cuentas suspendidas aparte. */
async function setup(active: number, agreements: number, suspended = 0) {
  await clearEmulators();
  const ctx = createTestCtx({ now: OPENED });
  const ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  const fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  const others: { uid: string; username: string }[] = [];
  for (let i = 0; i < active - 2; i += 1) others.push({ uid: (await seedAccount(ctx, { username: `p${i}` })).uid, username: `p${i}` });
  for (let i = 0; i < suspended; i += 1) await seedAccount(ctx, { username: `s${i}`, status: 'suspended' });
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, openedAt: OPENED, stances: others.slice(0, agreements).map((p) => ({ uid: p.uid, username: p.username })) });
  return { ctx, ana, fabi, others };
}

describe('settleAmendment con cuentas suspendidas', () => {
  // activas (ana y fabi incluidas), acuerdos ajenos, suspendidas → resultado
  it.each([
    [3, 1, 0, 'approved'],
    [3, 1, 5, 'approved'], // las suspendidas no suben el umbral
    [4, 1, 0, 'approved'],
    [4, 1, 3, 'approved'],
    [4, 0, 2, 'extended'],
    [5, 1, 0, 'extended'],
    [5, 1, 4, 'extended'],
  ] as const)('RF-14 (004) · 14.2: %i activas, %i acuerdos, %i suspendidas → %s', async (active, agreements, suspended, expected) => {
    const { ctx } = await setup(active, agreements, suspended);
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe(expected);
  });

  it('RF-14 (004) · 14.3: si se suspende quien propone, la propuesta sigue abierta y se cierra por las mismas reglas', async () => {
    const { ctx, ana, fabi } = await setup(4, 1);
    await handleSuspendAccount(ctx, { uid: ana }, fabi);
    expect((await ctx.db.doc('amendments/a1').get()).get('isOpen')).toBe(true);
    ctx.setNow(CLOSES);
    // quedan 3 activas; el acuerdo ajeno solo suma 1 (el de ana no cuenta): 2 × 1 < 3
    expect(await settleAmendment(ctx, 'a1')).toBe('extended');
    ctx.setNow(new Date('2026-10-31T12:00:00Z'));
    expect(await settleAmendment(ctx, 'a1')).toBe('rejected');
    expect((await ctx.db.doc('amendments/a1').get()).get('reasons')).toEqual(['insufficient_agreements']);
  });

  it('RF-14 (004) · 14.7: mientras siga suspendida, su acuerdo implícito no cuenta; con 3 y 4 activas la tabla cambia', async () => {
    // 4 cuentas: ana, fabi, p0, p1; p0 de acuerdo. Con ana activa: 2 × 2 ≥ 4 aprueba. Suspendida ana: 3 activas, 2 × 1 < 3.
    const withAna = await setup(4, 1);
    withAna.ctx.setNow(CLOSES);
    expect(await settleAmendment(withAna.ctx, 'a1')).toBe('approved');
    const without = await setup(4, 1);
    await without.ctx.db.doc(`accounts/${without.ana}`).update({ status: 'suspended' });
    without.ctx.setNow(CLOSES);
    expect(await settleAmendment(without.ctx, 'a1')).toBe('extended');
    // 3 cuentas: ana, fabi, p0 con acuerdo. Suspendida ana: 2 activas, 2 × 1 ≥ 2 aprueba (el acuerdo ajeno basta).
    const three = await setup(3, 1);
    await three.ctx.db.doc(`accounts/${three.ana}`).update({ status: 'suspended' });
    three.ctx.setNow(CLOSES);
    expect(await settleAmendment(three.ctx, 'a1')).toBe('approved');
    expect((await three.ctx.db.doc('amendments/a1').get()).get('agreementsCounted')).toBe(1);
  });

  it('RF-14 (004) · 14.8: suspendida y reactivada antes del cierre, su acuerdo implícito vuelve a contar', async () => {
    const { ctx, ana, fabi } = await setup(4, 1);
    await handleSuspendAccount(ctx, { uid: ana }, fabi);
    await handleReactivateAccount(ctx, { uid: ana }, fabi);
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe('approved');
    expect((await ctx.db.doc('amendments/a1').get()).get('agreementsCounted')).toBe(2);
  });
});
