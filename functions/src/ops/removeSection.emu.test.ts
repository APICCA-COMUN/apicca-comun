// T-4.4 (004): quitar una sección antes de la apertura (RF-4 (004) · 4.2, RF-1 (004) · 1.4).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedConstitution } from '../testing/constitutionKit';
import { handleRemoveSection } from './removeSection';

let ctx: TestCtx;
let fabi: string;
let ana: string;

const order = async () => ((await ctx.db.doc('constitution/state').get()).get('order') as string[]);
const exists = async (id: string) => (await ctx.db.doc(`constitutionSections/${id}`).get()).exists;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('removeSection', () => {
  it('RF-4 (004) · 4.2: quitar borra la sección y la saca de `order`, y las demás conservan su lugar', async () => {
    await seedConstitution(ctx, { sections: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] });
    ctx.setNow(new Date('2026-09-02T08:00:00Z'));
    expect(await handleRemoveSection(ctx, { id: 's2' }, fabi)).toEqual({});
    expect(await exists('s2')).toBe(false);
    expect(await order()).toEqual(['s1', 's3']);
    const updatedAt = (await ctx.db.doc('constitution/state').get()).get('updatedAt') as { toDate(): Date };
    expect(updatedAt.toDate().toISOString()).toBe('2026-09-02T08:00:00.000Z');
    expect(await codeOf(handleRemoveSection(ctx, { id: 's2' }, fabi))).toBe('section-not-found');
  });

  it('RF-1 (004) · 1.4: quitar con una persona inscrita da forbidden y, ya abierta, constitution-open sin cambios', async () => {
    await seedConstitution(ctx, { sections: [{ id: 's1' }] });
    expect(await codeOf(handleRemoveSection(ctx, { id: 's1' }, ana))).toBe('forbidden');
    expect(await exists('s1')).toBe(true);
    await ctx.db.doc('constitution/state').update({ isOpen: true });
    expect(await codeOf(handleRemoveSection(ctx, { id: 's1' }, fabi))).toBe('constitution-open');
    expect(await exists('s1')).toBe(true);
    expect(await order()).toEqual(['s1']);
  });
});
