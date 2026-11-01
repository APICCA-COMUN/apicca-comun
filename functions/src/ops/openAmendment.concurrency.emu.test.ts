// T-6.3 (004) · Dos propuestas a la vez sobre la misma sección: gana la primera (RF-6 (004) · 6.5, D-T1 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { seedConstitution } from '../testing/constitutionKit';
import { handleOpenAmendment } from './openAmendment';

let ctx: TestCtx;
let ana: string;
let beto: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
});

describe('openAmendment · concurrencia', () => {
  it('RF-6 (004) · 6.5: dos propuestas a la vez sobre la misma sección dejan una abierta y una respuesta taken', async () => {
    const body = { kind: 'change', sectionId: 's1', title: 'Nuevo', text: 'Nuevo texto.', motive: 'Porque sí.' };
    const results = await Promise.all([handleOpenAmendment(ctx, body, ana), handleOpenAmendment(ctx, body, beto)]);
    const winners = results.filter((r) => r.ok);
    const taken = results.filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(taken).toHaveLength(1);
    const winner = winners[0];
    if (!winner || !winner.ok) throw new Error('sin ganadora');
    expect(taken[0]).toEqual({ ok: false, taken: true, amendmentId: winner.id });
    expect((await ctx.db.collection('amendments').get()).size).toBe(1);
  }, 30_000);
});
