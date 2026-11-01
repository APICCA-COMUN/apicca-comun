// T-1.27 y T-1.28: suspender y reactivar cuentas, con efecto inmediato (RF-5 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { requireActor } from '../access';
import { ApiError } from '../errors';
import { Timestamp } from 'firebase-admin/firestore';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleReactivateAccount } from './reactivateAccount';
import { handleSuspendAccount } from './suspendAccount';

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

let ctx: TestCtx;
let facilitator: string;
let member: string;

const status = async (uid: string) => (await ctx.db.doc(`accounts/${uid}`).get()).get('status');

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  facilitator = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  member = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('suspendAccount y reactivateAccount', () => {
  it('RF-5 (001): suspender cambia el estado y revoca los refresh tokens', async () => {
    const before = Date.parse((await ctx.auth.getUser(member)).tokensValidAfterTime ?? '');
    await new Promise((resolve) => setTimeout(resolve, 1100)); // la marca tiene resolución de segundos
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    expect(await status(member)).toBe('suspended');
    expect(Date.parse((await ctx.auth.getUser(member)).tokensValidAfterTime ?? '')).toBeGreaterThan(before);
  });

  it('RF-5 (001): reactivar devuelve la cuenta a activa', async () => {
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    await handleReactivateAccount(ctx, { uid: member }, facilitator);
    expect(await status(member)).toBe('active');
  });

  it('RF-5 (001): no se suspende a otro facilitador ni a sí misma', async () => {
    const other = (await seedAccount(ctx, { username: 'fede', role: 'facilitator' })).uid;
    expect(await codeOf(handleSuspendAccount(ctx, { uid: other }, facilitator))).toBe('cannot-suspend-facilitator');
    expect(await codeOf(handleSuspendAccount(ctx, { uid: facilitator }, facilitator))).toBe('cannot-suspend-self');
    expect(await status(other)).toBe('active');
    expect(await status(facilitator)).toBe('active');
  });

  it('RF-5 (001): quien no es facilitador no suspende ni reactiva', async () => {
    const third = (await seedAccount(ctx, { username: 'beto' })).uid;
    expect(await codeOf(handleSuspendAccount(ctx, { uid: third }, member))).toBe('forbidden');
    await handleSuspendAccount(ctx, { uid: third }, facilitator);
    expect(await codeOf(handleReactivateAccount(ctx, { uid: third }, member))).toBe('forbidden');
  });

  it('RF-5 (001): una cuenta inexistente o un payload sin uid se rechaza', async () => {
    expect(await codeOf(handleSuspendAccount(ctx, { uid: 'nadie' }, facilitator))).toBe('invalid-request');
    expect(await codeOf(handleReactivateAccount(ctx, {}, facilitator))).toBe('invalid-request');
  });
});

describe('suspensión inmediata', () => {
  it('RF-5 (001): la siguiente op de la persona suspendida falla sin esperar a que caduque su token', async () => {
    await requireActor(ctx, member);
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    expect(await codeOf(requireActor(ctx, member))).toBe('account-suspended');
    await handleReactivateAccount(ctx, { uid: member }, facilitator);
    await expect(requireActor(ctx, member)).resolves.toMatchObject({ uid: member });
  });

  it('RF-5 (001): el nombre de usuario y el contenido de la cuenta suspendida siguen ahí', async () => {
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    expect((await ctx.db.doc('usernames/ana').get()).get('uid')).toBe(member);
    expect(await ctx.db.doc(`accounts/${member}`).get()).toMatchObject({ exists: true });
    expect((await ctx.db.doc(`accounts/${member}`).get()).get('username')).toBe('ana');
  });
});

