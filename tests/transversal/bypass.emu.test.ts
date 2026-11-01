// T-7.3 · Saltarse la interfaz (RNF-5 (001), RF-5 (001), RF-14 (001), RF-19 (001)): con el SDK desnudo y con
// las ops llamadas sin pasar por ninguna pantalla, lo que la spec prohíbe falla con el error esperado.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../../functions/src/errors';
import { handleArchiveApice } from '../../functions/src/ops/archiveApice';
import { handleCreateApice } from '../../functions/src/ops/createApice';
import { handleEditApice } from '../../functions/src/ops/editApice';
import { handleGenerateImage } from '../../functions/src/ops/generateImage';
import { handleRestoreVersion } from '../../functions/src/ops/restoreVersion';
import { handleSetVisibility } from '../../functions/src/ops/setVisibility';
import { createFakeImageModel } from '../../functions/src/model/imageModel';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../../functions/src/testing';
import { VALID } from '../../functions/src/testing/apiceKit';
import { sampleImage, withModel } from '../../functions/src/testing/generationKit';
import { createTestEnvironment } from '../rules/setup';

let env: RulesTestEnvironment;
let ctx: TestCtx;
const uid: Record<string, string> = {};
let pub: string;
let priv: string;
let archived: string;

const EXACT = { lat: 4.3567891, lng: -74.1234567 };
const content = (patch: Record<string, unknown> = {}) => ({ ...VALID, status: 'idea', ...patch });

const dbOf = (who: string | null) =>
  who === null ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uid[who] as string).firestore();

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return 'sin-error';
}

beforeAll(async () => {
  env = await createTestEnvironment();
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  uid['ana'] = (await seedAccount(ctx, { username: 'ana' })).uid;
  uid['beto'] = (await seedAccount(ctx, { username: 'beto' })).uid;
  uid['fabi'] = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  uid['susi'] = (await seedAccount(ctx, { username: 'susi', status: 'suspended' })).uid;
  uid['gero'] = (await seedAccount(ctx, { username: 'gero' })).uid;
  uid['dora'] = (await seedAccount(ctx, { username: 'dora' })).uid;

  const withExact = { ...VALID, location: { mode: 'set', ...EXACT, precision: 'approximate' } };
  pub = (await handleCreateApice(ctx, withExact, uid['ana'] as string)).id;
  await handleSetVisibility(ctx, { id: pub, visibility: 'public' }, uid['ana'] as string);
  priv = (await handleCreateApice(ctx, VALID, uid['ana'] as string)).id;
  archived = (await handleCreateApice(ctx, VALID, uid['ana'] as string)).id;
  await handleSetVisibility(ctx, { id: archived, visibility: 'public' }, uid['ana'] as string);
  await handleArchiveApice(ctx, { id: archived }, uid['ana'] as string);
}, 60_000);

afterAll(async () => {
  await env.cleanup();
});

describe('saltarse la interfaz · lecturas', () => {
  it('RNF-5 (001): sin sesión no se lee un ápice privado, y un público sí', async () => {
    await assertFails(getDoc(doc(dbOf(null), `apices/${priv}`)));
    await assertSucceeds(getDoc(doc(dbOf(null), `apices/${pub}`)));
  });

  it('RNF-4 (001): el punto exacto solo lo leen su autora y los facilitadores, no otra persona ni un visitante', async () => {
    const exact = `apices/${pub}/versions/1/private/exact`;
    await assertFails(getDoc(doc(dbOf('beto'), exact)));
    await assertFails(getDoc(doc(dbOf('susi'), exact)));
    await assertFails(getDoc(doc(dbOf(null), exact)));
    await assertSucceeds(getDoc(doc(dbOf('ana'), exact)));
    await assertSucceeds(getDoc(doc(dbOf('fabi'), exact)));
  });

  it('RNF-4 (001): lo público del ápice no trae el punto exacto, solo la zona', async () => {
    const stored = (await getDoc(doc(dbOf(null), `apices/${pub}`))).data() as { location: { lat: number; lng: number } };
    expect(stored.location).toEqual({ lat: 4.355, lng: -74.125, precision: 'approximate' });
  });
});

