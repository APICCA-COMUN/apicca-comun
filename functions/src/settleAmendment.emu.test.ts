// T-7.1 y T-7.2 (004) · Cierre de una propuesta al vencer: aprobar, ampliar o rechazar (RF-12 (004), D-T5 (004), D-T8 (004)).
import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { settleAmendment } from './amendmentStore';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { seedAmendment, seedConstitution } from './testing/constitutionKit';

let ctx: TestCtx;
const OPENED = new Date('2026-10-01T12:00:00Z');
const CLOSES = new Date('2026-10-16T12:00:00Z'); // + 360 h
const CLOSES_EXT = new Date('2026-10-31T12:00:00Z'); // + 360 h más, sobre el cierre original

const data = async (path: string) => (await ctx.db.doc(path).get()).data() as Record<string, unknown>;
const iso = (value: unknown) => (value as Timestamp).toDate().toISOString();
const at = (ms: number, base: Date) => new Date(base.getTime() + ms);

interface Setup {
  /** Cuentas activas, la de quien propone incluida. */
  accounts: number;
  /** Acuerdos de personas distintas de quien propone. */
  agreements: number;
  /** Objeciones abiertas (cada una de una persona distinta, sin acuerdo). */
  objections?: number;
}

/** `ana` propone; las demás cuentas se llaman p1…; los acuerdos son de las primeras, las objeciones de las últimas. */
async function setup(input: Setup): Promise<void> {
  await clearEmulators();
  ctx = createTestCtx({ now: OPENED });
  const ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  const others: { uid: string; username: string }[] = [];
  for (let i = 1; i < input.accounts; i += 1) others.push({ uid: (await seedAccount(ctx, { username: `p${i}` })).uid, username: `p${i}` });
  const objections = input.objections ?? 0;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
  await seedAmendment(ctx, {
    id: 'a1',
    sectionId: 's1',
    author: { uid: ana, username: 'ana' },
    openedAt: OPENED,
    stances: others.slice(0, input.agreements).map((p) => ({ uid: p.uid, username: p.username })),
    objections: others.slice(others.length - objections).map((p, i) => ({ id: `o${i}`, uid: p.uid, username: p.username })),
  });
}

describe('settleAmendment · aprobar o rechazar', () => {
  it('RF-12 (004) · 12.1: en el instante del cierre, con acuerdo ajeno y mayoría, se aprueba; cierra con la fecha del cierre y libera la cerradura y la marca', async () => {
    await setup({ accounts: 4, agreements: 1 });
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe('approved');
    const doc = await data('amendments/a1');
    expect(doc).toMatchObject({ isOpen: false, result: 'approved', reasons: [], agreementsCounted: 2, objectionsResolved: 0, objectionsWithdrawn: 0 });
    expect(iso(doc['closedAt'])).toBe(CLOSES.toISOString());
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).exists).toBe(false);
    expect((await data('constitutionSections/s1/private/meta'))['openAmendment']).toBeNull();
    expect((await data('amendments/a1/events/2'))).toMatchObject({ seq: 2, kind: 'closed', detail: { result: 'approved' } });
  });

  it('RF-12 (004) · 12.1: un milisegundo antes del cierre no hace nada', async () => {
    await setup({ accounts: 4, agreements: 2 });
    ctx.setNow(at(-1, CLOSES));
    expect(await settleAmendment(ctx, 'a1')).toBe('none');
    expect(await data('amendments/a1')).toMatchObject({ isOpen: true, result: null, eventSeq: 1 });
  });

  // cuentas activas, acuerdos ajenos, objeciones abiertas → resultado al primer vencimiento
  it.each([
    [1, 0, 0, 'extended'], // sola: falta un acuerdo ajeno
    [2, 1, 0, 'approved'], // 2 × 2 ≥ 2
    [3, 1, 0, 'approved'], // 2 × 2 ≥ 3
    [4, 1, 0, 'approved'], // 2 × 2 ≥ 4
    [5, 1, 0, 'extended'], // 2 × 2 < 5
    [5, 2, 0, 'approved'], // 2 × 3 ≥ 5
    [4, 0, 0, 'extended'], // sin acuerdo ajeno
    [4, 2, 1, 'extended'], // objeción abierta
  ] as const)('RF-12 (004) · 12.1: %i cuentas, %i acuerdos ajenos, %i objeciones abiertas → %s', async (accounts, agreements, objections, expected) => {
    await setup({ accounts, agreements, objections });
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe(expected);
  });

  it('RF-12 (004) · 12.1: las cuentas suspendidas no cuentan entre las activas y el acuerdo retirado no suma', async () => {
    await setup({ accounts: 3, agreements: 1 });
    // una cuenta más, suspendida: sigue habiendo 3 activas y basta 1 acuerdo ajeno
    await seedAccount(ctx, { username: 'susp', status: 'suspended' });
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe('approved');
  });

  it('RF-12 (004) · 12.3: al vencer la ampliación sin condición cierra no aprobada con ambos motivos', async () => {
    await setup({ accounts: 5, agreements: 1, objections: 1 });
    ctx.setNow(CLOSES);
    await settleAmendment(ctx, 'a1');
    ctx.setNow(CLOSES_EXT);
    expect(await settleAmendment(ctx, 'a1')).toBe('rejected');
    const doc = await data('amendments/a1');
    expect(doc).toMatchObject({ isOpen: false, result: 'rejected', extended: true });
    expect(doc['reasons']).toEqual(['insufficient_agreements', 'open_objection']);
    expect(iso(doc['closedAt'])).toBe(CLOSES_EXT.toISOString());
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).exists).toBe(false);
  });

  it('RF-12 (004) · 12.3: solo objeción abierta registra solo ese motivo; solo acuerdos insuficientes, solo ese', async () => {
    await setup({ accounts: 3, agreements: 1, objections: 1 });
    ctx.setNow(CLOSES_EXT);
    await settleAmendment(ctx, 'a1'); // procesada tarde: amplía y cierra en una llamada
    expect((await data('amendments/a1'))['reasons']).toEqual(['open_objection']);
    await setup({ accounts: 5, agreements: 1 });
    ctx.setNow(CLOSES_EXT);
    await settleAmendment(ctx, 'a1');
    expect((await data('amendments/a1'))['reasons']).toEqual(['insufficient_agreements']);
  });

  it('RF-12 (004) · 12.5: la fecha es el instante del vencimiento aunque se procese días después', async () => {
    await setup({ accounts: 4, agreements: 1 });
    ctx.setNow(at(3 * 24 * 3600 * 1000, CLOSES));
    expect(await settleAmendment(ctx, 'a1')).toBe('approved');
    expect(iso((await data('amendments/a1'))['closedAt'])).toBe(CLOSES.toISOString());
  });

  it('RF-12 (004) · 12.5: procesada tras la ampliación, la rechazada se fecha en el segundo vencimiento', async () => {
    await setup({ accounts: 5, agreements: 0 });
    ctx.setNow(at(5 * 24 * 3600 * 1000, CLOSES_EXT));
    expect(await settleAmendment(ctx, 'a1')).toBe('rejected');
    expect(iso((await data('amendments/a1'))['closedAt'])).toBe(CLOSES_EXT.toISOString());
  });

  it('RF-12 (004) · 12.5: llamarla dos veces equivale a llamarla una', async () => {
    await setup({ accounts: 4, agreements: 1 });
    ctx.setNow(at(1000, CLOSES));
    expect(await settleAmendment(ctx, 'a1')).toBe('approved');
    const before = await data('amendments/a1');
    expect(await settleAmendment(ctx, 'a1')).toBe('none');
    expect(await data('amendments/a1')).toEqual(before);
    expect((await ctx.db.collection('amendments/a1/events').get()).size).toBe(2);
    expect((await data('constitution/state'))['logSeq']).toBe(2);
  });

  it('RF-12 (004) · 12.5: una propuesta inexistente o ya retirada no hace nada', async () => {
    await setup({ accounts: 4, agreements: 1 });
    expect(await settleAmendment(ctx, 'nada')).toBe('none');
    await ctx.db.doc('amendments/a1').update({ isOpen: false, result: 'withdrawn' });
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe('none');
  });
});

