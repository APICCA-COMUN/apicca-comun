// T-2.8: escritura transaccional del ápice y su versión (RF-12 (001), D-T5 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { createApiceDoc, saveVersion, type StoredContent } from './apiceStore';
import { clearEmulators, createTestCtx, type TestCtx } from './testing';

const ana = { uid: 'uid-ana', username: 'ana' };
const beto = { uid: 'uid-beto', username: 'beto' };

const content = (extra: Partial<StoredContent> = {}): StoredContent => ({
  name: 'Casa del agua',
  description: 'Captar lluvia entre vecinas.',
  axes: ['agua'],
  needs: '',
  offers: '',
  status: 'idea',
  ...extra,
});

let ctx: TestCtx;

const apice = async (id: string) => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const version = async (id: string, n: number) => (await ctx.db.doc(`apices/${id}/versions/${n}`).get()).data();
const toDate = (value: unknown) => (value as { toDate(): Date }).toDate().toISOString();

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
});

describe('apiceStore · crear', () => {
  it('RF-12 (001): crea el ápice privado y no archivado con su versión 1', async () => {
    const { id } = await createApiceDoc(ctx, { content: content(), author: ana });
    expect(await apice(id)).toMatchObject({
      name: 'Casa del agua',
      axes: ['agua'],
      status: 'idea',
      visibility: 'private',
      isArchived: false,
      archive: null,
      authorUid: ana.uid,
      authorUsername: 'ana',
      lastEditedByUsername: 'ana',
      version: 1,
      image: null,
      activeReferenceCount: 0,
    });
    expect(toDate((await apice(id))['createdAt'])).toBe('2026-09-01T15:00:00.000Z');
    expect(await version(id, 1)).toMatchObject({
      n: 1,
      kind: 'create',
      restoredFromN: null,
      savedByUid: ana.uid,
      savedByUsername: 'ana',
      content: content(),
    });
  });

  it('RF-12 (001): dos ápices distintos reciben ids distintos', async () => {
    const a = await createApiceDoc(ctx, { content: content(), author: ana });
    const b = await createApiceDoc(ctx, { content: content(), author: ana });
    expect(a.id).not.toBe(b.id);
  });
});

describe('apiceStore · guardar versión', () => {
  it('RF-12 (001): crea la versión 2 sin tocar la 1 y conserva al autor', async () => {
    const { id } = await createApiceDoc(ctx, { content: content(), author: ana });
    const first = await version(id, 1);
    ctx.setNow(new Date('2026-09-02T10:00:00Z'));
    const result = await saveVersion(ctx, id, {
      baseVersion: 1,
      content: content({ name: 'Casa del agua y la lluvia', status: 'prototipo' }),
      saver: beto,
      kind: 'edit',
    });
    expect(result).toEqual({ ok: true, version: 2 });
    expect(await apice(id)).toMatchObject({
      name: 'Casa del agua y la lluvia',
      status: 'prototipo',
      version: 2,
      authorUid: ana.uid,
      authorUsername: 'ana',
      lastEditedByUsername: 'beto',
      visibility: 'private',
    });
    expect(toDate((await apice(id))['updatedAt'])).toBe('2026-09-02T10:00:00.000Z');
    expect(toDate((await apice(id))['createdAt'])).toBe('2026-09-01T15:00:00.000Z');
    expect(await version(id, 2)).toMatchObject({ n: 2, kind: 'edit', restoredFromN: null, savedByUsername: 'beto' });
    expect(await version(id, 1)).toEqual(first);
  });

  it('RF-12 (001): una restauración guarda su tipo y la versión de origen', async () => {
    const { id } = await createApiceDoc(ctx, { content: content(), author: ana });
    await saveVersion(ctx, id, { baseVersion: 1, content: content({ name: 'Otro' }), saver: ana, kind: 'edit' });
    const result = await saveVersion(ctx, id, {
      baseVersion: 2,
      content: content(),
      saver: beto,
      kind: 'restore',
      restoredFromN: 1,
    });
    expect(result).toEqual({ ok: true, version: 3 });
    expect(await version(id, 3)).toMatchObject({ kind: 'restore', restoredFromN: 1, content: content() });
    expect(await version(id, 2)).toMatchObject({ kind: 'edit' });
  });

  it('RF-11 (001): con una base vieja devuelve el contenido vigente y no escribe nada', async () => {
    const { id } = await createApiceDoc(ctx, { content: content(), author: ana });
    await saveVersion(ctx, id, { baseVersion: 1, content: content({ name: 'De ana' }), saver: ana, kind: 'edit' });
    const result = await saveVersion(ctx, id, { baseVersion: 1, content: content({ name: 'De beto' }), saver: beto, kind: 'edit' });
    expect(result).toEqual({ ok: false, current: { version: 2, content: content({ name: 'De ana' }) } });
    expect((await apice(id))['name']).toBe('De ana');
    expect(await version(id, 3)).toBeUndefined();
  });

  it('RF-11 (001): dos guardados casi simultáneos con la misma base, solo uno gana', async () => {
    const { id } = await createApiceDoc(ctx, { content: content(), author: ana });
    const results = await Promise.all([
      saveVersion(ctx, id, { baseVersion: 1, content: content({ name: 'A' }), saver: ana, kind: 'edit' }),
      saveVersion(ctx, id, { baseVersion: 1, content: content({ name: 'B' }), saver: beto, kind: 'edit' }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect((await apice(id))['version']).toBe(2);
    expect(await version(id, 3)).toBeUndefined();
  });

  it('RF-12 (001): la comprobación de quien llama corre dentro de la transacción y su rechazo no escribe', async () => {
    const { id } = await createApiceDoc(ctx, { content: content(), author: ana });
    const rejected = saveVersion(ctx, id, {
      baseVersion: 1,
      content: content({ name: 'Nuevo' }),
      saver: beto,
      kind: 'edit',
      check: (current) => {
        expect(current.version).toBe(1);
        throw new ApiError('forbidden');
      },
    });
    await expect(rejected).rejects.toMatchObject({ code: 'forbidden' });
    expect((await apice(id))['name']).toBe('Casa del agua');
    expect(await version(id, 2)).toBeUndefined();
  });

  it('RF-12 (001): un ápice inexistente se rechaza', async () => {
    await expect(
      saveVersion(ctx, 'no-existe', { baseVersion: 1, content: content(), saver: ana, kind: 'edit' }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  });
});
