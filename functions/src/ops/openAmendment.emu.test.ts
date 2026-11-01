// T-6.2, T-6.3, T-6.4 (004): abrir una propuesta de cambiar, quitar o añadir (RF-6 (004), RF-16 (004) · 16.4, RNF-1 (004)).
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution, seedSuspendedAccount } from '../testing/constitutionKit';
import { handleOpenAmendment } from './openAmendment';

let ctx: TestCtx;
let ana: string;
let beto: string;

const OPENED = new Date('2026-10-01T12:00:00Z');
const amendment = async (id: string) => (await ctx.db.doc(`amendments/${id}`).get()).data() as Record<string, unknown>;
const meta = async (id: string) => (await ctx.db.doc(`constitutionSections/${id}/private/meta`).get()).data() as Record<string, unknown>;
const change = { kind: 'change', sectionId: 's1', title: 'Agua común', text: 'El agua es de todas.', motive: 'Aclara el sentido.' };

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: OPENED });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1', title: 'Agua', text: 'Texto del agua.' }, { id: 's2' }] });
});

describe('openAmendment · cambiar y quitar', () => {
  it('RF-6 (004) · 6.1: una cuenta activa abre un cambio con motivo y queda quién y cuándo', async () => {
    const result = await handleOpenAmendment(ctx, change, ana);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await amendment(result.id)).toMatchObject({
      kind: 'change', sectionId: 's1', slotKey: 's:s1', title: 'Agua común', motive: 'Aclara el sentido.', revisionNo: 1,
      baseSectionVersion: 1, authorUid: ana, authorUsername: 'ana', isOpen: true, result: null, extended: false, eventSeq: 1,
    });
    expect(((await amendment(result.id))['openedAt'] as Timestamp).toDate()).toEqual(OPENED);
    const event = (await ctx.db.doc(`amendments/${result.id}/events/1`).get()).data();
    expect(event).toMatchObject({ seq: 1, kind: 'opened', uid: ana, username: 'ana' });
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).data()).toEqual({ amendmentId: result.id });
  });

  it('RF-6 (004) · 6.3: cierre a 360 h exactas y marca de la sección', async () => {
    const result = await handleOpenAmendment(ctx, change, ana);
    if (!result.ok) throw new Error('debía abrir');
    const closes = ((await amendment(result.id))['closesAt'] as Timestamp).toDate();
    expect(closes.getTime() - OPENED.getTime()).toBe(360 * 3600 * 1000);
    const mark = (await meta('s1'))['openAmendment'] as { id: string; kind: string; closesAt: Timestamp };
    expect(mark.id).toBe(result.id);
    expect(mark.kind).toBe('change');
    expect(mark.closesAt.toDate()).toEqual(closes);
  });

  it('RF-6 (004) · 6.1: quitar una sección vigente también se abre y marca la sección', async () => {
    const result = await handleOpenAmendment(ctx, { kind: 'remove', sectionId: 's2', motive: 'Ya no hace falta.' }, beto);
    if (!result.ok) throw new Error('debía abrir');
    expect(await amendment(result.id)).toMatchObject({ kind: 'remove', sectionId: 's2', slotKey: 's:s2', motive: 'Ya no hace falta.' });
    expect(((await meta('s2'))['openAmendment'] as { kind: string }).kind).toBe('remove');
  });

  it('RF-6 (004) · 6.1: sin motivo, sin sesión o con cuenta suspendida se rechaza; WHILE la constitución no está abierta, constitution-not-open', async () => {
    expect(await codeOf(handleOpenAmendment(ctx, { ...change, motive: '  ' }, ana))).toBe('text-empty');
    expect(await codeOf(handleOpenAmendment(ctx, change, null))).toBe('unauthenticated');
    const sus = (await seedSuspendedAccount(ctx, { username: 'sus' })).uid;
    expect(await codeOf(handleOpenAmendment(ctx, change, sus))).toBe('account-suspended');
    await ctx.db.doc('constitution/state').update({ isOpen: false });
    expect(await codeOf(handleOpenAmendment(ctx, change, ana))).toBe('constitution-not-open');
    expect((await ctx.db.collection('amendments').get()).size).toBe(0);
  });

  it('RF-6 (004) · 6.4: un cambio idéntico a lo vigente se rechaza con amendment-unchanged', async () => {
    expect(await codeOf(handleOpenAmendment(ctx, { ...change, title: 'Agua', text: 'Texto del agua.' }, ana))).toBe('amendment-unchanged');
    expect((await ctx.db.collection('amendments').get()).size).toBe(0);
    expect(((await meta('s1'))['openAmendment'])).toBeNull();
  });

  it('RF-6 (004) · 6.6: una sección retirada o inexistente se rechaza', async () => {
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 'old', isRetired: true }] });
    expect(await codeOf(handleOpenAmendment(ctx, { ...change, sectionId: 'old' }, ana))).toBe('section-retired');
    expect(await codeOf(handleOpenAmendment(ctx, { ...change, sectionId: 'nada' }, ana))).toBe('section-not-found');
    expect(await codeOf(handleOpenAmendment(ctx, { kind: 'remove', sectionId: 'old', motive: 'x' }, ana))).toBe('section-retired');
  });
});

