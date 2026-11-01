// T-4.5 (004): reordenar las secciones antes de la apertura (RF-4 (004) · 4.2, RF-1 (004) · 1.4).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedConstitution } from '../testing/constitutionKit';
import { handleReorderSections } from './reorderSections';

let ctx: TestCtx;
let fabi: string;
let ana: string;

const order = async () => ((await ctx.db.doc('constitution/state').get()).get('order') as string[]);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  await seedConstitution(ctx, { sections: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] });
});

describe('reorderSections', () => {
  it('RF-4 (004) · 4.2: ordenar guarda el orden nuevo y la fecha del conjunto', async () => {
    ctx.setNow(new Date('2026-09-02T08:00:00Z'));
    expect(await handleReorderSections(ctx, { order: ['s3', 's1', 's2'] }, fabi)).toEqual({});
    expect(await order()).toEqual(['s3', 's1', 's2']);
    const updatedAt = (await ctx.db.doc('constitution/state').get()).get('updatedAt') as { toDate(): Date };
    expect(updatedAt.toDate().toISOString()).toBe('2026-09-02T08:00:00.000Z');
  });

  it('RF-4 (004) · 4.2: ordenar rechaza ids ajenos, repetidos o faltantes y no cambia nada', async () => {
    for (const bad of [['s1', 's2', 'zz'], ['s1', 's1', 's2'], ['s1', 's2'], ['s1', 's2', 's3', 's3'], 'x', [1, 2, 3]]) {
      expect(await codeOf(handleReorderSections(ctx, { order: bad }, fabi))).toBe('invalid-request');
    }
    expect(await order()).toEqual(['s1', 's2', 's3']);
  });

  it('RF-1 (004) · 1.4: ordenar con una persona inscrita da forbidden y, ya abierta, constitution-open', async () => {
    expect(await codeOf(handleReorderSections(ctx, { order: ['s3', 's2', 's1'] }, ana))).toBe('forbidden');
    await ctx.db.doc('constitution/state').update({ isOpen: true });
    expect(await codeOf(handleReorderSections(ctx, { order: ['s3', 's2', 's1'] }, fabi))).toBe('constitution-open');
    expect(await order()).toEqual(['s1', 's2', 's3']);
  });
});
