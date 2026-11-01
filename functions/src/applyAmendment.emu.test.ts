// T-7.4 y T-7.5 (004) · Aplicar una propuesta aprobada al cerrar: cambiar, quitar y añadir (RF-13 (004), D-T3 (004)).
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { settleAmendment } from './amendmentStore';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { seedAmendment, seedConstitution } from './testing/constitutionKit';

let ctx: TestCtx;
let ana: string;
let beto: string;
let cami: string;
let dani: string;
const OPENED = new Date('2026-10-01T12:00:00Z');
const CLOSES = new Date('2026-10-16T12:00:00Z');
const LATE = new Date('2026-10-18T09:30:00Z'); // se procesa dos días después

const data = async (path: string) => (await ctx.db.doc(path).get()).data() as Record<string, unknown>;
const iso = (value: unknown) => (value as Timestamp).toDate().toISOString();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: OPENED });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  cami = (await seedAccount(ctx, { username: 'cami' })).uid;
  dani = (await seedAccount(ctx, { username: 'dani' })).uid;
  await seedConstitution(ctx, {
    isOpen: true,
    updatedAt: new Date('2026-09-20T10:00:00Z'),
    logSeq: 1,
    sections: [
      { id: 's1', title: 'Agua', text: 'El agua es común.', version: 2 },
      { id: 's2', title: 'Alimento', text: 'Compartimos alimento.' },
      { id: 's3', title: 'Cobijo', text: 'Cuidamos el cobijo.' },
    ],
  });
});

const baseStances = () => [
  { uid: beto, username: 'beto' },
  { uid: cami, username: 'cami' },
];

