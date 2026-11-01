// T-5.10: limpieza de temporales de uploads/ (D-T9 (001), RNF-7 (001)).
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, type TestCtx } from './testing';
import { clearBucket, listPaths, png, putFile } from './testing/mediaKit';
import { sweepUploads } from './storageSweep';

const HOUR = 3_600_000;
let ctx: TestCtx;

/** Instante en que el emulador creó el archivo. */
const createdAt = async (path: string): Promise<number> => {
  const [meta] = await ctx.storage.bucket().file(path).getMetadata();
  return new Date(meta.timeCreated as string).getTime();
};

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx();
  await clearBucket(ctx);
});

describe('storageSweep', () => {
  it('RNF-7 (001): borra un temporal de 25 h y no toca references/', async () => {
    await putFile(ctx, 'uploads/uid-1/viejo', await png());
    await putFile(ctx, 'apices/a1/references/r1', await png());
    ctx.setNow(new Date((await createdAt('uploads/uid-1/viejo')) + 25 * HOUR));
    expect(await sweepUploads(ctx)).toBe(1);
    expect(await listPaths(ctx, 'uploads/')).toEqual([]);
    expect(await listPaths(ctx, 'apices/')).toEqual(['apices/a1/references/r1']);
  });

  it('RNF-7 (001): conserva un temporal de 23 h', async () => {
    await putFile(ctx, 'uploads/uid-1/reciente', await png());
    ctx.setNow(new Date((await createdAt('uploads/uid-1/reciente')) + 23 * HOUR));
    expect(await sweepUploads(ctx)).toBe(0);
    expect(await listPaths(ctx, 'uploads/')).toEqual(['uploads/uid-1/reciente']);
  });

  it('RNF-7 (001): sin temporales no hace nada', async () => {
    expect(await sweepUploads(ctx)).toBe(0);
  });
});
