// T-4.7 (004) · Apertura única: dos aperturas a la vez dejan una sola apertura (RF-4 (004) · 4.5, 4.6, D-T11 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { handleOpenConstitution } from './openConstitution';

let ctx: TestCtx;
let fabi: string;
let flor: string;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  flor = (await seedAccount(ctx, { username: 'flor', role: 'facilitator' })).uid;
  await ctx.db.doc('constitution/state').set({ isOpen: false, openedAt: null, order: ['s1'], updatedAt: ctx.now(), logSeq: 0 });
  await ctx.db.doc('constitutionSections/s1').set({ title: 'Agua', text: 'Común.', updatedAt: ctx.now(), isRetired: false, retiredAt: null });
});

const ROUNDS = 10;

describe('openConstitution · concurrencia', () => {
  for (let round = 1; round <= ROUNDS; round += 1) {
    it(`RF-4 (004) · 4.5: dos facilitadores abren a la vez y solo una apertura queda (corrida ${round})`, async () => {
      const outcomes = await Promise.all([codeOf(handleOpenConstitution(ctx, {}, fabi)), codeOf(handleOpenConstitution(ctx, {}, flor))]);
      expect(outcomes.filter((code) => code === 'constitution-already-open')).toHaveLength(1);
      expect(outcomes.filter((code) => code === undefined)).toHaveLength(1);
      expect((await ctx.db.collection('constitutionLog').get()).size).toBe(1);
      expect((await ctx.db.collection('constitutionSections/s1/versions').get()).size).toBe(1);
      expect((await ctx.db.doc('constitution/state').get()).data()).toMatchObject({ isOpen: true, logSeq: 1 });
    }, 30_000);
  }

  it('RF-4 (004) · 4.6: una apertura posterior a la primera se rechaza', async () => {
    await handleOpenConstitution(ctx, {}, fabi);
    expect(await codeOf(handleOpenConstitution(ctx, {}, flor))).toBe('constitution-already-open');
  });
});