describe('applyAmendment · cambiar y quitar', () => {
  it('RF-13 (004) · 13.1: aprobar un cambio crea la versión siguiente, sube private/meta.version y deja el texto nuevo', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', baseSectionVersion: 2, author: { uid: ana, username: 'ana' }, openedAt: OPENED, title: 'Agua y ríos', text: 'El agua y los ríos son comunes.', stances: baseStances() });
    ctx.setNow(LATE);
    expect(await settleAmendment(ctx, 'a1')).toBe('approved');
    expect(await data('constitutionSections/s1')).toMatchObject({ title: 'Agua y ríos', text: 'El agua y los ríos son comunes.', isRetired: false });
    expect(iso((await data('constitutionSections/s1'))['updatedAt'])).toBe(CLOSES.toISOString());
    expect(await data('constitutionSections/s1/private/meta')).toMatchObject({ version: 3, proposedByUid: ana, proposedByUsername: 'ana', openAmendment: null });
    expect(await data('constitutionSections/s1/versions/3')).toMatchObject({ version: 3, kind: 'change', title: 'Agua y ríos', amendmentId: 'a1', proposedByUid: ana, proposedByUsername: 'ana' });
    expect((await ctx.db.doc('constitutionSections/s1/versions/2').get()).get('text')).toBe('El agua es común.');
  });

  it('RF-13 (004) · 13.3: aprobar un quitar marca la sección retirada y sigue en el orden y en sus historiales', async () => {
    await seedAmendment(ctx, { id: 'a1', kind: 'remove', sectionId: 's2', author: { uid: ana, username: 'ana' }, openedAt: OPENED, stances: baseStances() });
    ctx.setNow(CLOSES);
    await settleAmendment(ctx, 'a1');
    expect(await data('constitutionSections/s2')).toMatchObject({ isRetired: true, title: 'Alimento' });
    expect(iso((await data('constitutionSections/s2'))['retiredAt'])).toBe(CLOSES.toISOString());
    expect(await data('constitutionSections/s2/versions/2')).toMatchObject({ kind: 'remove', version: 2, amendmentId: 'a1' });
    expect(await data('constitutionSections/s2/versions/1')).toMatchObject({ kind: 'initial' });
    expect((await data('constitutionSections/s2/private/meta'))['version']).toBe(2);
    expect((await data('constitution/state'))['order']).toEqual(['s1', 's2', 's3']);
  });

  it('RF-13 (004) · 13.4: registra quién propuso, acuerdos con el de quien propone señalado, objeciones resueltas y retiradas; fecha del conjunto = vencimiento', async () => {
    await seedAmendment(ctx, {
      id: 'a1', sectionId: 's1', baseSectionVersion: 2, author: { uid: ana, username: 'ana' }, openedAt: OPENED, title: 'Nuevo', text: 'Otro texto.',
      stances: baseStances(),
      objections: [
        { id: 'o1', uid: dani, username: 'dani', status: 'resolved', closedAt: OPENED, resolvedByRevision: 2 },
        { id: 'o2', uid: dani, username: 'dani', status: 'withdrawn', closedAt: OPENED },
        { id: 'o3', uid: cami, username: 'cami', status: 'withdrawn', closedAt: OPENED },
      ],
    });
    ctx.setNow(LATE);
    await settleAmendment(ctx, 'a1');
    const version = await data('constitutionSections/s1/versions/3');
    expect(version).toMatchObject({ agreementsCounted: 3, authorAgreementCounted: true, objectionsResolved: 1, objectionsWithdrawn: 2 });
    expect(iso(version['at'])).toBe(CLOSES.toISOString());
    expect(await data('amendments/a1')).toMatchObject({ agreementsCounted: 3, objectionsResolved: 1, objectionsWithdrawn: 2 });
    const state = await data('constitution/state');
    expect(state).toMatchObject({ logSeq: 2 });
    expect(iso(state['updatedAt'])).toBe(CLOSES.toISOString());
    const log = await data('constitutionLog/2');
    expect(log).toMatchObject({ seq: 2, kind: 'changed', sectionId: 's1', sectionTitle: 'Nuevo', version: 3, amendmentId: 'a1', byUid: ana, byUsername: 'ana', agreementsCounted: 3, authorAgreementCounted: true, objectionsResolved: 1, objectionsWithdrawn: 2 });
    expect(iso(log['at'])).toBe(CLOSES.toISOString());
  });

  it('RF-13 (004) · 13.4: un quitar aprobado registra removed en el historial del conjunto', async () => {
    await seedAmendment(ctx, { id: 'a1', kind: 'remove', sectionId: 's3', author: { uid: ana, username: 'ana' }, openedAt: OPENED, stances: baseStances() });
    ctx.setNow(CLOSES);
    await settleAmendment(ctx, 'a1');
    expect(await data('constitutionLog/2')).toMatchObject({ kind: 'removed', sectionId: 's3', sectionTitle: 'Cobijo', version: 2 });
  });

  it('RF-1 (004) · 1.5: el texto cambia solo por cierre aprobado; antes del cierre y tras un rechazo queda igual', async () => {
    await seedAmendment(ctx, { id: 'a1', sectionId: 's1', baseSectionVersion: 2, author: { uid: ana, username: 'ana' }, openedAt: OPENED, title: 'Nuevo', text: 'Otro texto.', stances: [{ uid: beto, username: 'beto' }] });
    ctx.setNow(new Date(CLOSES.getTime() - 1));
    await settleAmendment(ctx, 'a1');
    expect((await data('constitutionSections/s1'))['text']).toBe('El agua es común.');
    // rechazada: 5 cuentas activas con 1 acuerdo ajeno no bastan; a la ampliación sigue sin bastar
    await seedAccount(ctx, { username: 'eli' });
    ctx.setNow(new Date('2026-10-31T12:00:00Z'));
    expect(await settleAmendment(ctx, 'a1')).toBe('rejected');
    expect(await data('constitutionSections/s1')).toMatchObject({ text: 'El agua es común.', title: 'Agua' });
    expect((await data('constitutionSections/s1/private/meta'))['version']).toBe(2);
    expect((await ctx.db.doc('constitutionSections/s1/versions/3').get()).exists).toBe(false);
    expect(await data('constitution/state')).toMatchObject({ logSeq: 1 });
    expect(iso((await data('constitution/state'))['updatedAt'])).toBe('2026-09-20T10:00:00.000Z');
  });
});

