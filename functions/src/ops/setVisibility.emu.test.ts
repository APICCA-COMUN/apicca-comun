// T-3.5: cambiar la visibilidad de un ápice y dejar el evento (RF-13 (001), RNF-6 (001), D-T19 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { canView } from '../../../shared/domain/access';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { handleCreateApice } from './createApice';
import { handleSetVisibility } from './setVisibility';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;
let id: string;

const doc = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const events = async () => (await ctx.db.collection(`apices/${id}/events`).get()).docs.map((d) => d.data());

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
});

describe('setVisibility', () => {
  it('RF-13 (001): la autora la hace pública y queda el evento con quién y cuándo', async () => {
    ctx.setNow(new Date('2026-09-02T09:00:00Z'));
    expect(await handleSetVisibility(ctx, { id, visibility: 'public' }, ana)).toEqual({});
    expect((await doc())['visibility']).toBe('public');
    const [event] = await events();
    expect(event).toMatchObject({ type: 'visibility', byUid: ana, byUsername: 'ana', detail: { from: 'private', to: 'public' } });
    expect((event?.['at'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-02T09:00:00.000Z');
  });

  it('RF-13 (001): una facilitadora la cambia en un ápice ajeno', async () => {
    await handleSetVisibility(ctx, { id, visibility: 'public' }, fabi);
    expect((await doc())['visibility']).toBe('public');
    expect((await events())[0]).toMatchObject({ byUsername: 'fabi' });
  });

  it('RF-13 (001): otra persona inscrita, un visitante o una cuenta suspendida reciben error y no cambia nada', async () => {
    expect(await codeOf(handleSetVisibility(ctx, { id, visibility: 'public' }, beto))).toBe('forbidden');
    expect(await codeOf(handleSetVisibility(ctx, { id, visibility: 'public' }, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'suspended' });
    expect(await codeOf(handleSetVisibility(ctx, { id, visibility: 'public' }, ana))).toBe('account-suspended');
    expect((await doc())['visibility']).toBe('private');
    expect(await events()).toHaveLength(0);
  });

  it('RF-13 (001): al pasarlo a privado un visitante deja de verlo y las versiones siguen', async () => {
    await handleSetVisibility(ctx, { id, visibility: 'public' }, ana);
    expect(canView(null, { ...(await doc()), authorUid: ana } as never)).toBe(true);
    await handleSetVisibility(ctx, { id, visibility: 'private' }, ana);
    expect(canView(null, { ...(await doc()), authorUid: ana } as never)).toBe(false);
    expect((await ctx.db.collection(`apices/${id}/versions`).get()).size).toBe(1);
    expect(await events()).toHaveLength(2);
  });

  it('RF-13 (001): pedir la visibilidad que ya tiene no escribe evento', async () => {
    await handleSetVisibility(ctx, { id, visibility: 'private' }, ana);
    expect(await events()).toHaveLength(0);
  });

  it('RF-14 (001): en un ápice archivado no se cambia la visibilidad', async () => {
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    expect(await codeOf(handleSetVisibility(ctx, { id, visibility: 'public' }, ana))).toBe('apice-archived');
  });

  it('RF-13 (001): rechaza una visibilidad inválida y un ápice inexistente', async () => {
    expect(await codeOf(handleSetVisibility(ctx, { id, visibility: 'secreta' }, ana))).toBe('invalid-request');
    expect(await codeOf(handleSetVisibility(ctx, { visibility: 'public' }, ana))).toBe('invalid-request');
    expect(await codeOf(handleSetVisibility(ctx, { id: 'no-existe', visibility: 'public' }, ana))).toBe('invalid-request');
  });
});
