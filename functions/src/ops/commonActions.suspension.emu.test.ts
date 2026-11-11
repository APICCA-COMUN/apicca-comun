// T-5 (010) · RF-9 (010), D-T6 (010): al suspender una cuenta se ocultan sus participaciones y las Acciones Comunes que propuso,
// sin borrar nada; al reactivarla vuelven.
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { VALID } from '../testing/apiceKit';
import { handleCreateApice } from './createApice';
import { handleJoinCommonAction } from './joinCommonAction';
import { handleProposeCommonAction } from './proposeCommonAction';
import { handleReactivateAccount } from './reactivateAccount';
import { handleSuspendAccount } from './suspendAccount';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;
let apices: string[];

const action = async (id: string) => (await ctx.db.doc(`commonActions/${id}`).get()).data() as Record<string, unknown>;
const participant = async (id: string, uid: string) => (await ctx.db.doc(`commonActions/${id}/participants/${uid}`).get()).data() as Record<string, unknown> | undefined;
const propose = (uid: string) =>
  handleProposeCommonAction(ctx, { title: 'Agua lluvia', description: 'Juntemos el agua lluvia del barrio.', apiceIds: apices }, uid);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-11-10T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  apices = [];
  for (let i = 0; i < 3; i += 1) apices.push((await handleCreateApice(ctx, { ...VALID, name: `Ápice ${i}` }, ana)).id);
});

describe('Acciones Comunes · suspensión', () => {
  it('RF-9 (010): suspender oculta la participación (sin borrarla) y descuenta a la persona', async () => {
    const { id } = await propose(ana);
    await handleJoinCommonAction(ctx, { actionId: id }, beto);
    await handleSuspendAccount(ctx, { uid: beto }, fabi);
    expect(await participant(id, beto)).toEqual(expect.objectContaining({ uid: beto, suspended: true }));
    expect(await action(id)).toEqual(expect.objectContaining({ participantCount: 1, participantUids: [ana, beto], isListed: true }));
  });

  it('RF-9 (010), D-T6 (010): suspender a la autora saca de la lista lo que propuso, sin borrarlo', async () => {
    const { id } = await propose(ana);
    await handleSuspendAccount(ctx, { uid: ana }, fabi);
    expect(await action(id)).toEqual(expect.objectContaining({ authorSuspended: true, isListed: false, status: 'abierta' }));
    expect(await participant(id, ana)).toEqual(expect.objectContaining({ suspended: true }));
  });

  it('RF-9 (010): reactivar devuelve las participaciones, el conteo y la lista', async () => {
    const { id } = await propose(ana);
    await handleJoinCommonAction(ctx, { actionId: id }, beto);
    await handleSuspendAccount(ctx, { uid: ana }, fabi);
    await handleSuspendAccount(ctx, { uid: beto }, fabi);
    await handleReactivateAccount(ctx, { uid: ana }, fabi);
    await handleReactivateAccount(ctx, { uid: beto }, fabi);
    expect(await action(id)).toEqual(expect.objectContaining({ authorSuspended: false, isListed: true, participantCount: 2 }));
    expect(await participant(id, beto)).toEqual(expect.objectContaining({ suspended: false }));
  });
});
