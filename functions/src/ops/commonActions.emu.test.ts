// T-3 (010) · RF-1 (010) a RF-4 (010), RF-7 (010), RNF-2 (010), RNF-5 (010), D-T3 (010): ops de escritura de las Acciones Comunes.
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { VALID } from '../testing/apiceKit';
import { handleArchiveApice } from './archiveApice';
import { handleCreateApice } from './createApice';
import { handleEditCommonAction } from './editCommonAction';
import { handleJoinCommonAction } from './joinCommonAction';
import { handleLeaveCommonAction } from './leaveCommonAction';
import { handleProposeCommonAction } from './proposeCommonAction';
import { handleSetCommonActionStatus } from './setCommonActionStatus';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;
let susi: string;
let apices: string[];

const codeOf = async (promise: Promise<unknown>) => ((await promise.then(() => null, (e: unknown) => e)) as { code?: string } | null)?.code ?? null;
const action = async (id: string) => (await ctx.db.doc(`commonActions/${id}`).get()).data() as Record<string, unknown>;
const participants = async (id: string) => (await ctx.db.collection(`commonActions/${id}/participants`).get()).docs.map((d) => d.data() as Record<string, unknown>);
const propose = (uid: string, over: Record<string, unknown> = {}) =>
  handleProposeCommonAction(ctx, { title: 'Agua lluvia', description: 'Juntemos el agua lluvia del barrio.', apiceIds: apices.slice(0, 3), ...over }, uid);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-11-10T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  susi = (await seedAccount(ctx, { username: 'susi', status: 'suspended' })).uid;
  apices = [];
  // El cupo diario de ápices es 10 por persona (RF-7 (016)): la siembra se reparte entre dos autoras.
  for (let i = 0; i < 11; i += 1) apices.push((await handleCreateApice(ctx, { ...VALID, name: `Ápice ${i}` }, i < 6 ? ana : beto)).id);
});

describe('Acciones Comunes · proponer', () => {
  it('RF-1 (010): crea la Acción Común abierta, con autoría, fecha, ápices, versión 1 y la autora como participante', async () => {
    const { id } = await propose(ana, { axis: 'agua' });
    expect(await action(id)).toEqual(
      expect.objectContaining({
        title: 'Agua lluvia',
        axis: 'agua',
        status: 'abierta',
        authorUid: ana,
        authorUsername: 'ana',
        authorSuspended: false,
        isListed: true,
        apiceIds: apices.slice(0, 3),
        participantUids: [ana],
        participantCount: 1,
        version: 1,
      }),
    );
    expect(await participants(id)).toEqual([expect.objectContaining({ uid: ana, username: 'ana', suspended: false })]);
    expect((await ctx.db.doc(`commonActions/${id}/versions/1`).get()).exists).toBe(true);
  });

  it('RF-1 (010) · 1.4: el eje es opcional', async () => {
    const { id } = await propose(ana);
    expect((await action(id))['axis']).toBeNull();
    expect(await codeOf(propose(ana, { axis: 'aire' }))).toBe('axis-unknown');
  });

  it('RF-1 (010) · 1.2: un título o una descripción fuera de los límites se rechazan', async () => {
    expect(await codeOf(propose(ana, { title: 'ab' }))).toBe('invalid-request');
    expect(await codeOf(propose(ana, { title: 'a'.repeat(81) }))).toBe('text-too-long');
    expect(await codeOf(propose(ana, { description: 'corta' }))).toBe('invalid-request');
    expect(await codeOf(propose(ana, { description: '   ' }))).toBe('text-empty');
  });

  it('RF-1 (010) · 1.3, RF-4 (010) · 4.1: menos de tres, repetidos, más de diez o uno que no existe se rechazan', async () => {
    expect(await codeOf(propose(ana, { apiceIds: apices.slice(0, 2) }))).toBe('action-apices-min');
    expect(await codeOf(propose(ana, { apiceIds: [apices[0], apices[0], apices[1]] }))).toBe('action-apices-min');
    expect(await codeOf(propose(ana, { apiceIds: apices.slice(0, 11) }))).toBe('action-apices-max');
    expect(await codeOf(propose(ana, { apiceIds: [apices[0], apices[1], 'no-existe'] }))).toBe('action-apices-min');
  });

  it('RF-1 (010) · 1.3, RF-4 (010): un ápice que la autora no puede ver no se enlaza', async () => {
    await handleArchiveApice(ctx, { id: apices[2] }, ana);
    expect(await codeOf(propose(beto))).toBe('action-apices-min');
    expect(await codeOf(propose(ana))).toBeNull();
  });

  it('RF-1 (010): un visitante y una cuenta suspendida no proponen', async () => {
    expect(await codeOf(propose(null as unknown as string))).toBe('unauthenticated');
    expect(await codeOf(propose(susi))).toBe('account-suspended');
  });

  it('RF-1 (010) · 1.5, D-4 (010): la Acción Común abierta número 21 de una autora se rechaza', async () => {
    for (let day = 0; day < 2; day += 1) {
      ctx.setNow(new Date(`2026-11-${10 + day * 2}T12:00:00Z`));
      for (let i = 0; i < 10; i += 1) await propose(ana);
    }
    ctx.setNow(new Date('2026-11-20T12:00:00Z'));
    expect(await codeOf(propose(ana))).toBe('action-limit');
    expect(await codeOf(propose(beto))).toBeNull();
  });

  it('RNF-5 (010), D-T3 (010): la propuesta 11 en 24 horas se rechaza', async () => {
    for (let i = 0; i < 10; i += 1) await propose(beto);
    expect(await codeOf(propose(beto))).toBe('rate-limited');
  });
});

