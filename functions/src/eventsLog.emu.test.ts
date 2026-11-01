// T-7.8 (004) · Registro de los hechos de H6 y H7 con quién y cuándo, y nombres de ese momento (RNF-1 (004), D-T16 (004)).
import { describe, expect, it } from 'vitest';
import { settleAmendment } from './amendmentStore';
import { handleAgreeAmendment } from './ops/agreeAmendment';
import { handleObjectAmendment } from './ops/objectAmendment';
import { handleOpenAmendment } from './ops/openAmendment';
import { handleReviseAmendment } from './ops/reviseAmendment';
import { handleWithdrawAmendment } from './ops/withdrawAmendment';
import { clearEmulators, createTestCtx, seedAccount } from './testing';
import { seedConstitution } from './testing/constitutionKit';

const T0 = new Date('2026-10-01T12:00:00Z');

async function events(ctx: ReturnType<typeof createTestCtx>, id: string) {
  return (await ctx.db.collection(`amendments/${id}/events`).orderBy('seq').get()).docs.map((d) => d.data());
}

async function world() {
  await clearEmulators();
  const ctx = createTestCtx({ now: T0 });
  const ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  const beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  const cami = (await seedAccount(ctx, { username: 'cami' })).uid;
  const dani = (await seedAccount(ctx, { username: 'dani' })).uid;
  const eli = (await seedAccount(ctx, { username: 'eli' })).uid;
  await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1', title: 'Agua', text: 'Texto uno.' }, { id: 's2', title: 'Cobijo', text: 'Texto dos.' }] });
  return { ctx, ana, beto, cami, dani, eli };
}

describe('eventsLog', () => {
  it('RNF-1 (004): apertura, revisión, acuerdo, objeción, ampliación y cierre dejan evento con quién y cuándo', async () => {
    const { ctx, ana, beto, cami } = await world();
    const opened = await handleOpenAmendment(ctx, { kind: 'change', sectionId: 's1', title: 'Agua nueva', text: 'Texto nuevo.', motive: 'Porque sí.' }, ana);
    const id = (opened as { id: string }).id;
    ctx.setNow(new Date('2026-10-02T10:00:00Z'));
    await handleReviseAmendment(ctx, { amendmentId: id, baseRevision: 1, title: 'Agua nueva 2', text: 'Texto nuevo 2.', motive: 'Porque sí.' }, ana);
    ctx.setNow(new Date('2026-10-03T10:00:00Z'));
    await handleAgreeAmendment(ctx, { amendmentId: id }, beto);
    ctx.setNow(new Date('2026-10-04T10:00:00Z'));
    await handleObjectAmendment(ctx, { amendmentId: id, reason: 'No me convence.' }, cami);
    ctx.setNow(new Date('2026-10-16T12:00:00Z'));
    await settleAmendment(ctx, id);
    ctx.setNow(new Date('2026-10-31T12:00:00Z'));
    await settleAmendment(ctx, id);
    const list = await events(ctx, id);
    expect(list.map((e) => [e['kind'], e['username']])).toEqual([
      ['opened', 'ana'], ['revised', 'ana'], ['agreed', 'beto'], ['objected', 'cami'], ['extended', 'sistema'], ['closed', 'sistema'],
    ]);
    expect(list.map((e) => (e['at'] as { toDate(): Date }).toDate().toISOString())).toEqual([
      '2026-10-01T12:00:00.000Z', '2026-10-02T10:00:00.000Z', '2026-10-03T10:00:00.000Z', '2026-10-04T10:00:00.000Z',
      '2026-10-16T12:00:00.000Z', '2026-10-31T12:00:00.000Z',
    ]);
    expect(list[0]!['uid']).toBe(ana);
  });

  it('RNF-1 (004): la retirada deja evento con quién y cuándo', async () => {
    const { ctx, ana } = await world();
    const id = ((await handleOpenAmendment(ctx, { kind: 'remove', sectionId: 's2', motive: 'Sobra.' }, ana)) as { id: string }).id;
    ctx.setNow(new Date('2026-10-02T08:00:00Z'));
    await handleWithdrawAmendment(ctx, { amendmentId: id }, ana);
    const list = await events(ctx, id);
    expect(list[1]).toMatchObject({ kind: 'withdrawn', uid: ana, username: 'ana' });
    expect((list[1]!['at'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-10-02T08:00:00.000Z');
  });

  it('RF-3 (004) · 3.5: tras cambiar el nombre de usuario, los eventos, las versiones y el registro conservan el de ese momento', async () => {
    const { ctx, ana, beto, cami } = await world();
    const id = ((await handleOpenAmendment(ctx, { kind: 'change', sectionId: 's1', title: 'Agua nueva', text: 'Texto nuevo.', motive: 'Motivo.' }, ana)) as { id: string }).id;
    await handleAgreeAmendment(ctx, { amendmentId: id }, beto);
    await handleAgreeAmendment(ctx, { amendmentId: id }, cami);
    await ctx.db.doc(`accounts/${ana}`).update({ username: 'ana-nueva' });
    await ctx.db.doc(`accounts/${beto}`).update({ username: 'beto-nuevo' });
    ctx.setNow(new Date('2026-10-16T12:00:00Z'));
    await settleAmendment(ctx, id);
    const list = await events(ctx, id);
    expect(list.slice(0, 3).map((e) => e['username'])).toEqual(['ana', 'beto', 'cami']);
    expect((await ctx.db.doc('constitutionSections/s1/versions/2').get()).get('proposedByUsername')).toBe('ana');
    expect((await ctx.db.doc('constitutionLog/2').get()).get('byUsername')).toBe('ana');
  });
});
