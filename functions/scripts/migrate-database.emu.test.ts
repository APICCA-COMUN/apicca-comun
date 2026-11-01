// RF-4 (006), RF-5 (006), RNF-1 (006): la copia de una base de Firestore a otra, contra los emuladores.
import { getApps, initializeApp, getApp } from 'firebase-admin/app';
import { GeoPoint, getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_PROJECT_ID } from '../src/testing';
import { migrateDatabase } from './migrate-database';

const APP_NAME = 'apicca-migrate-test';
const app = getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp({ projectId: TEST_PROJECT_ID }, APP_NAME);
const source: Firestore = getFirestore(app, 'origen');
const target: Firestore = getFirestore(app, 'destino');

async function wipe(db: Firestore): Promise<void> {
  for (const collection of await db.listCollections()) await db.recursiveDelete(collection);
}

async function seed(): Promise<void> {
  await source.doc('accounts/u1').set({ name: 'Ana', createdAt: Timestamp.fromMillis(1_700_000_000_000), tags: ['a', 'b'] });
  await source.doc('apices/a1').set({ name: 'Huerta', where: new GeoPoint(5.2, -73.2), png: Buffer.from([1, 2, 3]) });
  await source.doc('apices/a1/versions/v1').set({ version: 1, content: { name: 'Huerta' } });
  await source.doc('apices/a1/references/r1').set({ isRemoved: false });
  await source.doc('usernames/ana').set({ uid: 'u1' });
}

describe('migrate-database', () => {
  beforeEach(async () => {
    await wipe(source);
    await wipe(target);
  });
  afterEach(async () => {
    await wipe(source);
    await wipe(target);
  });

  it('RF-4 (006): copia documentos y subcolecciones con los mismos ids y valores, incluidos fechas, puntos y bytes', async () => {
    await seed();
    const report = await migrateDatabase({ source, target }, { dryRun: false });
    expect(report).toMatchObject({ documents: 5, copied: 5, skipped: 0, conflicts: [], missing: [] });
    for (const path of ['accounts/u1', 'apices/a1', 'apices/a1/versions/v1', 'apices/a1/references/r1', 'usernames/ana']) {
      expect((await target.doc(path).get()).data()).toEqual((await source.doc(path).get()).data());
    }
    expect((await target.doc('apices/a1').get()).get('png')).toBeInstanceOf(Buffer);
  });

  it('RF-4 (006): con --dry-run cuenta y no escribe nada', async () => {
    await seed();
    const report = await migrateDatabase({ source, target }, { dryRun: true });
    expect(report).toMatchObject({ documents: 5, copied: 0, conflicts: [], missing: [] });
    expect(await target.listCollections()).toHaveLength(0);
  });

  it('RF-4 (006): repetirla es idempotente: lo idéntico se omite', async () => {
    await seed();
    await migrateDatabase({ source, target }, { dryRun: false });
    const again = await migrateDatabase({ source, target }, { dryRun: false });
    expect(again).toMatchObject({ documents: 5, copied: 0, skipped: 5, conflicts: [], missing: [] });
  });

  it('RF-5 (006): si el destino ya tiene un documento distinto en esa ruta, se detiene sin escribir y lo lista', async () => {
    await seed();
    await target.doc('accounts/u1').set({ name: 'Otra persona' });
    const report = await migrateDatabase({ source, target }, { dryRun: false });
    expect(report.conflicts).toEqual(['accounts/u1']);
    expect(report.copied).toBe(0);
    expect((await target.doc('usernames/ana').get()).exists).toBe(false);
    expect((await target.doc('accounts/u1').get()).data()).toEqual({ name: 'Otra persona' });
  });

  it('RNF-1 (006): no toca colecciones del destino que el origen no tiene', async () => {
    await seed();
    await target.doc('resets/x').set({ keep: true });
    await migrateDatabase({ source, target }, { dryRun: false });
    expect((await target.doc('resets/x').get()).data()).toEqual({ keep: true });
  });
});
