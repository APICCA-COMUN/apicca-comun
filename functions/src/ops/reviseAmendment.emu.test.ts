// T-6.5, T-6.6 (004): revisar una propuesta propia (RF-8 (004) · 8.1, 8.2, 8.4, RF-14 (004) · 14.4, 14.5, RF-17 (004) · 17.2).
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedAmendment, seedConstitution } from '../testing/constitutionKit';
import { handleReviseAmendment } from './reviseAmendment';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;

const amendment = async () => (await ctx.db.doc('amendments/a1').get()).data() as Record<string, unknown>;
const body = { amendmentId: 'a1', baseRevision: 1, title: 'Título nuevo', text: 'Texto nuevo.', motive: 'Motivo nuevo.' };

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1', title: 'Agua', text: 'Texto del agua.' }] });
  await seedAmendment(ctx, {
    id: 'a1', sectionId: 's1', author: { uid: ana, username: 'ana' }, title: 'Título', text: 'Texto.', motive: 'Motivo.',
    stances: [{ uid: beto, username: 'beto', agreement: 'active', agreedAtRevision: 1 }],
  });
});

describe('reviseAmendment', () => {
  it('RF-8 (004) · 8.1: quien propuso revisa título, texto y motivo sin cambiar tipo, sección ni lugar', async () => {
    ctx.setNow(new Date('2026-10-02T09:00:00Z'));
    expect(await handleReviseAmendment(ctx, body, ana)).toEqual({ ok: true, revisionNo: 2 });
    expect(await amendment()).toMatchObject({ kind: 'change', sectionId: 's1', slotKey: 's:s1', title: 'Título nuevo', text: 'Texto nuevo.', motive: 'Motivo nuevo.', revisionNo: 2, eventSeq: 2, isOpen: true });
    const event = (await ctx.db.doc('amendments/a1/events/2').get()).data();
    expect(event).toMatchObject({ seq: 2, kind: 'revised', uid: ana, username: 'ana' });
    expect((event?.['at'] as Timestamp).toDate().toISOString()).toBe('2026-10-02T09:00:00.000Z');
  });

  it('RF-8 (004) · 8.2: guarda el contenido anterior en revisions/n y deja los acuerdos previos sin anular', async () => {
    await handleReviseAmendment(ctx, body, ana);
    expect((await ctx.db.doc('amendments/a1/revisions/1').get()).data()).toMatchObject({ title: 'Título', text: 'Texto.', motive: 'Motivo.', revisionNo: 1 });
    expect((await ctx.db.doc('amendments/a1/stances/' + beto).get()).data()).toMatchObject({ agreement: 'active', agreedAtRevision: 1 });
    expect(await handleReviseAmendment(ctx, { ...body, baseRevision: 2, title: 'Tercero' }, ana)).toEqual({ ok: true, revisionNo: 3 });
    expect((await ctx.db.doc('amendments/a1/revisions/2').get()).data()).toMatchObject({ title: 'Título nuevo', revisionNo: 2 });
  });

  it('RF-8 (004) · 8.4: otra persona, facilitador incluido, no revisa una propuesta ajena', async () => {
    expect(await codeOf(handleReviseAmendment(ctx, body, beto))).toBe('not-amendment-author');
    expect(await codeOf(handleReviseAmendment(ctx, body, fabi))).toBe('not-amendment-author');
    expect(await codeOf(handleReviseAmendment(ctx, body, null))).toBe('unauthenticated');
    expect((await amendment())['revisionNo']).toBe(1);
  });

  it('RF-8 (004) · 8.1: una propuesta cerrada o inexistente no se revisa', async () => {
    expect(await codeOf(handleReviseAmendment(ctx, { ...body, amendmentId: 'nada' }, ana))).toBe('amendment-not-found');
    await ctx.db.doc('amendments/a1').update({ isOpen: false });
    expect(await codeOf(handleReviseAmendment(ctx, body, ana))).toBe('amendment-closed');
  });

  it('RF-16 (004) · 16.1: títulos, textos o motivos vacíos se rechazan y nada cambia', async () => {
    expect(await codeOf(handleReviseAmendment(ctx, { ...body, text: ' ' }, ana))).toBe('text-empty');
    expect(await codeOf(handleReviseAmendment(ctx, { ...body, motive: '' }, ana))).toBe('text-empty');
    expect((await amendment())['revisionNo']).toBe(1);
  });

  it('RF-6 (004) · 6.4: revisar un cambio hasta dejarlo idéntico a lo vigente se rechaza', async () => {
    expect(await codeOf(handleReviseAmendment(ctx, { ...body, title: 'Agua', text: 'Texto del agua.' }, ana))).toBe('amendment-unchanged');
  });

  it('RF-8 (004) · 8.1: una propuesta de quitar solo revisa su motivo', async () => {
    await seedAmendment(ctx, { id: 'a2', kind: 'remove', sectionId: 's2x', author: { uid: ana, username: 'ana' }, title: 'Quitar', text: 'Vigente.' });
    expect(await handleReviseAmendment(ctx, { amendmentId: 'a2', baseRevision: 1, motive: 'Otro motivo.' }, ana)).toEqual({ ok: true, revisionNo: 2 });
    expect((await ctx.db.doc('amendments/a2').get()).data()).toMatchObject({ title: 'Quitar', text: 'Vigente.', motive: 'Otro motivo.' });
  });

  it('RF-17 (004) · 17.2: con una base vieja responde conflicto con lo vigente y no escribe', async () => {
    await handleReviseAmendment(ctx, body, ana);
    const result = await handleReviseAmendment(ctx, { ...body, title: 'Otro' }, ana);
    expect(result).toEqual({ ok: false, conflict: true, current: { revisionNo: 2, title: 'Título nuevo', text: 'Texto nuevo.', motive: 'Motivo nuevo.' } });
    expect((await amendment())['revisionNo']).toBe(2);
  });
});

describe('reviseAmendment · cuenta suspendida', () => {
  it('RF-14 (004) · 14.4: con la cuenta suspendida la revisión se rechaza y, reactivada, se acepta (14.5)', async () => {
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'suspended' });
    expect(await codeOf(handleReviseAmendment(ctx, body, ana))).toBe('account-suspended');
    expect((await amendment())['revisionNo']).toBe(1);
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'active' });
    expect((await handleReviseAmendment(ctx, body, ana)).ok).toBe(true);
  });
});
