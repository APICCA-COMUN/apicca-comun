// T-6.13 (004) · Acciones tardías: en el instante del vencimiento, sin que settleAmendment haya corrido, acordar,
// objetar, revisar y comentar se rechazan (RF-12 (004) · 12.6, RF-9 (004) · 9.3).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleAgreeAmendment } from './agreeAmendment';
import { handleCommentAmendment } from './commentAmendment';
import { handleObjectAmendment } from './objectAmendment';
import { handleReviseAmendment } from './reviseAmendment';

const OPENED = new Date('2026-10-01T12:00:00Z');
const CLOSES = new Date(OPENED.getTime() + 360 * 3_600_000);

let ctx: TestCtx;
let ana: string;
let beto: string;
let cata: string;

const agree = () => codeOf(handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto));
const object = () => codeOf(handleObjectAmendment(ctx, { amendmentId: 'a1', reason: 'No me convence.' }, cata));
const revise = () =>
  codeOf(handleReviseAmendment(ctx, { amendmentId: 'a1', baseRevision: 1, title: 'Agua', text: 'El agua es de todas.', motive: 'Más claro.' }, ana));
const comment = () => codeOf(handleCommentAmendment(ctx, { amendmentId: 'a1', text: 'Me gusta.' }, beto));

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: OPENED });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  cata = (await seedAccount(ctx, { username: 'cata' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, openedAt: OPENED, closesAt: CLOSES });
});

describe('acciones tardías', () => {
  it('RF-12 (004) · 12.6: acordar en el instante del vencimiento se rechaza con amendment-closed', async () => {
    ctx.setNow(CLOSES);
    expect(await agree()).toBe('amendment-closed');
  });

  it('RF-12 (004) · 12.6: objetar en el instante del vencimiento se rechaza con amendment-closed', async () => {
    ctx.setNow(CLOSES);
    expect(await object()).toBe('amendment-closed');
  });

  it('RF-12 (004) · 12.6: revisar en el instante del vencimiento se rechaza con amendment-closed', async () => {
    ctx.setNow(CLOSES);
    expect(await revise()).toBe('amendment-closed');
  });

  it('RF-9 (004) · 9.3: comentar en el instante del vencimiento se rechaza con amendment-closed', async () => {
    ctx.setNow(CLOSES);
    expect(await comment()).toBe('amendment-closed');
  });

  it('RF-12 (004) · 12.6: un milisegundo antes del vencimiento, acordar, objetar, revisar y comentar funcionan', async () => {
    ctx.setNow(new Date(CLOSES.getTime() - 1));
    expect(await agree()).toBeUndefined();
    expect(await object()).toBeUndefined();
    expect(await revise()).toBeUndefined();
    expect(await comment()).toBeUndefined();
    expect((await ctx.db.doc('amendments/a1').get()).get('isOpen')).toBe(true);
  });
});
