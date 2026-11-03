// T-2.11 a T-2.14: editar un ápice (RF-7 (001), RF-8 (001), RF-10 (001), RF-11 (001), RF-12 (001)).
// RF-2 (018), D-T7 (018): cupo de ediciones.
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID, withBeforeTransaction } from '../testing/apiceKit';
import { handleCreateApice } from './createApice';
import { handleEditApice } from './editApice';

let ctx: TestCtx;
let ana: string;
let beto: string;
let id: string;

const content = (patch: Record<string, unknown> = {}) => ({ ...VALID, status: 'idea', ...patch });
const edit = (uid: string | null, baseVersion: number, patch: Record<string, unknown> = {}, target = id) =>
  handleEditApice(ctx, { id: target, baseVersion, content: content(patch) }, uid);
const versionOf = async () => (await ctx.db.doc(`apices/${id}`).get()).get('version') as number;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
});

describe('editApice · camino feliz', () => {
  it('RF-12 (001): otra persona inscrita edita, queda la versión 2 y el autor original', async () => {
    ctx.setNow(new Date('2026-09-02T10:00:00Z'));
    const result = await edit(beto, 1, { description: 'Nueva descripción', status: 'prototipo' });
    expect(result).toEqual({ ok: true, version: 2 });
    const doc = (await ctx.db.doc(`apices/${id}`).get()).data();
    expect(doc).toMatchObject({
      description: 'Nueva descripción',
      status: 'prototipo',
      version: 2,
      authorUid: ana,
      authorUsername: 'ana',
      lastEditedByUsername: 'beto',
    });
    const v2 = (await ctx.db.doc(`apices/${id}/versions/2`).get()).data();
    expect(v2).toMatchObject({ n: 2, kind: 'edit', savedByUsername: 'beto' });
    expect((await ctx.db.doc(`apices/${id}/versions/1`).get()).get('content.description')).toBe('Una huerta compartida.');
  });

  it('RF-12 (001): reenviar lo mismo no crea otra versión', async () => {
    await edit(beto, 1, { name: 'Otro nombre' });
    expect(await edit(beto, 2, { name: '  Otro nombre ' })).toEqual({ ok: true, version: 2 });
    expect(await versionOf()).toBe(2);
    expect((await ctx.db.collection(`apices/${id}/versions`).get()).size).toBe(2);
  });

  it('RF-7 (001): una ficha inválida se rechaza sin escribir', async () => {
    expect(await codeOf(edit(beto, 1, { axes: [] }))).toBe('field-required');
    expect(await codeOf(edit(beto, 1, { name: 'x'.repeat(121) }))).toBe('text-too-long');
    expect(await versionOf()).toBe(1);
  });
});

describe('editApice · conflicto', () => {
  it('RF-11 (001): con una base vieja devuelve lo vigente sin escribir, y reenviar con la vigente guarda lo propio', async () => {
    await edit(beto, 1, { name: 'De Beto' });
    const conflict = (await edit(ana, 1, { name: 'De Ana' })) as {
      ok: false;
      conflict: true;
      current: { version: number; content: { name: string } };
    };
    expect(conflict).toMatchObject({ ok: false, conflict: true, current: { version: 2, content: { name: 'De Beto' } } });
    expect(await versionOf()).toBe(2);
    expect(await edit(ana, conflict.current.version, { name: 'De Ana' })).toEqual({ ok: true, version: 3 });
    expect((await ctx.db.doc(`apices/${id}`).get()).get('name')).toBe('De Ana');
  });
});

