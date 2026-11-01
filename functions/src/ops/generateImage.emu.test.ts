// T-6.9 a T-6.12 y T-6.19: generar una imagen propuesta (RF-17 (001), RF-19 (001), RF-20 (001), D-T8 (001)).
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { PALETTE } from '../../../shared/domain/images';
import { createFakeImageModel, type ImageModel } from '../model/imageModel';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf, VALID } from '../testing/apiceKit';
import { countOf, failingModel, gatedModel, sampleImage, until, wait, withModel } from '../testing/generationKit';
import { clearBucket, seedReference } from '../testing/mediaKit';
import { handleCreateApice } from './createApice';
import { handleEditApice } from './editApice';
import { handleGenerateImage } from './generateImage';
import { handleGenerationStatus } from './generationStatus';

let ctx: TestCtx;
let ana: string;
let beto: string;
let id: string;

const DAY = '2026-09-01';
const proposal = async (uid = ana) => (await ctx.db.doc(`proposals/${id}_${uid}`).get()).data();
const gen = async (uid = ana) => (await ctx.db.doc(`generation/${uid}`).get()).data();
const apice = async () => (await ctx.db.doc(`apices/${id}`).get()).data() as Record<string, unknown>;
const userCount = () => countOf(ctx, `generationDays/${ana}_${DAY}`);
const globalCount = () => countOf(ctx, `generationDays/global_${DAY}`);

async function generate(model: ImageModel, uid: string | null = ana) {
  return handleGenerateImage(withModel(ctx, model), { id }, uid);
}

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  id = ((await handleCreateApice(ctx, VALID, ana)) as { id: string }).id;
});

