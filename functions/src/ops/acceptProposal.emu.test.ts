// T-6.14 a T-6.16: aceptar o descartar una propuesta de imagen (RF-18 (001), RF-17 (001), RF-16 (001), D-T19 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { seedReference, clearBucket } from '../testing/mediaKit';
import { handleAcceptProposal } from './acceptProposal';
import { handleCreateApice } from './createApice';
import { handleDiscardProposal } from './discardProposal';
import { handleEditApice } from './editApice';
import { handleRemoveReference } from './removeReference';

let ctx: TestCtx;
let ana: string;
let beto: string;
let id: string;

const PNG_A = Buffer.from([1, 1, 1]);
const PNG_B = Buffer.from([2, 2, 2]);

const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as { image: { id: string; altText: string; png: Buffer } | null; version: number };
const proposalOf = async (uid: string) => (await ctx.db.doc(`proposals/${id}_${uid}`).get()).data();
const events = async () => (await ctx.db.collection(`apices/${id}/events`).orderBy('at').get()).docs.map((d) => d.data());

async function seedProposal(uid: string, png: Buffer, extra: Record<string, unknown> = {}, createdAt = ctx.now()): Promise<void> {
  const a = await apice();
  await ctx.db.doc(`proposals/${id}_${uid}`).set({
    apiceId: id,
    requestedByUid: uid,
    png,
    referenceIds: [],
    baseVersion: a.version,
    baseImageId: a.image?.id ?? null,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 24 * 3600 * 1000),
    ...extra,
  });
}

const accept = (uid: string | null, extra: Record<string, unknown> = {}) =>
  handleAcceptProposal(ctx, { id, altText: 'Una huerta en pixeles', ...extra }, uid);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto', role: 'facilitator' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
  await ctx.db.doc(`apices/${id}`).update({ visibility: 'public' });
});

