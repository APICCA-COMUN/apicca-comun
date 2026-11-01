// T-2 (007): la op que entrega las imágenes de referencia (RF-1 (007) a RF-4 (007), D-T2 (007)).
import { beforeEach, describe, expect, it } from 'vitest';
import { APICE_ACCESS_TABLE, APICE_ACTORS, APICE_STATES, type ApiceActorName } from '../../../shared/domain/access';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { clearBucket, readFile, seedReference } from '../testing/mediaKit';
import { handleCreateApice } from './createApice';
import { handleReadReference } from './readReference';

let ctx: TestCtx;
let id: string;
const uids = {} as Record<ApiceActorName, string | null>;

const read = (refId: string, actor: ApiceActorName) => handleReadReference(ctx, { id, refId }, uids[actor]);

/** Pone el ápice en un estado de la tabla, con autoría del actor si la tabla lo dice. */
async function setState(state: keyof typeof APICE_STATES, actor: ApiceActorName): Promise<void> {
  const authorUid = APICE_ACTORS[actor].isAuthor ? (uids[actor] as string) : 'otra-persona';
  await ctx.db.doc(`apices/${id}`).update({ ...APICE_STATES[state], authorUid });
}

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-10T15:00:00Z') });
  await clearBucket(ctx);
  for (const [name, { viewer }] of Object.entries(APICE_ACTORS) as [ApiceActorName, (typeof APICE_ACTORS)[ApiceActorName]][]) {
    uids[name] = viewer === null ? null : (await seedAccount(ctx, { username: name.toLowerCase(), role: viewer.role, status: viewer.status })).uid;
  }
  id = ((await handleCreateApice(ctx, VALID, uids.member)) as { id: string }).id;
  await seedReference(ctx, id, 'vigente');
  await seedReference(ctx, id, 'quitada', { removal: { kind: 'removed', byUsername: 'member', at: ctx.now(), reason: null } });
});

describe('readReference', () => {
  it('RF-1 (007): entrega el tipo y los bytes del archivo en base64', async () => {
    await setState('public', 'visitor');
    const out = (await read('vigente', 'visitor')) as { contentType: string; data: string };
    expect(out.contentType).toBe('image/png');
    expect(Buffer.from(out.data, 'base64').equals(await readFile(ctx, `apices/${id}/references/vigente`))).toBe(true);
  });

  it('RF-1 (007) · RF-3 (007): una referencia vigente sigue la tabla de visibilidad, con el mismo error al negar', async () => {
    for (const row of APICE_ACCESS_TABLE) {
      await setState(row.state, row.actor);
      const code = await codeOf(read('vigente', row.actor));
      expect(code, `${row.actor} · ${row.state}`).toBe(row.view ? undefined : 'reference-not-found');
    }
  });

  it('RF-2 (007): una referencia quitada solo la recibe un facilitador activo', async () => {
    for (const row of APICE_ACCESS_TABLE) {
      await setState(row.state, row.actor);
      const allowed = row.view && row.actor === 'facilitator';
      expect(await codeOf(read('quitada', row.actor)), `${row.actor} · ${row.state}`).toBe(allowed ? undefined : 'reference-not-found');
    }
  });

  it('RF-3 (007): un ápice o una referencia inexistentes dan el mismo error que la falta de permiso', async () => {
    await setState('public', 'visitor');
    expect(await codeOf(read('no-existe', 'facilitator'))).toBe('reference-not-found');
    expect(await codeOf(handleReadReference(ctx, { id: 'no-existe', refId: 'vigente' }, uids.facilitator))).toBe('reference-not-found');
    expect(await codeOf(handleReadReference(ctx, { id, refId: '../vigente' }, uids.facilitator))).toBe('invalid-request');
  });

  it('RF-3 (007): una referencia sin archivo da el mismo error', async () => {
    await setState('public', 'visitor');
    await ctx.storage.bucket().file(`apices/${id}/references/vigente`).delete();
    expect(await codeOf(read('vigente', 'facilitator'))).toBe('reference-not-found');
  });

  it('RF-4 (007): la suspensión vale desde la siguiente petición', async () => {
    await setState('private', 'member');
    expect(await codeOf(read('vigente', 'member'))).toBeUndefined();
    await ctx.db.doc(`accounts/${uids.member}`).update({ status: 'suspended' });
    expect(await codeOf(read('vigente', 'member'))).toBe('reference-not-found');
  });

  it('RF-4 (007): un uid sin cuenta se trata como visitante', async () => {
    await setState('private', 'member');
    expect(await codeOf(handleReadReference(ctx, { id, refId: 'vigente' }, 'sin-cuenta'))).toBe('reference-not-found');
    await setState('public', 'member');
    expect(await codeOf(handleReadReference(ctx, { id, refId: 'vigente' }, 'sin-cuenta'))).toBeUndefined();
  });
});
