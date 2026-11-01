// T-7.6 (004) · `settleAmendments`: refleja el vencimiento a cuentas activas (RF-12 (004) · 12.5, D-T7 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution, seedSuspendedAccount } from '../testing/constitutionKit';
import { handleSettleAmendments } from './settleAmendments';

let ctx: TestCtx;
let ana: string;
let beto: string;
const OPENED = new Date('2026-10-01T12:00:00Z');

const open = async () => (await ctx.db.collection('amendments').where('isOpen', '==', true).get()).size;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: OPENED });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  const sections = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}` }));
  await seedConstitution(ctx, { isOpen: true, sections });
  for (let i = 0; i < 12; i += 1) {
    await seedAmendment(ctx, {
      id: `a${String(i).padStart(2, '0')}`, sectionId: `s${i}`, author: { uid: ana, username: 'ana' }, openedAt: OPENED,
      closesAt: new Date(OPENED.getTime() + (i + 1) * 3600_000), stances: [{ uid: beto, username: 'beto' }],
    });
  }
});

describe('settleAmendments', () => {
  it('RF-12 (004) · 12.5: la lectura refleja el cierre; con 12 vencidas procesa 10 y la siguiente llamada las 2 restantes', async () => {
    ctx.setNow(new Date(OPENED.getTime() + 24 * 3600_000));
    expect(await handleSettleAmendments(ctx, {}, ana)).toEqual({});
    expect(await open()).toBe(2);
    expect((await ctx.db.doc('amendments/a00').get()).get('result')).toBe('approved');
    expect(await handleSettleAmendments(ctx, {}, beto)).toEqual({});
    expect(await open()).toBe(0);
  });

  it('RF-12 (004) · 12.5: con id procesa solo esa propuesta; un id inexistente devuelve {}', async () => {
    ctx.setNow(new Date(OPENED.getTime() + 24 * 3600_000));
    expect(await handleSettleAmendments(ctx, { id: 'a05' }, ana)).toEqual({});
    expect(await open()).toBe(11);
    expect(await handleSettleAmendments(ctx, { id: 'nada' }, ana)).toEqual({});
  });

  it('RF-12 (004) · 12.5: sin sesión o con cuenta suspendida se rechaza', async () => {
    const susp = (await seedSuspendedAccount(ctx, { username: 'susi' })).uid;
    expect(await codeOf(handleSettleAmendments(ctx, {}, null))).toBe('unauthenticated');
    expect(await codeOf(handleSettleAmendments(ctx, {}, susp))).toBe('account-suspended');
  });
});