describe('openAmendment · añadir y cerradura', () => {
  const add = { kind: 'add', title: 'Energía', text: 'Texto nuevo.', motive: 'Falta el eje.' };

  it('RF-6 (004) · 6.2: añadir al principio o después de una sección vigente', async () => {
    const start = await handleOpenAmendment(ctx, { ...add, after: null }, ana);
    const after = await handleOpenAmendment(ctx, { ...add, after: 's2' }, ana);
    if (!start.ok || !after.ok) throw new Error('debían abrir');
    expect(await amendment(start.id)).toMatchObject({ kind: 'add', sectionId: null, after: null, slotKey: 'a:start', baseSectionVersion: null });
    expect(await amendment(after.id)).toMatchObject({ after: 's2', slotKey: 'a:s2' });
  });

  it('RF-6 (004) · 6.2: añadir después de una sección retirada o inexistente se rechaza', async () => {
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }, { id: 'old', isRetired: true }] });
    expect(await codeOf(handleOpenAmendment(ctx, { ...add, after: 'old' }, ana))).toBe('section-retired');
    expect(await codeOf(handleOpenAmendment(ctx, { ...add, after: 'nada' }, ana))).toBe('section-not-found');
  });

  it('RF-6 (004) · 6.5: la segunda propuesta sobre la misma sección o lugar recibe taken y enlaza a la abierta', async () => {
    const first = await handleOpenAmendment(ctx, change, ana);
    if (!first.ok) throw new Error('debía abrir');
    expect(await handleOpenAmendment(ctx, { ...change, title: 'Otro' }, beto)).toEqual({ ok: false, taken: true, amendmentId: first.id });
    expect(await handleOpenAmendment(ctx, { kind: 'remove', sectionId: 's1', motive: 'x' }, beto)).toEqual({ ok: false, taken: true, amendmentId: first.id });
    const place = await handleOpenAmendment(ctx, { ...add, after: 's1' }, ana);
    if (!place.ok) throw new Error('debía abrir');
    expect(await handleOpenAmendment(ctx, { ...add, after: 's1' }, beto)).toEqual({ ok: false, taken: true, amendmentId: place.id });
    expect((await ctx.db.collection('amendments').get()).size).toBe(2);
  });

  it('RF-6 (004) · 6.5: liberada la cerradura se puede abrir otra sobre la misma sección', async () => {
    await seedAmendment(ctx, { id: 'viejo', sectionId: 's1', author: { uid: ana, username: 'ana' }, isOpen: false, result: 'rejected' });
    expect((await handleOpenAmendment(ctx, change, beto)).ok).toBe(true);
  });
});

describe('openAmendment · máximo de 100', () => {
  it('RF-16 (004) · 16.4: con 100 abiertas la 101 responde amendment-limit y, al cerrarse una, se acepta', async () => {
    const batch = ctx.db.batch();
    for (let i = 0; i < 100; i += 1) {
      batch.set(ctx.db.doc(`amendments/m${i}`), { isOpen: true, kind: 'add', slotKey: `a:z${i}`, closesAt: Timestamp.fromDate(OPENED) });
    }
    await batch.commit();
    expect(await codeOf(handleOpenAmendment(ctx, change, ana))).toBe('amendment-limit');
    expect((await ctx.db.collection('amendments').get()).size).toBe(100);
    await ctx.db.doc('amendments/m0').update({ isOpen: false });
    expect((await handleOpenAmendment(ctx, change, ana)).ok).toBe(true);
  });
});