describe('saltarse la interfaz · escrituras y borrados directos', () => {
  const targets = (): Array<[string, Record<string, unknown>]> => [
    [`apices/${pub}`, { name: 'Tomado a la fuerza' }],
    [`apices/${pub}/versions/9`, { n: 9 }],
    [`apices/${pub}/events/falso`, { type: 'visibility' }],
    [`accounts/${uid['beto']}`, { role: 'facilitator' }],
    [`proposals/${pub}_${uid['beto']}`, { requestedByUid: uid['beto'] }],
    [`generationDays/${uid['beto']}_2026-09-01`, { count: 0 }],
    [`usernames/robado`, { uid: uid['beto'] }],
  ];

  it('RNF-5 (001): ni una persona inscrita, ni la autora, ni un facilitador escriben directo', async () => {
    for (const who of ['beto', 'ana', 'fabi']) {
      for (const [path, data] of targets()) {
        await assertFails(setDoc(doc(dbOf(who), path), data));
      }
    }
    await assertFails(updateDoc(doc(dbOf('ana'), `apices/${pub}`), { isArchived: false, visibility: 'private' }));
    await assertFails(updateDoc(doc(dbOf('beto'), `accounts/${uid['beto']}`), { role: 'facilitator', status: 'active' }));
  });

  it('RNF-5 (001): nadie borra directo, ni siquiera la autora', async () => {
    for (const who of ['beto', 'ana', 'fabi']) {
      for (const path of [`apices/${pub}`, `apices/${pub}/versions/1`, `apices/${pub}/events/falso`, `accounts/${uid['ana']}`]) {
        await assertFails(deleteDoc(doc(dbOf(who), path)));
      }
    }
    expect((await ctx.db.doc(`apices/${pub}`).get()).exists).toBe(true);
    expect((await ctx.db.doc(`apices/${pub}/versions/1`).get()).exists).toBe(true);
  });
});

describe('saltarse la interfaz · archivo', () => {
  it('RF-14 (001): editar un ápice archivado falla con apice-archived, también para su autora, y no cambia nada', async () => {
    for (const who of ['ana', 'beto', 'fabi']) {
      expect(await codeOf(handleEditApice(ctx, { id: archived, baseVersion: 1, content: content({ name: 'Nuevo' }) }, uid[who] as string))).toBe(
        'apice-archived',
      );
    }
    expect(await codeOf(handleSetVisibility(ctx, { id: archived, visibility: 'private' }, uid['ana'] as string))).toBe('apice-archived');
    const stored = (await ctx.db.doc(`apices/${archived}`).get()).data();
    expect(stored).toMatchObject({ version: 1, visibility: 'public', isArchived: true });
  });

  it('RF-14 (001): restaurar una versión de un archivado también se rechaza', async () => {
    const code = await codeOf(handleRestoreVersion(ctx, { id: archived, n: 1, baseVersion: 1 }, uid['ana'] as string));
    expect(code).toBe('apice-archived');
  });

  it('RF-14 (001): con el SDK tampoco se edita un archivado', async () => {
    await assertFails(updateDoc(doc(dbOf('ana'), `apices/${archived}`), { name: 'Editado' }));
  });
});

describe('saltarse la interfaz · suspensión', () => {
  it('RF-5 (001): una cuenta suspendida no crea, edita ni genera, y las reglas no le abren lo privado', async () => {
    const susi = uid['susi'] as string;
    expect(await codeOf(handleCreateApice(ctx, VALID, susi))).toBe('account-suspended');
    expect(await codeOf(handleEditApice(ctx, { id: pub, baseVersion: 1, content: content() }, susi))).toBe('account-suspended');
    expect(await codeOf(handleGenerateImage(ctx, { id: pub }, susi))).toBe('account-suspended');
    await assertFails(getDoc(doc(dbOf('susi'), `apices/${priv}`)));
    await assertSucceeds(getDoc(doc(dbOf('susi'), `apices/${pub}`)));
    await assertFails(getDoc(doc(dbOf('susi'), `apices/${pub}/versions/1`)));
  });

  it('RF-5 (001): una suspensión surte efecto en la siguiente llamada, aunque el token siga vigente', async () => {
    const gero = uid['gero'] as string;
    expect(await codeOf(handleEditApice(ctx, { id: pub, baseVersion: 1, content: content({ name: 'Antes' }) }, gero))).toBe('sin-error');
    await ctx.db.doc(`accounts/${gero}`).update({ status: 'suspended' });
    expect(await codeOf(handleEditApice(ctx, { id: pub, baseVersion: 2, content: content({ name: 'Después' }) }, gero))).toBe('account-suspended');
    await assertFails(getDoc(doc(dbOf('gero'), `apices/${priv}`)));
  });
});

describe('saltarse la interfaz · tope diario', () => {
  it('RF-19 (001): la cuarta generación del día se rechaza con generation-limit-reached, llamando la op directamente', async () => {
    const dora = uid['dora'] as string;
    const model = withModel(ctx, createFakeImageModel({ image: await sampleImage() }));
    for (let i = 0; i < 3; i += 1) {
      expect(await codeOf(handleGenerateImage(model, { id: pub }, dora))).toBe('sin-error');
    }
    expect(await codeOf(handleGenerateImage(model, { id: pub }, dora))).toBe('generation-limit-reached');
    expect((await ctx.db.doc(`generationDays/${dora}_2026-09-01`).get()).get('count')).toBe(3);
  }, 60_000);
});
