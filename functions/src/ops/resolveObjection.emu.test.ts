// T-6.12 (004): resolver o retirar una objeción (RF-10 (004) · 4, RNF-1 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleAgreeAmendment } from './agreeAmendment';
import { handleResolveObjection } from './resolveObjection';
import { handleWithdrawObjection } from './withdrawObjection';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;

const objection = async () => (await ctx.db.doc('amendments/a1/objections/o1').get()).data();
const stance = async () => (await ctx.db.doc(`amendments/a1/stances/${beto}`).get()).data();
const lastEvent = async () => (await ctx.db.collection('amendments/a1/events').orderBy('seq').get()).docs.at(-1)?.data();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, {
    id: 'a1',
    sectionId: 's1',
    author: { uid: ana, username: 'ana' },
    revisions: [{}],
    objections: [{ id: 'o1', uid: beto, username: 'beto' }],
  });
});

describe('resolveObjection y withdrawObjection', () => {
  it('RF-10 (004) · 10.4: quien objetó la da por resuelta sin revisión y luego puede acordar', async () => {
    await handleResolveObjection(ctx, { amendmentId: 'a1', objectionId: 'o1' }, beto);
    expect(await objection()).toMatchObject({ status: 'resolved', resolvedByRevision: null, closedBy: 'author' });
    expect(((await objection())?.['closedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-10-01T12:00:00.000Z');
    expect(await stance()).toMatchObject({ openObjectionId: null });
    expect(await lastEvent()).toMatchObject({ kind: 'objection-resolved', uid: beto, username: 'beto' });
    await handleAgreeAmendment(ctx, { amendmentId: 'a1' }, beto);
    expect(await stance()).toMatchObject({ agreement: 'active' });
  });

  it('RF-10 (004) · 10.4: se resuelve con la revisión que la atiende, que no puede ser futura', async () => {
    expect(await codeOf(handleResolveObjection(ctx, { amendmentId: 'a1', objectionId: 'o1', resolvedByRevision: 3 }, beto))).toBe('invalid-request');
    await handleResolveObjection(ctx, { amendmentId: 'a1', objectionId: 'o1', resolvedByRevision: 2 }, beto);
    expect(await objection()).toMatchObject({ status: 'resolved', resolvedByRevision: 2 });
  });

  it('RF-10 (004) · 10.4: quien objetó la retira y queda en el registro', async () => {
    await handleWithdrawObjection(ctx, { amendmentId: 'a1', objectionId: 'o1' }, beto);
    expect(await objection()).toMatchObject({ status: 'withdrawn', closedBy: 'author' });
    expect(await stance()).toMatchObject({ openObjectionId: null });
    expect(await lastEvent()).toMatchObject({ kind: 'objection-withdrawn', uid: beto });
    expect(await codeOf(handleWithdrawObjection(ctx, { amendmentId: 'a1', objectionId: 'o1' }, beto))).toBe('invalid-request');
  });

  it('RF-10 (004) · 10.4: otra persona, facilitador incluido, recibe forbidden y nada cambia', async () => {
    for (const uid of [ana, fabi]) {
      expect(await codeOf(handleResolveObjection(ctx, { amendmentId: 'a1', objectionId: 'o1' }, uid))).toBe('forbidden');
      expect(await codeOf(handleWithdrawObjection(ctx, { amendmentId: 'a1', objectionId: 'o1' }, uid))).toBe('forbidden');
    }
    expect(await objection()).toMatchObject({ status: 'open' });
    expect(await stance()).toMatchObject({ openObjectionId: 'o1' });
  });

  it('RF-10 (004) · 10.4: sin sesión, objeción inexistente o propuesta cerrada', async () => {
    expect(await codeOf(handleResolveObjection(ctx, { amendmentId: 'a1', objectionId: 'o1' }, null))).toBe('unauthenticated');
    expect(await codeOf(handleResolveObjection(ctx, { amendmentId: 'a1', objectionId: 'zz' }, beto))).toBe('invalid-request');
    expect(await codeOf(handleWithdrawObjection(ctx, { amendmentId: 'a1' }, beto))).toBe('invalid-request');
    ctx.setNow(new Date('2030-01-01T00:00:00Z'));
    expect(await codeOf(handleWithdrawObjection(ctx, { amendmentId: 'a1', objectionId: 'o1' }, beto))).toBe('amendment-closed');
  });
});
