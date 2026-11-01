// T-7.3 (004) · Nada adelanta el cierre (RF-12 (004) · 12.4, D-T12 (004)).
import { describe, expect, it } from 'vitest';
import { API_OPS } from './api';
import { settleAmendment } from './amendmentStore';
import { clearEmulators, createTestCtx, seedAccount } from './testing';
import { seedAmendment, seedConstitution } from './testing/constitutionKit';

describe('closeNever', () => {
  it('RF-12 (004) · 12.4: con todas las personas de acuerdo antes del plazo la propuesta sigue abierta', async () => {
    await clearEmulators();
    const ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
    const ana = (await seedAccount(ctx, { username: 'ana' })).uid;
    const beto = (await seedAccount(ctx, { username: 'beto' })).uid;
    const cami = (await seedAccount(ctx, { username: 'cami' })).uid;
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
    await seedAmendment(ctx, {
      id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, openedAt: new Date('2026-10-01T12:00:00Z'),
      stances: [{ uid: beto, username: 'beto' }, { uid: cami, username: 'cami' }],
    });
    ctx.setNow(new Date('2026-10-15T11:59:59Z'));
    expect(await settleAmendment(ctx, 'a1')).toBe('none');
    expect((await ctx.db.doc('amendments/a1').get()).get('isOpen')).toBe(true);
  });

  it('RF-12 (004) · 12.4: ningún nombre de API_OPS permite cerrar, ampliar o aplicar', () => {
    const forbidden = Object.keys(API_OPS).filter((name) => /extend|apply|close/i.test(name));
    expect(forbidden).toEqual([]);
  });
});