describe('generateImage · producir', () => {
  it('RF-17 (001): sin referencias deja una propuesta de 64 × 64 con solo la paleta, visible para quien la pidió', async () => {
    const model = createFakeImageModel({ image: await sampleImage() });
    expect(await generate(model)).toEqual({});

    const doc = await proposal();
    expect(doc).toMatchObject({ apiceId: id, requestedByUid: ana, baseVersion: 1, baseImageId: null, referenceIds: [] });
    const png = Buffer.from(doc?.['png'] as Uint8Array);
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height]).toEqual([64, 64]);
    const raw = await sharp(png).removeAlpha().raw().toBuffer();
    const palette = new Set(PALETTE.map((c) => c.join(',')));
    for (let i = 0; i < raw.length; i += 3) expect(palette.has(`${raw[i]},${raw[i + 1]},${raw[i + 2]}`)).toBe(true);
    expect(model.requests[0]?.prompt).toContain('Huerta del barrio');
    expect(model.requests[0]?.references).toHaveLength(0);
    // No cambia la imagen del ápice (RF-17 (001)).
    expect((await apice())['image']).toBeNull();
  });

  it('RF-17 (001): la propuesta caduca a las 24 h de pedida', async () => {
    await generate(createFakeImageModel({ image: await sampleImage() }));
    const doc = await proposal();
    expect((doc?.['createdAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-01T15:00:00.000Z');
    expect((doc?.['expiresAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-02T15:00:00.000Z');
  });

  it('RF-17 (001): con referencias las envía al modelo, menos las quitadas', async () => {
    await seedReference(ctx, id, 'r1', { uploader: { uid: ana, username: 'ana' } });
    await seedReference(ctx, id, 'r2', { uploader: { uid: ana, username: 'ana' }, removal: { kind: 'removed', byUsername: 'ana', at: ctx.now(), reason: null } });
    const model = createFakeImageModel({ image: await sampleImage() });
    await generate(model);
    expect(model.requests[0]?.references).toHaveLength(1);
    expect(model.requests[0]?.prompt).toContain('Referencia r1');
    expect(model.requests[0]?.prompt).not.toContain('Referencia r2');
    expect((await proposal())?.['referenceIds']).toEqual(['r1']);
  });

  it('RF-17 (001): una petición nueva reemplaza la propuesta anterior y gasta otra unidad', async () => {
    await generate(createFakeImageModel({ image: await sampleImage() }));
    const first = (await proposal())?.['createdAt'] as { toDate(): Date };
    ctx.setNow(new Date('2026-09-01T16:00:00Z'));
    await generate(createFakeImageModel({ image: await sampleImage() }));
    const docs = await ctx.db.collection('proposals').get();
    expect(docs.size).toBe(1);
    expect(((await proposal())?.['createdAt'] as { toDate(): Date }).toDate().getTime()).toBeGreaterThan(first.toDate().getTime());
    expect(await userCount()).toBe(2);
  });

  it('RF-17 (001): la propuesta guarda la imagen y la versión del ápice al pedirla', async () => {
    await ctx.db.doc(`apices/${id}`).update({ image: { id: 'img9', altText: 'x', png: Buffer.from([1]) } });
    await generate(createFakeImageModel({ image: await sampleImage() }));
    expect((await proposal())?.['baseImageId']).toBe('img9');
  });

  it('RF-19 (001): reserva una unidad por persona y una global, y libera el candado al terminar', async () => {
    await generate(createFakeImageModel({ image: await sampleImage() }));
    expect(await userCount()).toBe(1);
    expect(await globalCount()).toBe(1);
    expect((await gen())?.['lock']).toBeNull();
  });

  it('RF-17 (001): exige sesión, cuenta activa, ápice existente y permiso para editar', async () => {
    const model = createFakeImageModel({ image: await sampleImage() });
    expect(await codeOf(generate(model, null))).toBe('unauthenticated');
    await ctx.db.doc(`accounts/${beto}`).update({ status: 'suspended' });
    expect(await codeOf(generate(model, beto))).toBe('account-suspended');
    expect(await codeOf(handleGenerateImage(withModel(ctx, model), { id: 'no-existe' }, ana))).toBe('invalid-request');
    await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
    expect(await codeOf(generate(model))).toBe('apice-archived');
    expect(model.requests).toHaveLength(0);
    expect(await userCount()).toBeUndefined();
  });
});

describe('generateImage · tope diario', () => {
  it('RF-19 (001): tres aceptadas y la cuarta rechazada, con la hora de reinicio en Colombia', async () => {
    const model = createFakeImageModel({ image: await sampleImage() });
    for (let i = 0; i < 3; i += 1) await generate(model);
    expect(await codeOf(generate(model))).toBe('generation-limit-reached');
    expect(model.requests).toHaveLength(3);
    const status = await handleGenerationStatus(ctx, {}, ana);
    // 2026-09-02 00:00 en Colombia = 05:00 UTC.
    expect(status).toMatchObject({ remaining: 0, limit: 3, resetAt: '2026-09-02T05:00:00.000Z' });
  });

  it('RF-19 (001): al cambiar el día en Colombia vuelve a tener cupo', async () => {
    const model = createFakeImageModel({ image: await sampleImage() });
    for (let i = 0; i < 3; i += 1) await generate(model);
    ctx.setNow(new Date('2026-09-02T05:00:00Z'));
    expect(await generate(model)).toEqual({});
    expect(await countOf(ctx, `generationDays/${ana}_2026-09-02`)).toBe(1);
  });

  it('RF-19 (001), RNF-9 (001): el tope global de 60 rechaza a quien aún tiene cupo personal', async () => {
    await ctx.db.doc(`generationDays/global_${DAY}`).set({ count: 60, expiresAt: new Date('2026-09-05T00:00:00Z') });
    const model = createFakeImageModel({ image: await sampleImage() });
    expect(await codeOf(generate(model))).toBe('generation-global-limit');
    expect(model.requests).toHaveLength(0);
    expect(await userCount()).toBeUndefined();
  });

  it('RF-19 (001): tres peticiones simultáneas con 2 cupos globales: pasan solo 2', async () => {
    const carla = (await seedAccount(ctx, { username: 'carla' })).uid;
    await ctx.db.doc(`generationDays/global_${DAY}`).set({ count: 58, expiresAt: new Date('2026-09-05T00:00:00Z') });
    await ctx.db.doc(`apices/${id}`).update({ visibility: 'public' });
    const model = gatedModel(await sampleImage());
    const settled: string[] = [];
    const run = (uid: string) =>
      handleGenerateImage(withModel(ctx, model), { id }, uid).then(
        () => 'ok',
        (error: { code?: string }) => error.code ?? 'error',
      ).then((r) => {
        settled.push(r);
        return r;
      });
    // Beto y Carla no son autoras: para editar, el ápice debe dejarlas (se les concede por rol facilitador).
    await ctx.db.doc(`accounts/${beto}`).update({ role: 'facilitator' });
    await ctx.db.doc(`accounts/${carla}`).update({ role: 'facilitator' });
    const all = [run(ana), run(beto), run(carla)];
    // Con la tanda completa de emuladores, las tres transacciones compiten y tardan más de 5 s.
    await until(() => model.started() === 2 && settled.length === 1, 20_000);
    model.open();
    const results = await Promise.all(all);
    expect(results.filter((r) => r === 'ok')).toHaveLength(2);
    expect(results.filter((r) => r === 'generation-global-limit')).toHaveLength(1);
    expect(await globalCount()).toBe(60);
  }, 30_000);

  it('RF-17 (001): una persona con una generación en curso no puede lanzar otra', async () => {
    const model = gatedModel(await sampleImage());
    const first = handleGenerateImage(withModel(ctx, model), { id }, ana);
    await until(() => model.started() === 1);
    expect(await codeOf(handleGenerateImage(withModel(ctx, model), { id }, ana))).toBe('generation-in-progress');
    model.open();
    await first;
    expect(await userCount()).toBe(1);
  });
});

describe('generateImage · fallas', () => {
  it.each([
    ['failure', 'generation-failed'],
    ['timeout', 'generation-timeout'],
    ['empty', 'generation-empty'],
    ['rejected', 'generation-rejected'],
  ] as const)('RF-20 (001): la falla `%s` se informa, no cuenta, libera el candado y conserva la imagen', async (kind, code) => {
    await ctx.db.doc(`apices/${id}`).update({ image: { id: 'img1', altText: 'Una huerta', png: Buffer.from([1]) } });
    expect(await codeOf(generate(failingModel(kind)))).toBe(code);
    expect(await userCount()).toBe(0);
    expect(await globalCount()).toBe(0);
    expect((await gen())?.['lock']).toBeNull();
    expect(await proposal()).toBeUndefined();
    expect(((await apice())['image'] as { id: string }).id).toBe('img1');
    // Puede reintentar de inmediato.
    expect(await generate(createFakeImageModel({ image: await sampleImage() }))).toEqual({});
  });

  it('RF-20 (001): un resultado que no es imagen se trata como vacío y no cuenta', async () => {
    const bad = createFakeImageModel({ image: Uint8Array.from([1, 2, 3, 4]) });
    expect(await codeOf(generate(bad))).toBe('generation-empty');
    expect(await userCount()).toBe(0);
  });

  it('RF-20 (001): tres fallas seguidas bloquean 15 minutos y el bloqueo termina', async () => {
    const bad = failingModel('failure');
    for (let i = 0; i < 3; i += 1) expect(await codeOf(generate(bad))).toBe('generation-failed');
    expect(await codeOf(generate(createFakeImageModel({ image: await sampleImage() })))).toBe('generation-blocked');
    const status = (await handleGenerationStatus(ctx, {}, ana)) as { blockedUntil: string | null };
    expect(status.blockedUntil).toBe('2026-09-01T15:15:00.000Z');
    ctx.setNow(new Date('2026-09-01T15:14:59Z'));
    expect(await codeOf(generate(createFakeImageModel({ image: await sampleImage() })))).toBe('generation-blocked');
    ctx.setNow(new Date('2026-09-01T15:15:00Z'));
    expect(await generate(createFakeImageModel({ image: await sampleImage() }))).toEqual({});
  });

  it('RF-20 (001): un éxito entre fallas reinicia la cuenta', async () => {
    const ok = createFakeImageModel({ image: await sampleImage() });
    await codeOf(generate(failingModel('failure')));
    await codeOf(generate(failingModel('failure')));
    await generate(ok);
    expect(await codeOf(generate(failingModel('failure')))).toBe('generation-failed');
    expect(await codeOf(generate(failingModel('failure')))).toBe('generation-failed');
    expect(await generate(ok)).toEqual({});
  });

  it('RF-5 (001): si la cuenta se suspende durante la espera, se descarta y no cuenta', async () => {
    const model: ImageModel = {
      generate: async () => {
        await ctx.db.doc(`accounts/${ana}`).update({ status: 'suspended' });
        return sampleImage();
      },
    };
    expect(await codeOf(generate(model))).toBe('account-suspended');
    expect(await proposal()).toBeUndefined();
    expect(await userCount()).toBe(0);
    expect(await globalCount()).toBe(0);
    expect((await gen())?.['lock']).toBeNull();
  });

  it('RF-14 (001): si el ápice se archiva durante la espera, se descarta y no cuenta', async () => {
    const model: ImageModel = {
      generate: async () => {
        await ctx.db.doc(`apices/${id}`).update({ isArchived: true });
        return sampleImage();
      },
    };
    expect(await codeOf(generate(model))).toBe('apice-archived');
    expect(await proposal()).toBeUndefined();
    expect(await userCount()).toBe(0);
  });
});

describe('generateImage · aislamiento', () => {
  it('RF-20 (001): con el modelo caído, createApice y editApice siguen funcionando', async () => {
    const down: ImageModel = { generate: () => Promise.reject(new Error('el proveedor no responde')) };
    await expect(generate(down)).rejects.toThrow();
    const created = (await handleCreateApice(ctx, { ...VALID, name: 'Otra huerta' }, ana)) as { id: string };
    expect(created.id).toBeTruthy();
    const edited = await handleEditApice(ctx, { id, baseVersion: 1, content: { ...VALID, description: 'Nueva descripción', status: 'idea' } }, ana);
    expect(edited).toMatchObject({ ok: true });
    // Y la reserva se liberó aunque el error no fuera del puerto.
    expect(await userCount()).toBe(0);
    expect((await gen())?.['lock']).toBeNull();
  });

  it('RF-20 (001): un candado vencido más el margen deja generar de nuevo y suelta su reserva', async () => {
    await ctx.db.doc(`generation/${ana}`).set({
      lock: { apiceId: id, startedAt: new Date('2026-09-01T14:50:00Z'), day: DAY },
      consecutiveFailures: 0,
      blockedUntil: null,
    });
    await ctx.db.doc(`generationDays/${ana}_${DAY}`).set({ count: 3, expiresAt: new Date('2026-09-05T00:00:00Z') });
    expect(await generate(createFakeImageModel({ image: await sampleImage() }))).toEqual({});
    expect(await userCount()).toBe(3);
  });

  it('RF-20 (001): un candado reciente sigue cerrando el paso', async () => {
    await ctx.db.doc(`generation/${ana}`).set({
      lock: { apiceId: id, startedAt: new Date('2026-09-01T14:59:30Z'), day: DAY },
      consecutiveFailures: 0,
      blockedUntil: null,
    });
    expect(await codeOf(generate(createFakeImageModel({ image: await sampleImage() })))).toBe('generation-in-progress');
  });
});

describe('generateImage · el día de la petición', () => {
  it('RF-19 (001): pedida a las 23:59 de Colombia y terminada pasada la medianoche cuenta en el día en que se pidió', async () => {
    ctx.setNow(new Date('2026-09-02T04:59:00Z'));
    const slow: ImageModel = {
      generate: async () => {
        ctx.setNow(new Date('2026-09-02T05:01:00Z'));
        await wait(5);
        return sampleImage();
      },
    };
    await generate(slow);
    expect(await countOf(ctx, `generationDays/${ana}_2026-09-01`)).toBe(1);
    expect(await countOf(ctx, `generationDays/global_2026-09-01`)).toBe(1);
    expect(await countOf(ctx, `generationDays/${ana}_2026-09-02`)).toBeUndefined();
  });

  it('RF-19 (001): si esa generación falla, libera el día en que se pidió', async () => {
    ctx.setNow(new Date('2026-09-02T04:59:00Z'));
    const slowFail: ImageModel = {
      generate: async () => {
        ctx.setNow(new Date('2026-09-02T05:01:00Z'));
        throw new Error('cae');
      },
    };
    await expect(generate(slowFail)).rejects.toThrow();
    expect(await countOf(ctx, `generationDays/${ana}_2026-09-01`)).toBe(0);
    expect(await countOf(ctx, `generationDays/${ana}_2026-09-02`)).toBeUndefined();
  });
});
