// T-7.5 · Concurrencia transversal: los cinco escenarios de carrera de la spec en un solo archivo.
// Cada ronda reordena sus pruebas al azar y cada prueba parte de emuladores vacíos, así que ninguna
// puede depender del orden. Para repetirlo: `CONCURRENCY_ROUNDS=10 /private/tmp/claude-501/emu/run.sh`.
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { handleAcceptProposal } from './ops/acceptProposal';
import { handleAddReference } from './ops/addReference';
import { handleCreateApice } from './ops/createApice';
import { handleEditApice } from './ops/editApice';
import { handleGenerateImage } from './ops/generateImage';
import { handleInvite } from './ops/invite';
import { handleRegister } from './ops/register';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { VALID } from './testing/apiceKit';
import { gatedModel, sampleImage, until, countOf, withModel } from './testing/generationKit';
import { clearBucket, listPaths, png, putUpload } from './testing/mediaKit';

const ROUNDS = Math.max(1, Number(process.env['CONCURRENCY_ROUNDS'] ?? 1));

let ctx: TestCtx;
let ana: string;
let beto: string;
let id: string;

const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;

/** Un ápice de ana, público; beto es facilitador para poder actuar sobre él en cualquier estado. */
async function seedApice(): Promise<void> {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto', role: 'facilitator' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
  await ctx.db.doc(`apices/${id}`).update({ visibility: 'public' });
}

const codeOfError = (error: unknown): string => (error instanceof ApiError ? error.code : 'error');

for (let round = 1; round <= ROUNDS; round += 1) {
  describe.shuffle(`concurrencia · ronda ${round}`, () => {
    beforeEach(seedApice);

    it('RF-2 (001): dos registros con el mismo usuario a la vez, solo uno gana', async () => {
      const invitationPath = (email: string) => `invitations/${createHash('sha256').update(email).digest('hex')}`;
      const tokenOf = async (email: string) => ((await handleInvite(ctx, { email }, beto)) as { link: string }).link.replace('/registro/', '');
      const form = (token: string) => ({ token, password: 'una-clave-larga', name: 'Persona', username: 'Compartido' });
      const a = await tokenOf('uno@ejemplo.org');
      const b = await tokenOf('dos@ejemplo.org');

      const results = await Promise.allSettled([handleRegister(ctx, form(a), null), handleRegister(ctx, form(b), null)]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(codeOfError(loser?.reason)).toBe('username-taken');
      expect((await ctx.db.collection('accounts').where('username', '==', 'compartido').get()).size).toBe(1);
      const statuses = await Promise.all(['uno@ejemplo.org', 'dos@ejemplo.org'].map(async (e) => (await ctx.db.doc(invitationPath(e)).get()).get('status') as string));
      expect(statuses.sort()).toEqual(['accepted', 'pending']);
    }, 30_000);

    it('RF-11 (001): dos guardados con la misma base, uno gana y el otro recibe el conflicto', async () => {
      const edit = (uid: string, name: string) =>
        handleEditApice(ctx, { id, baseVersion: 1, content: { ...VALID, status: 'idea', name } }, uid);

      const results = (await Promise.all([edit(ana, 'Uno'), edit(beto, 'Dos')])) as Array<{ ok: boolean; conflict?: boolean }>;

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.conflict === true)).toHaveLength(1);
      expect((await apice())['version']).toBe(2);
      expect((await ctx.db.collection(`apices/${id}/versions`).get()).size).toBe(2);
    }, 30_000);

    it('RF-15 (001): si dos suben la quinta referencia a la vez, solo una queda y no sobra archivo', async () => {
      await ctx.db.doc(`apices/${id}`).update({ activeReferenceCount: 4 });
      await putUpload(ctx, ana, 'ua', await png(9, 9));
      await putUpload(ctx, beto, 'ub', await png(11, 11));

      const results = await Promise.allSettled([
        handleAddReference(ctx, { id, uploadId: 'ua', altText: 'De ana' }, ana),
        handleAddReference(ctx, { id, uploadId: 'ub', altText: 'De beto' }, beto),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(codeOfError(loser?.reason)).toBe('references-full');
      expect((await ctx.db.collection(`apices/${id}/references`).get()).size).toBe(1);
      expect(await listPaths(ctx, `apices/${id}/references/`)).toHaveLength(1);
      expect((await apice())['activeReferenceCount']).toBe(5);
    }, 30_000);

    it('RF-18 (001): dos aceptan propuestas distintas a la vez, una sola establece la imagen', async () => {
      const seedProposal = async (uid: string, bytes: number[]) => {
        const at = ctx.now();
        await ctx.db.doc(`proposals/${id}_${uid}`).set({
          apiceId: id,
          requestedByUid: uid,
          png: Buffer.from(bytes),
          referenceIds: [],
          baseVersion: 1,
          baseImageId: null,
          createdAt: at,
          expiresAt: new Date(at.getTime() + 24 * 3600 * 1000),
        });
      };
      await seedProposal(ana, [1, 1, 1]);
      await seedProposal(beto, [2, 2, 2]);

      const results = (await Promise.all([
        handleAcceptProposal(ctx, { id, altText: 'Una huerta en pixeles' }, ana),
        handleAcceptProposal(ctx, { id, altText: 'Una huerta en pixeles' }, beto),
      ])) as Array<{ ok: boolean; warnings?: string[] }>;

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)?.warnings).toEqual(['image-changed']);
      expect((await ctx.db.collection(`apices/${id}/images`).get()).size).toBe(1);
    }, 30_000);

    it('RF-19 (001): tres peticiones simultáneas con 2 cupos globales, pasan solo 2', async () => {
      const carla = (await seedAccount(ctx, { username: 'carla', role: 'facilitator' })).uid;
      await ctx.db.doc(`generationDays/global_2026-09-01`).set({ count: 58, expiresAt: new Date('2026-09-05T00:00:00Z') });
      const model = gatedModel(await sampleImage());
      const settled: string[] = [];
      const run = (uid: string) =>
        handleGenerateImage(withModel(ctx, model), { id }, uid).then(
          () => 'ok',
          (error: unknown) => codeOfError(error),
        ).then((result) => {
          settled.push(result);
          return result;
        });

      const all = [run(ana), run(beto), run(carla)];
      // Margen amplio: la primera generación de la corrida carga `sharp` en frío.
      await until(() => model.started() === 2 && settled.length === 1, 25_000);
      model.open();
      const results = await Promise.all(all);

      expect(results.filter((r) => r === 'ok')).toHaveLength(2);
      expect(results.filter((r) => r === 'generation-global-limit')).toHaveLength(1);
      expect(await countOf(ctx, 'generationDays/global_2026-09-01')).toBe(60);
    }, 30_000);
  });
}
