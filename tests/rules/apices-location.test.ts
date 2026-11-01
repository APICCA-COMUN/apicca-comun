// T-4.5 · Reglas de `versions/{n}/private/exact` y privacidad del punto exacto (RF-9 (001), RNF-4 (001)).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const EXACT = { lat: 4.3567891, lng: -74.1234567 };
const ZONE = { lat: 4.355, lng: -74.125, precision: 'approximate' };
const ACCOUNTS: Record<string, { role: string; status: string }> = {
  ana: { role: 'member', status: 'active' },
  beto: { role: 'member', status: 'active' },
  fabi: { role: 'facilitator', status: 'active' },
  fran: { role: 'facilitator', status: 'suspended' },
  susi: { role: 'member', status: 'suspended' },
};

const dbOf = (actor: string) =>
  actor === 'visitor' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(actor).firestore();

beforeAll(async () => {
  env = await createTestEnvironment();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, account] of Object.entries(ACCOUNTS)) {
      await setDoc(doc(db, `accounts/${uid}`), { email: `${uid}@ejemplo.org`, name: uid, username: uid, ...account });
    }
    await setDoc(doc(db, 'apices/a1'), {
      name: 'Huerta',
      visibility: 'public',
      isArchived: false,
      authorUid: 'ana',
      version: 2,
      location: ZONE,
    });
    for (const n of [1, 2]) {
      await setDoc(doc(db, `apices/a1/versions/${n}`), { n, kind: 'edit', location: ZONE });
      await setDoc(doc(db, `apices/a1/versions/${n}/private/exact`), EXACT);
    }
    await setDoc(doc(db, 'apices/a1/events/e1'), { type: 'visibility' });
    await setDoc(doc(db, 'apices/a2'), {
      name: 'Archivada',
      visibility: 'public',
      isArchived: true,
      authorUid: 'ana',
      version: 1,
      location: ZONE,
    });
    await setDoc(doc(db, 'apices/a2/versions/1'), { n: 1, kind: 'create', location: ZONE });
    await setDoc(doc(db, 'apices/a2/versions/1/private/exact'), EXACT);
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · punto exacto', () => {
  it('RF-9 (001): la autora y los facilitadores activos leen el punto exacto de cada versión', async () => {
    for (const actor of ['ana', 'fabi']) {
      for (const n of [1, 2]) await assertSucceeds(getDoc(doc(dbOf(actor), `apices/a1/versions/${n}/private/exact`)));
    }
  });

  it('RF-9 (001): archivado, la autora y los facilitadores lo siguen leyendo', async () => {
    for (const actor of ['ana', 'fabi']) {
      await assertSucceeds(getDoc(doc(dbOf(actor), 'apices/a2/versions/1/private/exact')));
    }
  });

  it('RF-9 (001): otra persona inscrita, cuentas suspendidas y visitantes no lo leen', async () => {
    for (const actor of ['beto', 'susi', 'fran', 'visitor']) {
      await assertFails(getDoc(doc(dbOf(actor), 'apices/a1/versions/1/private/exact')));
      await assertFails(getDoc(doc(dbOf(actor), 'apices/a2/versions/1/private/exact')));
    }
  });

  it('RF-9 (001): ni siquiera la autora o un facilitador lo escriben o lo borran desde el cliente', async () => {
    for (const actor of ['ana', 'fabi', 'beto']) {
      const ref = doc(dbOf(actor), 'apices/a1/versions/1/private/exact');
      await assertFails(setDoc(ref, EXACT));
      await assertFails(deleteDoc(ref));
    }
  });

  it('RF-9 (001): no se lista la subcolección `private` ni el grupo de colecciones sin ser autora o facilitador', async () => {
    await assertFails(getDocs(collection(dbOf('beto'), 'apices/a1/versions/1/private')));
    await assertFails(getDocs(collectionGroup(dbOf('beto'), 'private')));
    await assertFails(getDocs(collectionGroup(dbOf('visitor'), 'private')));
  });

  it('RF-9 (001): un ápice que no existe no deja leer ningún punto', async () => {
    await assertFails(getDoc(doc(dbOf('fabi'), 'apices/fantasma/versions/1/private/exact')));
  });
});

describe('firestore.rules · privacidad del punto exacto', () => {
  it('RF-9 (001): quien no es autora ni facilitador lee el ápice, todas sus versiones y sus eventos sin hallar el punto exacto', async () => {
    const readable: string[] = [];
    for (const actor of ['beto', 'visitor']) {
      const db = dbOf(actor);
      const paths = ['apices/a1', ...(actor === 'visitor' ? [] : ['apices/a1/versions/1', 'apices/a1/versions/2', 'apices/a1/events/e1'])];
      for (const path of paths) {
        const snap = await assertSucceeds(getDoc(doc(db, path)));
        readable.push(JSON.stringify(snap.data()));
      }
    }
    expect(readable.length).toBeGreaterThan(4);
    expect(readable.filter((text) => text.includes('"lat":4.355')).length).toBeGreaterThan(3);
    for (const text of readable) {
      expect(text).not.toContain('4.3567891');
      expect(text).not.toContain('74.1234567');
    }
  });
});
