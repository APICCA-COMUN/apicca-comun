// T-4.1 y T-5.6 (004): el utillaje siembra la forma de plan §5 y se relee tal cual (D-T18 (004), Principio 5).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './index';
import { seedAmendment, seedConstitution, seedDocuments, seedSuspendedAccount } from './constitutionKit';

let ctx: TestCtx;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-02T10:00:00Z') });
});

describe('constitutionKit', () => {
  it('D-T18 (004): siembra una constitución abierta con dos secciones y las relee con los campos de plan §5', async () => {
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1', title: 'Uno' }, { id: 's2', title: 'Dos', version: 2 }] });
    const state = (await ctx.db.doc('constitution/state').get()).data() as Record<string, unknown>;
    expect(state).toMatchObject({ isOpen: true, order: ['s1', 's2'], logSeq: 1 });
    expect(Object.keys(state).sort()).toEqual(['isOpen', 'logSeq', 'openedAt', 'order', 'updatedAt']);
    const s2 = (await ctx.db.doc('constitutionSections/s2').get()).data() as Record<string, unknown>;
    expect(s2).toMatchObject({ title: 'Dos', isRetired: false, retiredAt: null });
    expect(Object.keys(s2).sort()).toEqual(['isRetired', 'retiredAt', 'text', 'title', 'updatedAt']);
    const meta = (await ctx.db.doc('constitutionSections/s2/private/meta').get()).data();
    expect(meta).toMatchObject({ version: 2, proposedByUsername: 'texto inicial', openAmendment: null });
    const versions = await ctx.db.collection('constitutionSections/s2/versions').get();
    expect(versions.docs.map((d) => d.id).sort()).toEqual(['1', '2']);
    expect(versions.docs[0]?.data()).toMatchObject({ kind: 'initial', amendmentId: null });
    expect((await ctx.db.doc('constitutionSections/s1/versions/1').get()).get('title')).toBe('Uno');
  });

  it('D-T18 (004): antes de abrir no hay `private/meta` ni versiones y el estado queda cerrado', async () => {
    await seedConstitution(ctx, { sections: [{ id: 's1' }] });
    expect((await ctx.db.doc('constitution/state').get()).data()).toMatchObject({ isOpen: false, openedAt: null, order: ['s1'], logSeq: 0 });
    expect((await ctx.db.doc('constitutionSections/s1/private/meta').get()).exists).toBe(false);
    expect((await ctx.db.collection('constitutionSections/s1/versions').get()).size).toBe(0);
  });

  it('D-T18 (004): siembra tres documentos (uno archivado y uno con dos versiones) y los relee con los campos de plan §5.4', async () => {
    await seedDocuments(ctx, [{ id: 'd1' }, { id: 'd2', isArchived: true }, { id: 'd3', version: 2, title: 'Tres' }]);
    const d3 = (await ctx.db.doc('constitutionDocuments/d3').get()).data() as Record<string, unknown>;
    expect(Object.keys(d3).sort()).toEqual(['createdAt', 'isArchived', 'text', 'title', 'updatedAt', 'version']);
    expect(d3).toMatchObject({ title: 'Tres', version: 2, isArchived: false });
    expect((await ctx.db.doc('constitutionDocuments/d2').get()).get('isArchived')).toBe(true);
    const versions = await ctx.db.collection('constitutionDocuments/d3/versions').get();
    expect(versions.docs.map((d) => d.id).sort()).toEqual(['1', '2']);
    expect(Object.keys(versions.docs[0]?.data() ?? {}).sort()).toEqual(['at', 'byUid', 'byUsername', 'text', 'title', 'version']);
    expect((await ctx.db.collection('constitutionDocuments/d1/versions').get()).size).toBe(1);
  });

  it('D-T18 (004): siembra una propuesta abierta con una revisión, un acuerdo, una objeción abierta, cerradura y una cuenta suspendida, y los relee con los campos de plan §5.5', async () => {
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
    const author = await seedAccount(ctx, { username: 'autora' });
    const agreeing = await seedAccount(ctx, { username: 'acuerda' });
    const objecting = await seedAccount(ctx, { username: 'objeta' });
    const suspended = await seedSuspendedAccount(ctx, { username: 'suspendida' });
    expect((await ctx.db.doc(`accounts/${suspended.uid}`).get()).data()).toMatchObject({ status: 'suspended', username: 'suspendida' });
    const { slotKey } = await seedAmendment(ctx, {
      id: 'a1',
      kind: 'change',
      sectionId: 's1',
      author,
      revisions: [{ title: 'Antes', text: 'Texto antes', motive: 'Motivo antes' }],
      stances: [{ uid: agreeing.uid, username: 'acuerda', agreement: 'active', agreedAtRevision: 1 }],
      objections: [{ id: 'o1', uid: objecting.uid, username: 'objeta', reason: 'No convence' }],
    });
    expect(slotKey).toBe('s:s1');
    const a = (await ctx.db.doc('amendments/a1').get()).data() as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual([
      'after', 'agreementsCounted', 'authorUid', 'authorUsername', 'baseSectionVersion', 'closedAt', 'closesAt', 'eventSeq', 'extended',
      'isOpen', 'kind', 'motive', 'newSectionId', 'objectionsResolved', 'objectionsWithdrawn', 'openedAt', 'reasons', 'result',
      'revisionNo', 'sectionId', 'slotKey', 'text', 'title',
    ]);
    expect(a).toMatchObject({ isOpen: true, result: null, revisionNo: 2, eventSeq: 1, slotKey: 's:s1', authorUid: author.uid, extended: false });
    expect((a['closesAt'] as { toMillis(): number }).toMillis() - (a['openedAt'] as { toMillis(): number }).toMillis()).toBe(360 * 3600 * 1000);
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).data()).toEqual({ amendmentId: 'a1' });
    expect((await ctx.db.doc('amendments/a1/revisions/1').get()).data()).toMatchObject({ title: 'Antes', motive: 'Motivo antes' });
    expect((await ctx.db.doc('amendments/a1/events/1').get()).data()).toMatchObject({ seq: 1, kind: 'opened', uid: author.uid, username: 'autora' });
    expect((await ctx.db.doc(`amendments/a1/stances/${agreeing.uid}`).get()).data()).toMatchObject({
      agreement: 'active', agreedAtRevision: 1, openObjectionId: null, withdrawnReason: null,
    });
    expect((await ctx.db.doc(`amendments/a1/stances/${objecting.uid}`).get()).get('openObjectionId')).toBe('o1');
    expect((await ctx.db.doc(`amendments/a1/stances/${author.uid}`).get()).exists).toBe(false);
    expect((await ctx.db.doc('amendments/a1/objections/o1').get()).data()).toMatchObject({ status: 'open', closedAt: null, resolvedByRevision: null, closedBy: null });
    expect((await ctx.db.doc('constitutionSections/s1/private/meta').get()).get('openAmendment')).toMatchObject({ id: 'a1', kind: 'change' });
  });

  it('D-T18 (004): una propuesta de añadir no marca sección; una cerrada no deja cerradura', async () => {
    const author = await seedAccount(ctx, { username: 'autora' });
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1' }] });
    const added = await seedAmendment(ctx, { id: 'a2', kind: 'add', after: null, author });
    expect(added.slotKey).toBe('a:start');
    expect((await ctx.db.doc('amendmentSlots/a:start').get()).exists).toBe(true);
    expect((await ctx.db.doc('constitutionSections/s1/private/meta').get()).get('openAmendment')).toBeNull();
    await seedAmendment(ctx, { id: 'a3', kind: 'remove', sectionId: 's1', author, isOpen: false, result: 'rejected' });
    expect((await ctx.db.doc('amendmentSlots/s:s1').get()).exists).toBe(false);
    expect((await ctx.db.doc('amendments/a3').get()).data()).toMatchObject({ isOpen: false, result: 'rejected' });
  });
});
