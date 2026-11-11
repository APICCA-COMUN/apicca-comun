// T-7.5 · Concurrencia transversal: los escenarios de carrera de la spec en un solo archivo. Los tres de la imagen
// (referencias, propuestas y cupo de generación) se retiraron con ella (RF-27 (021), D-T6 (021)).
// Cada ronda reordena sus pruebas al azar y cada prueba parte de emuladores vacíos, así que ninguna
// puede depender del orden. Para repetirlo: `CONCURRENCY_ROUNDS=10 /private/tmp/claude-501/emu/run.sh`.
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { handleCreateApice } from './ops/createApice';
import { handleEditApice } from './ops/editApice';
import { handleInvite } from './ops/invite';
import { handleRegister } from './ops/register';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { VALID } from './testing/apiceKit';
import { clearBucket } from './testing/storageKit';

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
  });
}
