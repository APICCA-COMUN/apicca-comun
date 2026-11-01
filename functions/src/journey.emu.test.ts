// T-7.1 · Recorrido de punta a punta del criterio de finalización de la spec (§8): una facilitadora invita,
// dos personas se registran, una crea un ápice, la otra lo co-edita y se resuelve un conflicto, se genera (con el
// modelo doble) y se acepta una imagen, se ubica, se hace público y un visitante lo halla por eje, leyendo con las
// reglas reales. Las ops se llaman como las llama la callable: payload plano y uid.
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listQueryShape, NO_FILTERS } from '../../shared/domain/discovery';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeImageModel } from './model/imageModel';
import { handleAcceptProposal } from './ops/acceptProposal';
import { handleCreateApice } from './ops/createApice';
import { handleEditApice } from './ops/editApice';
import { handleGenerateImage } from './ops/generateImage';
import { handleInvite } from './ops/invite';
import { handleRegister } from './ops/register';
import { handleSetVisibility } from './ops/setVisibility';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from './testing';
import { withModel, sampleImage } from './testing/generationKit';
import { clearBucket } from './testing/mediaKit';

let ctx: TestCtx;
let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host = '127.0.0.1', port = '8080'] = (process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-apicca',
    firestore: { host, port: Number(port), rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  await clearBucket(ctx);
});

/** Invita por correo y devuelve el token del enlace `/registro/<token>`. */
async function inviteAndRegister(facilitator: string, email: string, username: string): Promise<string> {
  const { link } = (await handleInvite(ctx, { email }, facilitator)) as { link: string };
  const token = link.replace('/registro/', '');
  const { uid } = (await handleRegister(ctx, { token, password: 'una-clave-larga', name: username, username }, null)) as { uid: string };
  return uid;
}

describe('recorrido de la spec 001', () => {
  it('RF-1 (001): invitar, registrar, crear, co-editar con conflicto, generar y aceptar, ubicar, publicar y hallarlo por eje', async () => {
    const facilitator = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;

    // Invitar y registrar a dos personas (RF-1 (001), RF-2 (001)).
    const ana = await inviteAndRegister(facilitator, 'ana@ejemplo.org', 'ana');
    const beto = await inviteAndRegister(facilitator, 'beto@ejemplo.org', 'beto');
    expect((await ctx.db.doc(`accounts/${ana}`).get()).data()).toMatchObject({ username: 'ana', role: 'member', status: 'active' });

    // Ana crea el ápice (RF-6 (001), RF-7 (001)).
    const { id } = (await handleCreateApice(
      ctx,
      { name: 'Huerta del barrio', description: 'Una huerta compartida.', axes: ['alimento'], needs: '', offers: '' },
      ana,
    )) as { id: string };
    const content = (patch: Record<string, unknown> = {}) => ({
      name: 'Huerta del barrio',
      description: 'Una huerta compartida.',
      axes: ['alimento'],
      needs: '',
      offers: '',
      status: 'idea',
      ...patch,
    });

    // Beto co-edita; Ana, con la base vieja, recibe el conflicto y reenvía sobre lo vigente (RF-10 (001), RF-11 (001), RF-12 (001)).
    expect(await handleEditApice(ctx, { id, baseVersion: 1, content: content({ needs: 'Semillas' }) }, beto)).toEqual({ ok: true, version: 2 });
    const conflict = await handleEditApice(ctx, { id, baseVersion: 1, content: content({ offers: 'Un terreno' }) }, ana);
    expect(conflict).toMatchObject({ ok: false, conflict: true, current: { version: 2 } });
    expect(await handleEditApice(ctx, { id, baseVersion: 2, content: content({ needs: 'Semillas', offers: 'Un terreno' }) }, ana)).toEqual({
      ok: true,
      version: 3,
    });

    // Se genera con el modelo doble y se acepta la imagen (RF-17 (001), RF-18 (001)).
    const model = createFakeImageModel({ image: await sampleImage() });
    expect(await handleGenerateImage(withModel(ctx, model), { id }, ana)).toEqual({});
    expect(await handleAcceptProposal(ctx, { id, altText: 'Una huerta en pixeles' }, ana)).toEqual({ ok: true });
    expect((await ctx.db.doc(`apices/${id}`).get()).get('image')).toMatchObject({ altText: 'Una huerta en pixeles' });

    // Se ubica con la forma que manda la interfaz: `location` junto a `content` (RF-9 (001)).
    expect(
      await handleEditApice(
        ctx,
        { id, baseVersion: 3, content: content({ needs: 'Semillas', offers: 'Un terreno' }), location: { mode: 'set', lat: 4.60971, lng: -74.08175, precision: 'approximate' } },
        ana,
      ),
    ).toEqual({ ok: true, version: 4 });
    const located = (await ctx.db.doc(`apices/${id}`).get()).data();
    expect(located?.['location']).toMatchObject({ precision: 'approximate' });
    expect(located?.['location']).not.toMatchObject({ lat: 4.60971 });

    // Antes de publicarlo, el visitante no lo ve (RF-13 (001)).
    const visitor = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(visitor, `apices/${id}`)));

    // Se hace público y el visitante lo halla por eje, leyendo con las reglas (RF-13 (001), RF-21 (001)).
    expect(await handleSetVisibility(ctx, { id, visibility: 'public' }, ana)).toEqual({});
    const shape = listQueryShape({ audience: 'visitor', filters: { axes: ['alimento'], status: null } });
    expect(shape.conditions.map((c) => c.field)).toEqual(['visibility', 'isArchived', 'axes']);
    const found = await assertSucceeds(
      getDocs(
        query(
          collection(visitor, 'apices'),
          where('visibility', '==', 'public'),
          where('isArchived', '==', false),
          where('axes', 'array-contains-any', ['alimento']),
          orderBy('updatedAt', 'desc'),
          limit(shape.limit),
        ),
      ),
    );
    expect(found.docs.map((d) => d.id)).toEqual([id]);
    expect(found.docs[0]?.data()['name']).toBe('Huerta del barrio');

    // Por otro eje no aparece, y el punto exacto sigue fuera de su alcance (RF-9 (001)).
    const other = await getDocs(
      query(collection(visitor, 'apices'), where('visibility', '==', 'public'), where('isArchived', '==', false), where('axes', 'array-contains-any', ['agua'])),
    );
    expect(other.empty).toBe(true);
    await assertFails(getDoc(doc(visitor, `apices/${id}/versions/4/private/exact`)));
    expect(NO_FILTERS.axes).toEqual([]);
  });
});