describe('suspensión y propuestas (T-8.1, RF-14 (004))', () => {
  let ana: string;
  const stanceOf = async (id: string) => (await ctx.db.doc(`amendments/${id}/stances/${member}`).get()).data();

  beforeEach(async () => {
    ana = (await seedAccount(ctx, { username: 'anaa' })).uid;
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 's2' }] });
    const author = { uid: ana, username: 'anaa' };
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author, stances: [{ uid: member, username: 'ana' }] });
    await seedAmendment(ctx, { id: 'a2', sectionId: 's2', author, objections: [{ id: 'o1', uid: member, username: 'ana' }] });
  });

  it('RF-14 (004) · 14.1: al suspender se retiran el acuerdo y la objeción abierta, con la marca de cuenta inactiva', async () => {
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    expect(await status(member)).toBe('suspended');
    expect(await stanceOf('a1')).toMatchObject({ agreement: 'withdrawn', withdrawnReason: 'inactive' });
    expect(await stanceOf('a2')).toMatchObject({ openObjectionId: null });
    const objection = (await ctx.db.doc('amendments/a2/objections/o1').get()).data();
    expect(objection).toMatchObject({ status: 'withdrawn', closedBy: 'inactive', resolvedByRevision: null });
    expect((objection?.['closedAt'] as Timestamp).toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
  });

  it('RF-14 (004) · 14.1: si la transacción falla, no cambian ni el estado ni las posturas', async () => {
    await ctx.db.doc('amendments/a2').update({ eventSeq: 0 }); // el evento 1 ya existe: el commit falla por completo
    await expect(handleSuspendAccount(ctx, { uid: member }, facilitator)).rejects.toThrow();
    expect(await status(member)).toBe('active');
    expect(await stanceOf('a1')).toMatchObject({ agreement: 'active', withdrawnReason: null });
    expect((await ctx.db.doc('amendments/a2/objections/o1').get()).get('status')).toBe('open');
    expect((await ctx.db.collection('amendments/a1/events').get()).size).toBe(1);
  });

  it('RF-14 (004) · 14.1: las propuestas cerradas y las posturas de otras personas no se tocan', async () => {
    const other = (await seedAccount(ctx, { username: 'beto' })).uid;
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] });
    await seedAmendment(ctx, { id: 'a3', sectionId: 's3', author: { uid: ana, username: 'anaa' }, isOpen: false, result: 'approved', stances: [{ uid: member, username: 'ana' }] });
    await ctx.db.doc(`amendments/a1/stances/${other}`).set({ username: 'beto', agreement: 'active', agreedAtRevision: 1, agreedAt: null, openObjectionId: null, withdrawnReason: null });
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    expect((await ctx.db.doc(`amendments/a3/stances/${member}`).get()).get('agreement')).toBe('active');
    expect((await ctx.db.doc(`amendments/a1/stances/${other}`).get()).get('agreement')).toBe('active');
  });

  it('RNF-1 (004): el retiro por suspensión deja evento con quién y cuándo, con el nombre de usuario de ese momento', async () => {
    await ctx.db.doc(`accounts/${facilitator}`).update({ username: 'fabiana' });
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    const events = await ctx.db.collection('amendments/a1/events').orderBy('seq').get();
    expect(events.size).toBe(2);
    const event = events.docs[1]!.data();
    expect(event).toMatchObject({ kind: 'stance-withdrawn-inactive', uid: facilitator, username: 'fabiana', detail: { subjectUid: member, subjectUsername: 'ana' } });
    expect((event['at'] as Timestamp).toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
    expect((await ctx.db.collection('amendments/a2/events').get()).size).toBe(2);
  });
});

describe('suspensión y propuestas propias (D-T9 (004))', () => {
  it('RF-14 (004) · 14.7: suspender a quien propuso marca sus propuestas abiertas y reactivarla las desmarca', async () => {
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 's2' }] });
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: member, username: 'ana' } });
    await seedAmendment(ctx, { id: 'a2', sectionId: 's2', author: { uid: facilitator, username: 'fabi' } });
    const flag = async (id: string) => (await ctx.db.doc(`amendments/${id}`).get()).get('authorSuspended');
    await handleSuspendAccount(ctx, { uid: member }, facilitator);
    expect(await flag('a1')).toBe(true);
    expect(await flag('a2')).not.toBe(true);
    await handleReactivateAccount(ctx, { uid: member }, facilitator);
    expect(await flag('a1')).toBe(false);
  });
});