describe('editApice · rechazos', () => {
  it('RF-10 (001): sin sesión o con cuenta suspendida se rechaza', async () => {
    const susi = (await seedAccount(ctx, { username: 'susi', status: 'suspended' })).uid;
    expect(await codeOf(edit(null, 1))).toBe('unauthenticated');
    expect(await codeOf(edit(susi, 1))).toBe('account-suspended');
  });

  it('RF-5 (001): una cuenta suspendida mientras se guarda se rechaza y no escribe', async () => {
    const hooked = withBeforeTransaction(ctx, async () => {
      await ctx.db.doc(`accounts/${beto}`).update({ status: 'suspended' });
    });
    const result = handleEditApice(hooked, { id, baseVersion: 1, content: content({ name: 'Tarde' }) }, beto);
    expect(await codeOf(result)).toBe('account-suspended');
    expect(await versionOf()).toBe(1);
  });

  it('RF-14 (001): un ápice archivado se rechaza, también si se archiva durante el guardado', async () => {
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    expect(await codeOf(edit(beto, 1))).toBe('apice-archived');
    await ctx.db.doc(`apices/${id}`).update({ isArchived: false });
    const hooked = withBeforeTransaction(ctx, async () => {
      await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    });
    expect(await codeOf(handleEditApice(hooked, { id, baseVersion: 1, content: content({ name: 'Tarde' }) }, beto))).toBe(
      'apice-archived',
    );
    expect(await versionOf()).toBe(1);
  });

  it('RF-10 (001): la visibilidad no viaja en la edición y la vigente se conserva', async () => {
    const hooked = withBeforeTransaction(ctx, async () => {
      await ctx.db.doc(`apices/${id}`).update({ visibility: 'public' });
    });
    await handleEditApice(hooked, { id, baseVersion: 1, content: { ...content({ name: 'Nuevo' }), visibility: 'private' } }, beto);
    expect((await ctx.db.doc(`apices/${id}`).get()).get('visibility')).toBe('public');
  });

  it('RF-10 (001): un id inexistente o un payload mal formado se rechaza', async () => {
    expect(await codeOf(edit(beto, 1, {}, 'no-existe'))).toBe('invalid-request');
    expect(await codeOf(handleEditApice(ctx, { id, baseVersion: 'uno', content: content() }, beto))).toBe('invalid-request');
    expect(await codeOf(handleEditApice(ctx, { id, baseVersion: 1 }, beto))).toBe('invalid-request');
    expect(await codeOf(edit(beto, 1, { status: 'final' }))).toBe('invalid-request');
  });
});

describe('editApice · concurrencia', () => {
  it('RF-11 (001): dos guardados casi simultáneos con la misma base, uno gana y el otro es conflicto', async () => {
    const results = (await Promise.all([edit(ana, 1, { name: 'Uno' }), edit(beto, 1, { name: 'Dos' })])) as Array<{ ok: boolean }>;
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect(await versionOf()).toBe(2);
  }, 20_000);
});

const seedEditQuota = (uid: string, count: number) =>
  ctx.db.doc(`rateLimits/daily-edit-${uid}`).set({ count, windowStart: ctx.now(), expiresAt: new Date(ctx.now().getTime() + 24 * 3600 * 1000) });
const editCount = async (uid: string) => (await ctx.db.doc(`rateLimits/daily-edit-${uid}`).get()).get('count') as number | undefined;

describe('editApice · cupo de ediciones (RF-2 (018))', () => {
  it('RF-2 (018) · 2.1: editar cobra una unidad del cupo diario de ediciones de quien edita', async () => {
    await edit(beto, 1, { name: 'Otro nombre' });
    expect(await editCount(beto)).toBe(1);
    expect(await editCount(ana)).toBeUndefined();
  });

  it('RF-2 (018) · 2.2: con el cupo agotado responde rate-limited y no escribe', async () => {
    await seedEditQuota(beto, 100);
    expect(await codeOf(edit(beto, 1, { name: 'Otro nombre' }))).toBe('rate-limited');
    expect(await versionOf()).toBe(1);
    expect(await editCount(beto)).toBe(100);
  });

  it('RF-2 (018) · 2.3: un conflicto de versión no cobra', async () => {
    await edit(beto, 1, { name: 'Primero' });
    await seedEditQuota(ana, 5);
    expect(await edit(ana, 1, { name: 'Segundo' })).toMatchObject({ ok: false, conflict: true });
    expect(await editCount(ana)).toBe(5);
  });

  it('RF-2 (018) · 2.3: una edición sin cambios no cobra', async () => {
    await edit(beto, 1, { name: 'Otro nombre' });
    await seedEditQuota(beto, 7);
    expect(await edit(beto, 2, { name: '  Otro nombre ' })).toEqual({ ok: true, version: 2 });
    expect(await editCount(beto)).toBe(7);
  });

  it('RF-2 (018) · 2.3: una edición rechazada por permisos no cobra', async () => {
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    expect(await codeOf(edit(beto, 1, { name: 'Tarde' }))).toBe('apice-archived');
    expect(await editCount(beto)).toBeUndefined();
  });
});
