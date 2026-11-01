// T-4.6 (004) · Abrir la constitución: primera versión de cada sección con autoría «texto inicial» y registro
// de la apertura, en una transacción (RF-4 (004) · 4.3, RNF-1 (004), D-T11 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { INITIAL_AUTHOR } from '../../../shared/domain/constitution';
import { handleOpenConstitution } from './openConstitution';

let ctx: TestCtx;
let ana: string;
let fabi: string;

const data = async (path: string) => (await ctx.db.doc(path).get()).data() as Record<string, unknown> | undefined;
const iso = (value: unknown) => (value as { toDate(): Date }).toDate().toISOString();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-01T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  const before = new Date('2026-09-20T10:00:00Z');
  await ctx.db.doc('constitution/state').set({ isOpen: false, openedAt: null, order: ['s2', 's1'], updatedAt: before, logSeq: 0 });
  await ctx.db.doc('constitutionSections/s1').set({ title: 'Cuidados', text: 'Nos cuidamos.', updatedAt: before, isRetired: false, retiredAt: null });
  await ctx.db.doc('constitutionSections/s2').set({ title: 'Agua', text: 'El agua es común.', updatedAt: before, isRetired: false, retiredAt: null });
});

describe('openConstitution', () => {
  it('RF-4 (004) · 4.3: cada sección recibe versions/1 con autoría «texto inicial» y queda un registro opened con quién y cuándo', async () => {
    expect(await handleOpenConstitution(ctx, {}, fabi)).toEqual({});
    for (const [id, title, text] of [['s1', 'Cuidados', 'Nos cuidamos.'], ['s2', 'Agua', 'El agua es común.']] as const) {
      const version = await data(`constitutionSections/${id}/versions/1`);
      expect(version).toMatchObject({
        version: 1, title, text, kind: 'initial', amendmentId: null, proposedByUid: null,
        proposedByUsername: INITIAL_AUTHOR, agreementsCounted: 0, authorAgreementCounted: false,
        objectionsResolved: 0, objectionsWithdrawn: 0,
      });
      expect(iso(version!['at'])).toBe('2026-10-01T12:00:00.000Z');
      expect(await data(`constitutionSections/${id}/private/meta`)).toEqual({
        version: 1, proposedByUid: null, proposedByUsername: INITIAL_AUTHOR, openAmendment: null,
      });
      expect(iso((await data(`constitutionSections/${id}`))!['updatedAt'])).toBe('2026-10-01T12:00:00.000Z');
    }
    expect(INITIAL_AUTHOR).toBe('texto inicial');
    const log = await data('constitutionLog/1');
    expect(log).toMatchObject({ seq: 1, kind: 'opened', sectionId: null, version: null, amendmentId: null, byUid: fabi, byUsername: 'fabi' });
    expect(iso(log!['at'])).toBe('2026-10-01T12:00:00.000Z');
    const state = (await data('constitution/state'))!;
    expect(state).toMatchObject({ isOpen: true, order: ['s2', 's1'], logSeq: 1 });
    expect(iso(state['openedAt'])).toBe('2026-10-01T12:00:00.000Z');
    expect(iso(state['updatedAt'])).toBe('2026-10-01T12:00:00.000Z');
  });

  it('RF-4 (004) · 4.3: solo un facilitador activo abre; la persona inscrita y la sesión ausente no cambian nada', async () => {
    expect(await codeOf(handleOpenConstitution(ctx, {}, ana))).toBe('forbidden');
    expect(await codeOf(handleOpenConstitution(ctx, {}, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${fabi}`).update({ status: 'suspended' });
    expect(await codeOf(handleOpenConstitution(ctx, {}, fabi))).toBe('account-suspended');
    expect((await data('constitution/state'))!['isOpen']).toBe(false);
    expect((await ctx.db.collection('constitutionLog').get()).size).toBe(0);
  });

  it('RF-4 (004) · 4.6: ya abierta, toda apertura nueva se rechaza y no se repiten versiones ni registro', async () => {
    await handleOpenConstitution(ctx, {}, fabi);
    ctx.setNow(new Date('2026-10-02T12:00:00Z'));
    expect(await codeOf(handleOpenConstitution(ctx, {}, fabi))).toBe('constitution-already-open');
    expect((await ctx.db.collection('constitutionLog').get()).size).toBe(1);
    expect((await ctx.db.collection('constitutionSections/s1/versions').get()).size).toBe(1);
    expect(iso((await data('constitution/state'))!['openedAt'])).toBe('2026-10-01T12:00:00.000Z');
  });

  it('RF-4 (004) · 4.6: no hay op para volver a cerrarla; ninguna carga hace que isOpen vuelva a false', async () => {
    await handleOpenConstitution(ctx, {}, fabi);
    expect(await codeOf(handleOpenConstitution(ctx, { isOpen: false }, fabi))).toBe('constitution-already-open');
    expect((await data('constitution/state'))!['isOpen']).toBe(true);
  });

  it('RF-4 (004) · 4.3: sin estado sembrado, la apertura crea el estado con el orden vacío', async () => {
    await clearEmulators();
    fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
    await handleOpenConstitution(ctx, {}, fabi);
    expect(await data('constitution/state')).toMatchObject({ isOpen: true, order: [], logSeq: 1 });
  });
});