describe('Acciones Comunes · sumarse y retirarse', () => {
  it('RF-2 (010): sumarse registra a la persona una sola vez y actualiza el conteo (idempotente)', async () => {
    const { id } = await propose(ana);
    expect(await handleJoinCommonAction(ctx, { actionId: id }, beto)).toEqual({ participantCount: 2 });
    expect(await handleJoinCommonAction(ctx, { actionId: id }, beto)).toEqual({ participantCount: 2 });
    const stored = await action(id);
    expect(stored['participantUids']).toEqual([ana, beto]);
    expect(stored['participantCount']).toBe(2);
    expect((await participants(id)).map((p) => p['username']).sort()).toEqual(['ana', 'beto']);
  });

  it('RF-2 (010) · 2.2: no se suma a una cerrada ni a una que no existe; una suspendida tampoco', async () => {
    const { id } = await propose(ana);
    await handleSetCommonActionStatus(ctx, { actionId: id, status: 'cerrada' }, ana);
    expect(await codeOf(handleJoinCommonAction(ctx, { actionId: id }, beto))).toBe('action-closed');
    expect(await codeOf(handleJoinCommonAction(ctx, { actionId: 'nada' }, beto))).toBe('action-not-found');
    expect(await codeOf(handleJoinCommonAction(ctx, { actionId: id }, susi))).toBe('account-suspended');
  });

  it('RF-3 (010): retirarse quita la participación y el conteo; la autora no se retira mientras esté abierta', async () => {
    const { id } = await propose(ana);
    await handleJoinCommonAction(ctx, { actionId: id }, beto);
    expect(await handleLeaveCommonAction(ctx, { actionId: id }, beto)).toEqual({ participantCount: 1 });
    expect((await action(id))['participantUids']).toEqual([ana]);
    expect(await participants(id)).toHaveLength(1);
    expect(await handleLeaveCommonAction(ctx, { actionId: id }, beto)).toEqual({ participantCount: 1 });
    expect(await codeOf(handleLeaveCommonAction(ctx, { actionId: id }, ana))).toBe('author-cannot-leave');
  });
});

