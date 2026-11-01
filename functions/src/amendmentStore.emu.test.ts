// T-6.1 (004): base transaccional de las propuestas: lectura de una abierta, cerraduras de lugar y registro con `seq`
// (RF-12 (004) · 6, RNF-1 (004), D-T1 (004), D-T16 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { appendEvent, readOpenAmendment, recordEvent, releaseSlot, takeSlot } from './amendmentStore';
import { ApiError } from './errors';
import { seedAmendment, seedConstitution } from './testing/constitutionKit';
import { clearEmulators, createTestCtx, type TestCtx } from './testing';

const ana = { uid: 'uid-ana', username: 'ana' };
const OPENED = new Date('2026-09-01T12:00:00Z');
const CLOSES = new Date(OPENED.getTime() + 360 * 3600 * 1000);

let ctx: TestCtx;

const codeOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return 'ok';
};
const readIn = (id: string) => ctx.db.runTransaction((tx) => readOpenAmendment(ctx, tx, id));

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-05T10:00:00Z') });
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 's2' }] });
});

describe('amendmentStore', () => {
  it('RF-12 (004) · 12.6: lee una propuesta abierta con sus instantes en milisegundos y su contador de eventos', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: ana, openedAt: OPENED });
    const { amendment, eventSeq } = await readIn('a1');
    expect(amendment).toMatchObject({ id: 'a1', kind: 'change', sectionId: 's1', slotKey: 's:s1', authorUid: ana.uid, isOpen: true, revisionNo: 1 });
    expect(amendment.openedAt).toBe(OPENED.getTime());
    expect(amendment.closesAt).toBe(CLOSES.getTime());
    expect(eventSeq).toBe(1);
  });

  it('RF-12 (004) · 12.6: una propuesta vencida que nadie procesó se rechaza con amendment-closed, un milisegundo antes aún se lee', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: ana, openedAt: OPENED });
    ctx.setNow(new Date(CLOSES.getTime() - 1));
    expect(await codeOf(() => readIn('a1'))).toBe('ok');
    ctx.setNow(CLOSES);
    expect(await codeOf(() => readIn('a1'))).toBe('amendment-closed');
    ctx.setNow(new Date(CLOSES.getTime() + 86_400_000));
    expect(await codeOf(() => readIn('a1'))).toBe('amendment-closed');
  });

  it('RF-12 (004) · 12.6: una propuesta ya cerrada responde amendment-closed y una que no existe, amendment-not-found', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: ana, openedAt: OPENED, isOpen: false, result: 'withdrawn' });
    expect(await codeOf(() => readIn('a1'))).toBe('amendment-closed');
    expect(await codeOf(() => readIn('no-existe'))).toBe('amendment-not-found');
  });

  it('RF-6 (004) · 6.5: una segunda cerradura sobre la misma clave falla y señala la propuesta que la tiene', async () => {
    const first = await ctx.db.runTransaction((tx) => takeSlot(ctx, tx, 's:s1', 'a1'));
    expect(first).toEqual({ ok: true });
    const second = await ctx.db.runTransaction((tx) => takeSlot(ctx, tx, 's:s1', 'a2'));
    expect(second).toEqual({ ok: false, taken: true, amendmentId: 'a1' });
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).data()).toEqual({ amendmentId: 'a1' });
    const other = await ctx.db.runTransaction((tx) => takeSlot(ctx, tx, 's:s2', 'a2'));
    expect(other).toEqual({ ok: true });
  });

  it('RF-6 (004) · 6.6: dos aperturas a la vez sobre la misma clave: solo una gana', async () => {
    const results = await Promise.all(['a1', 'a2'].map((id) => ctx.db.runTransaction((tx) => takeSlot(ctx, tx, 'a:start', id))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const winner = (await ctx.db.doc('amendmentSlots/a:start').get()).get('amendmentId');
    expect(results.find((r) => !r.ok)).toMatchObject({ taken: true, amendmentId: winner });
  });

  it('RF-6 (004) · 6.6: liberar la cerradura permite abrir de nuevo sobre la misma clave', async () => {
    await ctx.db.runTransaction((tx) => takeSlot(ctx, tx, 's:s1', 'a1'));
    await ctx.db.runTransaction(async (tx) => {
      releaseSlot(ctx, tx, 's:s1');
    });
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).exists).toBe(false);
    expect(await ctx.db.runTransaction((tx) => takeSlot(ctx, tx, 's:s1', 'a2'))).toEqual({ ok: true });
  });

  it('RNF-1 (004): un evento recibe su seq con quién (uid y nombre de ese momento) y cuándo', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: ana, openedAt: OPENED });
    await ctx.db.runTransaction(async (tx) => {
      appendEvent(ctx, tx, 'a1', 2, { kind: 'commented', actor: { uid: 'uid-beto', username: 'beto' }, detail: { commentId: 'c1' } });
    });
    const event = (await ctx.db.doc('amendments/a1/events/2').get()).data() as Record<string, unknown>;
    expect(event).toMatchObject({ seq: 2, kind: 'commented', uid: 'uid-beto', username: 'beto', detail: { commentId: 'c1' } });
    expect((event['at'] as { toDate(): Date }).toDate()).toEqual(ctx.now());
  });

  it('RNF-1 (004): recordEvent toma el siguiente seq de la propuesta y lo deja avanzado; el nombre queda como estaba ese día', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: ana, openedAt: OPENED });
    await ctx.db.runTransaction(async (tx) => {
      const open = await readOpenAmendment(ctx, tx, 'a1');
      expect(recordEvent(ctx, tx, open, { kind: 'revised', actor: ana })).toBe(2);
      expect(recordEvent(ctx, tx, open, { kind: 'agreed', actor: { uid: 'uid-beto', username: 'beto' } })).toBe(3);
    });
    expect((await ctx.db.doc('amendments/a1').get()).get('eventSeq')).toBe(3);
    const events = await ctx.db.collection('amendments/a1/events').orderBy('seq').get();
    expect(events.docs.map((d) => d.get('kind'))).toEqual(['opened', 'revised', 'agreed']);
    expect(events.docs.map((d) => d.get('username'))).toEqual(['ana', 'ana', 'beto']);
  });

  it('RNF-1 (004): dos eventos simultáneos no pisan el mismo seq', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', author: ana, openedAt: OPENED });
    await Promise.all(
      ['uno', 'dos'].map((kind) =>
        ctx.db.runTransaction(async (tx) => {
          recordEvent(ctx, tx, await readOpenAmendment(ctx, tx, 'a1'), { kind, actor: ana });
        }),
      ),
    );
    const events = await ctx.db.collection('amendments/a1/events').get();
    expect(events.docs.map((d) => d.id).sort()).toEqual(['1', '2', '3']);
  });
});
