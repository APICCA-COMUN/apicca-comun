// T-7.7 (004) · `amendmentCloser`: el cierre programado, probado con el contexto de prueba (RNF-2 (004), D-T7 (004)).
import { describe, expect, it } from 'vitest';
import { closeDueAmendments } from './amendmentCloser';
import { clearEmulators, createTestCtx, seedAccount } from './testing';
import { seedAmendment, seedConstitution } from './testing/constitutionKit';

describe('amendmentCloser', () => {
  it('RNF-2 (004): la tarea cierra lo vencido sin que nadie abra el sitio, con la fecha del vencimiento', async () => {
    await clearEmulators();
    const opened = new Date('2026-10-01T12:00:00Z');
    const ctx = createTestCtx({ now: opened });
    const ana = (await seedAccount(ctx, { username: 'ana' })).uid;
    const beto = (await seedAccount(ctx, { username: 'beto' })).uid;
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 's2' }] });
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, openedAt: opened, stances: [{ uid: beto, username: 'beto' }] });
    await seedAmendment(ctx, { id: 'a2', sectionId: 's2', author: { uid: ana, username: 'ana' }, openedAt: new Date('2026-10-10T00:00:00Z'), stances: [{ uid: beto, username: 'beto' }] });
    ctx.setNow(new Date('2026-10-16T12:10:00Z'));
    expect(await closeDueAmendments(ctx)).toBe(1);
    const a1 = await ctx.db.doc('amendments/a1').get();
    expect(a1.get('result')).toBe('approved');
    expect(a1.get('closedAt').toDate().toISOString()).toBe('2026-10-16T12:00:00.000Z');
    expect((await ctx.db.doc('amendments/a2').get()).get('isOpen')).toBe(true);
    expect(await closeDueAmendments(ctx)).toBe(0);
  });
});