describe('Acciones Comunes · cambiar', () => {
  it('RF-7 (010) · 7.3: editar guarda la versión anterior y cambia título, descripción y eje', async () => {
    const { id } = await propose(ana);
    ctx.setNow(new Date('2026-11-10T13:00:00Z'));
    expect(await handleEditCommonAction(ctx, { actionId: id, title: 'Cosecha de agua', description: 'Tanques para la cuadra entera.', axis: 'agua' }, ana)).toEqual({ version: 2 });
    expect(await action(id)).toEqual(expect.objectContaining({ title: 'Cosecha de agua', axis: 'agua', version: 2 }));
    const before = (await ctx.db.doc(`commonActions/${id}/versions/1`).get()).data();
    const after = (await ctx.db.doc(`commonActions/${id}/versions/2`).get()).data();
    expect(before).toEqual(expect.objectContaining({ title: 'Agua lluvia', editedBy: ana }));
    expect(after).toEqual(expect.objectContaining({ title: 'Cosecha de agua', editedBy: ana }));
  });

  it('RF-4 (010) · 4.2: la autora cambia los ápices sin bajar de tres', async () => {
    const { id } = await propose(ana);
    await handleEditCommonAction(ctx, { actionId: id, title: 'Agua lluvia', description: 'Juntemos el agua lluvia del barrio.', apiceIds: apices.slice(0, 4) }, ana);
    expect((await action(id))['apiceIds']).toEqual(apices.slice(0, 4));
    expect(await codeOf(handleEditCommonAction(ctx, { actionId: id, title: 'Agua lluvia', description: 'Juntemos el agua lluvia del barrio.', apiceIds: apices.slice(0, 2) }, ana))).toBe('action-apices-min');
  });

  it('RF-7 (010): solo la autora edita, cierra y reabre', async () => {
    const { id } = await propose(ana);
    expect(await codeOf(handleEditCommonAction(ctx, { actionId: id, title: 'Otro título', description: 'Otra descripción larga.' }, beto))).toBe('not-action-author');
    expect(await codeOf(handleSetCommonActionStatus(ctx, { actionId: id, status: 'cerrada' }, beto))).toBe('not-action-author');
    expect(await codeOf(handleSetCommonActionStatus(ctx, { actionId: id, status: 'cerrada' }, fabi))).toBe('not-action-author');
    await handleSetCommonActionStatus(ctx, { actionId: id, status: 'cerrada' }, ana);
    expect(await action(id)).toEqual(expect.objectContaining({ status: 'cerrada', isListed: true }));
    await handleSetCommonActionStatus(ctx, { actionId: id, status: 'abierta' }, ana);
    expect((await action(id))['status']).toBe('abierta');
  });

  it('RF-7 (010) · 7.1: un facilitador archiva una ajena y queda registrado quién; archivada ya no cambia', async () => {
    const { id } = await propose(ana);
    await handleSetCommonActionStatus(ctx, { actionId: id, status: 'archivada' }, fabi);
    expect(await action(id)).toEqual(expect.objectContaining({ status: 'archivada', isListed: false, archivedBy: fabi }));
    expect(await codeOf(handleSetCommonActionStatus(ctx, { actionId: id, status: 'abierta' }, ana))).toBe('action-archived');
    expect(await codeOf(handleEditCommonAction(ctx, { actionId: id, title: 'Otro título', description: 'Otra descripción larga.' }, ana))).toBe('action-archived');
  });

  it('RF-1 (010) · 1.5: reabrir cuenta el tope de abiertas de la autora', async () => {
    const { id } = await propose(ana);
    await handleSetCommonActionStatus(ctx, { actionId: id, status: 'cerrada' }, ana);
    for (let day = 0; day < 2; day += 1) {
      ctx.setNow(new Date(`2026-11-${11 + day * 2}T13:00:00Z`));
      for (let i = 0; i < 10; i += 1) await propose(ana);
    }
    expect(await codeOf(handleSetCommonActionStatus(ctx, { actionId: id, status: 'abierta' }, ana))).toBe('action-limit');
  });
});
