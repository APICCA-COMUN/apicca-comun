// T-3 (012) · RF-1 (012): avisos para la autora cuando otra persona edita, restaura o archiva su ápice.
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { VALID } from '../testing/apiceKit';
import { handleArchiveApice } from './archiveApice';
import { handleCreateApice } from './createApice';
import { handleEditApice } from './editApice';
import { handleRestoreVersion } from './restoreVersion';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;
let id: string;

const notices = async () =>
  (await ctx.db.collection(`notices/${ana}/items`).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-10T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
});

const edit = (uid: string, baseVersion: number, name: string) =>
  handleEditApice(ctx, { id, baseVersion, content: { ...VALID, status: 'idea', name } }, uid);

describe('avisos de ápices', () => {
  it('RF-1 (012): otra persona edita el ápice y la autora recibe un aviso con ápice, quién y cuándo', async () => {
    await edit(beto, 1, 'Huerta nueva');
    expect(await notices()).toEqual([
      expect.objectContaining({ id: `${id}_${beto}_apice-editado`, type: 'apice-editado', apiceId: id, apiceName: 'Huerta nueva', actorUsername: 'beto' }),
    ]);
  });

  it('RF-1 (012) · 1.1: si edita la propia autora no hay aviso', async () => {
    await edit(ana, 1, 'Huerta mía');
    expect(await notices()).toHaveLength(0);
  });

  it('RF-1 (012): restaurar una versión ajena también avisa', async () => {
    await edit(ana, 1, 'Segunda');
    await handleRestoreVersion(ctx, { id, n: 1, baseVersion: 2 }, beto);
    expect((await notices()).map((n) => n.id)).toEqual([`${id}_${beto}_apice-editado`]);
  });

  it('RF-1 (012) · 1.3: dos ediciones seguidas de la misma persona dan un solo aviso, con la fecha más nueva', async () => {
    await edit(beto, 1, 'Uno');
    ctx.setNow(new Date('2026-10-11T12:00:00Z'));
    await edit(beto, 2, 'Dos');
    const list = await notices();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ apiceName: 'Dos' });
    expect(((list[0] as unknown as { createdAt: { toDate(): Date } }).createdAt).toDate().toISOString()).toBe('2026-10-11T12:00:00.000Z');
  });

  it('RF-1 (012): una facilitadora que archiva un ápice ajeno deja un aviso de archivo; la autora, ninguno', async () => {
    await handleArchiveApice(ctx, { id }, fabi);
    expect((await notices()).map((n) => n['type'])).toEqual(['apice-archivado']);
  });

  it('RF-1 (012) · 1.1: archivar la propia autora no avisa', async () => {
    await handleArchiveApice(ctx, { id }, ana);
    expect(await notices()).toHaveLength(0);
  });
});
