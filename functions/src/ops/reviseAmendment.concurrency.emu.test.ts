// T-6.6 (004) · Dos revisiones a la vez con la misma base: gana una y la otra recibe conflicto (RF-17 (004) · 17.2, D-T10 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleReviseAmendment } from './reviseAmendment';

let ctx: TestCtx;
let ana: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' } });
});

describe('reviseAmendment · concurrencia', () => {
  it('RF-17 (004) · 17.2: dos revisiones a la vez con la misma base dejan una y un conflicto', async () => {
    const make = (title: string) => handleReviseAmendment(ctx, { amendmentId: 'a1', baseRevision: 1, title, text: `Texto ${title}.`, motive: 'Motivo.' }, ana);
    const results = await Promise.all([make('Uno'), make('Dos')]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    const doc = (await ctx.db.doc('amendments/a1').get()).data();
    expect(doc).toMatchObject({ revisionNo: 2, eventSeq: 2 });
    expect((await ctx.db.collection('amendments/a1/revisions').get()).size).toBe(1);
  }, 30_000);
});