describe('acceptProposal', () => {
  it('RF-18 (001): con texto alternativo, la propuesta pasa a ser la imagen del ápice, con quién y cuándo', async () => {
    await seedProposal(ana, PNG_A);
    ctx.setNow(new Date('2026-09-01T16:00:00Z'));
    expect(await accept(ana)).toEqual({ ok: true });

    const a = await apice();
    expect(a.image).toMatchObject({ altText: 'Una huerta en pixeles' });
    expect(Buffer.from(a.image?.png as Uint8Array)).toEqual(PNG_A);
    const image = (await ctx.db.doc(`apices/${id}/images/${a.image?.id}`).get()).data();
    expect(image).toMatchObject({ altText: 'Una huerta en pixeles', acceptedByUsername: 'ana', isRemoved: false, replacedAt: null });
    expect((image?.['acceptedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-01T16:00:00.000Z');
    expect(await proposalOf(ana)).toBeUndefined();
    expect(await events()).toEqual([expect.objectContaining({ type: 'image-accepted', byUsername: 'ana', detail: { imageId: a.image?.id } })]);
    // La imagen no es contenido: no cambia la versión.
    expect(a.version).toBe(1);
  });

  it('RF-18 (001): aceptar dos veces seguidas conserva la primera imagen en `images/`', async () => {
    await seedProposal(ana, PNG_A);
    await accept(ana);
    const first = (await apice()).image?.id as string;
    await seedProposal(ana, PNG_B);
    await accept(ana);
    const second = (await apice()).image?.id as string;
    expect(second).not.toBe(first);
    const old = (await ctx.db.doc(`apices/${id}/images/${first}`).get()).data();
    expect(Buffer.from(old?.['png'] as Uint8Array)).toEqual(PNG_A);
    expect(old?.['replacedAt']).not.toBeNull();
    expect((await ctx.db.collection(`apices/${id}/images`).get()).size).toBe(2);
  });

  it('RF-18 (001): exige texto alternativo de 1 a 200 caracteres', async () => {
    await seedProposal(ana, PNG_A);
    expect(await codeOf(accept(ana, { altText: '   ' }))).toBe('alt-text-required');
    expect(await codeOf(accept(ana, { altText: 'x'.repeat(201) }))).toBe('alt-text-too-long');
    expect((await apice()).image).toBeNull();
    expect(await proposalOf(ana)).toBeDefined();
  });

  it('RF-17 (001): una propuesta ajena no se puede aceptar (no hay propuesta propia)', async () => {
    await seedProposal(beto, PNG_B);
    expect(await codeOf(accept(ana))).toBe('proposal-not-found');
    expect((await apice()).image).toBeNull();
    expect(await proposalOf(beto)).toBeDefined();
  });

  it('RF-17 (001): una propuesta caducada se rechaza desde las 24 h exactas', async () => {
    await seedProposal(ana, PNG_A);
    ctx.setNow(new Date('2026-09-02T14:59:59Z'));
    expect(await accept(ana)).toEqual({ ok: true });
    await seedProposal(ana, PNG_B, {}, new Date('2026-09-01T15:00:00Z'));
    ctx.setNow(new Date('2026-09-02T15:00:00Z'));
    expect(await codeOf(accept(ana))).toBe('proposal-expired');
  });

  it('RF-18 (001): sin sesión, suspendida o con el ápice archivado se rechaza', async () => {
    await seedProposal(ana, PNG_A);
    expect(await codeOf(accept(null))).toBe('unauthenticated');
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    expect(await codeOf(accept(ana))).toBe('apice-archived');
    await ctx.db.doc(`apices/${id}`).update({ isArchived: false });
    await ctx.db.doc(`accounts/${ana}`).update({ status: 'suspended' });
    expect(await codeOf(accept(ana))).toBe('account-suspended');
  });
});

describe('acceptProposal · propuesta vieja', () => {
  it('RF-18 (001): si el contenido cambió avisa y no hace nada hasta confirmar', async () => {
    await seedProposal(ana, PNG_A);
    await handleEditApice(ctx, { id, baseVersion: 1, content: { ...VALID, description: 'Otra descripción', status: 'idea' } }, beto);
    expect(await accept(ana)).toEqual({ ok: false, warnings: ['content-changed'] });
    expect((await apice()).image).toBeNull();
    expect(await proposalOf(ana)).toBeDefined();
    expect(await accept(ana, { confirm: true })).toEqual({ ok: true });
    expect((await apice()).image).not.toBeNull();
  });

  it('RF-16 (001): si usó una referencia que luego se quitó avisa y pide confirmar', async () => {
    await seedReference(ctx, id, 'r1', { uploader: { uid: ana, username: 'ana' } });
    await seedProposal(ana, PNG_A, { referenceIds: ['r1'] });
    await handleRemoveReference(ctx, { id, refId: 'r1' }, ana);
    expect(await accept(ana)).toEqual({ ok: false, warnings: ['reference-removed'] });
    expect(await accept(ana, { confirm: true })).toEqual({ ok: true });
  });

  it('RF-18 (001): si la imagen del ápice cambió avisa', async () => {
    await seedProposal(ana, PNG_A);
    await ctx.db.doc(`apices/${id}`).update({ image: { id: 'otra', altText: 'x', png: PNG_B } });
    expect(await accept(ana)).toEqual({ ok: false, warnings: ['image-changed'] });
  });

  it('RF-18 (001): dos personas aceptan a la vez propuestas distintas: una sola establece la imagen y la otra recibe el aviso', async () => {
    await seedProposal(ana, PNG_A);
    await seedProposal(beto, PNG_B);
    const [a, b] = await Promise.all([accept(ana), accept(beto)]);
    const results = [a, b] as { ok: boolean; warnings?: string[] }[];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)?.warnings).toEqual(['image-changed']);
    expect((await ctx.db.collection(`apices/${id}/images`).get()).size).toBe(1);
  });
});

describe('discardProposal', () => {
  it('RF-18 (001): descartar elimina la propuesta y conserva la imagen del ápice', async () => {
    await ctx.db.doc(`apices/${id}`).update({ image: { id: 'img1', altText: 'x', png: PNG_A } });
    await seedProposal(ana, PNG_B);
    expect(await handleDiscardProposal(ctx, { id }, ana)).toEqual({});
    expect(await proposalOf(ana)).toBeUndefined();
    expect((await apice()).image?.id).toBe('img1');
  });

  it('RF-18 (001): solo toca la propia y repetirlo no falla', async () => {
    await seedProposal(beto, PNG_B);
    expect(await handleDiscardProposal(ctx, { id }, ana)).toEqual({});
    expect(await proposalOf(beto)).toBeDefined();
    expect(await codeOf(handleDiscardProposal(ctx, { id }, null))).toBe('unauthenticated');
  });
});