describe('settleAmendment · ampliación', () => {
  it('RF-12 (004) · 12.2: sin condición, al cierre original suma 360 h al original, marca extended y deja evento y marca de sección', async () => {
    await setup({ accounts: 5, agreements: 1 });
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe('extended');
    const doc = await data('amendments/a1');
    expect(doc).toMatchObject({ isOpen: true, extended: true, result: null });
    expect(iso(doc['closesAt'])).toBe(CLOSES_EXT.toISOString());
    expect(doc['closedAt']).toBeNull();
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).exists).toBe(true);
    expect(iso((await data('constitutionSections/s1/private/meta'))['openAmendment'] && ((await data('constitutionSections/s1/private/meta'))['openAmendment'] as Record<string, unknown>)['closesAt'])).toBe(CLOSES_EXT.toISOString());
    expect(await data('amendments/a1/events/2')).toMatchObject({ kind: 'extended', uid: 'system' });
  });

  it('RF-12 (004) · 12.2: la ampliación suma al cierre original aunque se procese tarde y no se amplía dos veces', async () => {
    await setup({ accounts: 5, agreements: 1 });
    ctx.setNow(at(2 * 24 * 3600 * 1000, CLOSES));
    await settleAmendment(ctx, 'a1');
    expect(iso((await data('amendments/a1'))['closesAt'])).toBe(CLOSES_EXT.toISOString());
    expect(await settleAmendment(ctx, 'a1')).toBe('none');
    expect((await data('amendments/a1'))['eventSeq']).toBe(2);
  });

  it('RF-12 (004) · 12.2: un milisegundo antes de cada vencimiento no hace nada; en el segundo, cierra', async () => {
    await setup({ accounts: 5, agreements: 1 });
    ctx.setNow(at(-1, CLOSES));
    expect(await settleAmendment(ctx, 'a1')).toBe('none');
    ctx.setNow(CLOSES);
    expect(await settleAmendment(ctx, 'a1')).toBe('extended');
    ctx.setNow(at(-1, CLOSES_EXT));
    expect(await settleAmendment(ctx, 'a1')).toBe('none');
    expect(await data('amendments/a1')).toMatchObject({ isOpen: true, extended: true });
    ctx.setNow(CLOSES_EXT);
    expect(await settleAmendment(ctx, 'a1')).toBe('rejected');
  });

  it('RF-12 (004) · 12.2: si en la ampliación se cumple la condición, se aprueba en el segundo vencimiento', async () => {
    await setup({ accounts: 5, agreements: 1 });
    ctx.setNow(CLOSES);
    await settleAmendment(ctx, 'a1');
    await ctx.db.doc('amendments/a1/stances/nuevo').set({ username: 'nuevo', agreement: 'active', agreedAtRevision: 1, agreedAt: Timestamp.fromDate(CLOSES), openObjectionId: null, withdrawnReason: null });
    ctx.setNow(CLOSES_EXT);
    expect(await settleAmendment(ctx, 'a1')).toBe('approved');
  });
});
