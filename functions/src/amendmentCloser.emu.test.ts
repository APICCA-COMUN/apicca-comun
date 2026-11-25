// T-7.7 (004) · `amendmentCloser`: el cierre programado, probado con el contexto de prueba (RNF-2 (004), D-T7 (004)).
import { logger } from 'firebase-functions/logger';
import { describe, expect, it, vi } from 'vitest';
import { closeDueAmendments } from './amendmentCloser';
import { settleDue } from './amendmentStore';
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

  it('RNF-2 (004): si una propuesta falla, se registra el error y las demás se cierran igual', async () => {
    await clearEmulators();
    const opened = new Date('2026-10-01T12:00:00Z');
    const ctx = createTestCtx({ now: opened });
    const ana = (await seedAccount(ctx, { username: 'ana' })).uid;
    const beto = (await seedAccount(ctx, { username: 'beto' })).uid;
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's2' }] });
    // Vencida y abierta, pero mal formada (sin `openedAt`): `settleAmendment` lanza. Es la de cierre más antiguo, así que va primero.
    await ctx.db.doc('amendments/a0').set({ isOpen: true, closesAt: new Date('2026-10-02T00:00:00Z'), kind: 'change' });
    await seedAmendment(ctx, { id: 'a2', sectionId: 's2', author: { uid: ana, username: 'ana' }, openedAt: opened, stances: [{ uid: beto, username: 'beto' }] });
    ctx.setNow(new Date('2026-10-16T12:10:00Z'));
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    try {
      expect(await closeDueAmendments(ctx)).toBe(1);
      expect((await ctx.db.doc('amendments/a2').get()).get('result')).toBe('approved');
      expect((await ctx.db.doc('amendments/a0').get()).get('isOpen')).toBe(true);
      const messages = spy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((message) => message.includes('a0'))).toBe(true);
      expect(messages.some((message) => message.includes('1 de 2'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('RNF-2 (004): con un id concreto (op manual) el error sigue propagándose a quien llama', async () => {
    await clearEmulators();
    const ctx = createTestCtx({ now: new Date('2026-10-16T12:10:00Z') });
    await ctx.db.doc('amendments/a0').set({ isOpen: true, closesAt: new Date('2026-10-02T00:00:00Z'), kind: 'change' });
    await expect(settleDue(ctx, { id: 'a0' })).rejects.toThrow();
  });
});