describe('applyAmendment · añadir', () => {
  const sectionIds = async () => (await data('constitution/state'))['order'] as string[];

  it('RF-13 (004) · 13.2: aprobar un añadir crea la sección con id de ctx.random, en su lugar, con su versión 1 y su registro', async () => {
    await seedAmendment(ctx, { id: 'a1', kind: 'add', after: 's1', author: { uid: ana, username: 'ana' }, openedAt: OPENED, title: 'Energía', text: 'La energía se comparte.', stances: baseStances() });
    ctx.setNow(LATE);
    await settleAmendment(ctx, 'a1');
    const order = await sectionIds();
    expect(order).toHaveLength(4);
    expect(order.slice(0, 1)).toEqual(['s1']);
    expect(order.slice(2)).toEqual(['s2', 's3']);
    const newId = order[1] as string;
    expect(newId).toMatch(/^[A-Za-z0-9_-]{20}$/);
    expect(await data('amendments/a1')).toMatchObject({ result: 'approved', newSectionId: newId });
    expect(await data(`constitutionSections/${newId}`)).toMatchObject({ title: 'Energía', text: 'La energía se comparte.', isRetired: false });
    expect(await data(`constitutionSections/${newId}/private/meta`)).toMatchObject({ version: 1, proposedByUid: ana, proposedByUsername: 'ana', openAmendment: null });
    expect(await data(`constitutionSections/${newId}/versions/1`)).toMatchObject({ kind: 'add', version: 1, amendmentId: 'a1', agreementsCounted: 3, authorAgreementCounted: true });
    expect(await data('constitutionLog/2')).toMatchObject({ kind: 'added', sectionId: newId, sectionTitle: 'Energía', version: 1 });
    expect(iso((await data('constitution/state'))['updatedAt'])).toBe(CLOSES.toISOString());
  });

  it('RF-13 (004) · 13.2: con referencia nula la sección va al principio', async () => {
    await seedAmendment(ctx, { id: 'a1', kind: 'add', after: null, author: { uid: ana, username: 'ana' }, openedAt: OPENED, stances: baseStances() });
    ctx.setNow(CLOSES);
    await settleAmendment(ctx, 'a1');
    const order = await sectionIds();
    expect(order.slice(1)).toEqual(['s1', 's2', 's3']);
  });

  it('RF-13 (004) · 13.5: caso integrado, si la referencia se retiró antes del cierre va detrás de la vigente anterior más cercana', async () => {
    // s2 y s3 retiradas por propuestas de quitar aprobadas antes; el añadir pide ir detrás de s3
    await seedAmendment(ctx, { id: 'a1', kind: 'add', after: 's3', author: { uid: ana, username: 'ana' }, openedAt: OPENED, title: 'Nueva', text: 'Texto nuevo.', stances: baseStances() });
    await ctx.db.doc('constitutionSections/s3').update({ isRetired: true, retiredAt: OPENED });
    await ctx.db.doc('constitutionSections/s2').update({ isRetired: true, retiredAt: OPENED });
    ctx.setNow(CLOSES);
    await settleAmendment(ctx, 'a1');
    const order = await sectionIds();
    expect(order.slice(0, 2)).toEqual(['s1', order[1]]);
    expect(order[1]).not.toBe('s2');
    expect(order.slice(2)).toEqual(['s2', 's3']);
  });

  it('RF-13 (004) · 13.5: si no queda ninguna vigente antes de la referencia, va al principio', async () => {
    await seedAmendment(ctx, { id: 'a1', kind: 'add', after: 's2', author: { uid: ana, username: 'ana' }, openedAt: OPENED, stances: baseStances() });
    await ctx.db.doc('constitutionSections/s1').update({ isRetired: true, retiredAt: OPENED });
    await ctx.db.doc('constitutionSections/s2').update({ isRetired: true, retiredAt: OPENED });
    ctx.setNow(CLOSES);
    await settleAmendment(ctx, 'a1');
    const order = await sectionIds();
    expect(order.slice(1)).toEqual(['s1', 's2', 's3']);
  });
});
