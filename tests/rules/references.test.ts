// Reglas de Firestore de `apices/{id}/references` tras el retiro de la imagen (RF-27 (021) · 27.4, D-T6 (021)):
// las referencias que ya existían se conservan, pero ningún cliente las lee ni las escribe. Antes las veía quien
// veía el ápice (RF-13 (001), RF-16 (001), sustituidos).
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const ACCOUNTS: Record<string, { role: string; status: string }> = {
  ana: { role: 'member', status: 'active' },
  beto: { role: 'member', status: 'active' },
  fabi: { role: 'facilitator', status: 'active' },
  fran: { role: 'facilitator', status: 'suspended' },
};

/** Visitante, autora, otra persona inscrita y las dos cuentas de facilitación. */
const ACTORS = ['visitor', 'ana', 'beto', 'fabi', 'fran'];
const APICES = ['publico', 'privado', 'archivado'];

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
      await setDoc(doc(db, `accounts/${uid}`), { name: uid, username: uid, ...account });
    }
    const base = { authorUid: 'ana', version: 1, isArchived: false };
    await setDoc(doc(db, 'apices/publico'), { ...base, visibility: 'public' });
    await setDoc(doc(db, 'apices/privado'), { ...base, visibility: 'private' });
    await setDoc(doc(db, 'apices/archivado'), { ...base, visibility: 'public', isArchived: true });
    for (const id of APICES) {
      await setDoc(doc(db, `apices/${id}/references/vigente`), { altText: 'a', isRemoved: false, removal: null });
      await setDoc(doc(db, `apices/${id}/references/quitada`), { altText: 'b', isRemoved: true, removal: { kind: 'removed' } });
    }
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · apices/{id}/references', () => {
  it('RF-27 (021) · 27.4: nadie lee una referencia, vigente o quitada, ni su autora ni la facilitación', async () => {
    for (const actor of ACTORS) {
      for (const id of APICES) {
        await assertFails(getDoc(doc(dbOf(actor), `apices/${id}/references/vigente`)));
        await assertFails(getDoc(doc(dbOf(actor), `apices/${id}/references/quitada`)));
      }
    }
  });

  it('RF-27 (021) · 27.4: nadie lista las referencias, tampoco con el filtro de las vigentes', async () => {
    for (const actor of ACTORS) {
      await assertFails(getDocs(collection(dbOf(actor), 'apices/publico/references')));
      await assertFails(getDocs(query(collection(dbOf(actor), 'apices/publico/references'), where('isRemoved', '==', false))));
    }
  });

  it('RF-27 (021) · 27.4: nadie las escribe ni las borra desde el cliente, y siguen guardadas', async () => {
    for (const actor of ['ana', 'fabi']) {
      const db = dbOf(actor);
      await assertFails(setDoc(doc(db, 'apices/publico/references/nueva'), { isRemoved: false }));
      await assertFails(updateDoc(doc(db, 'apices/publico/references/vigente'), { isRemoved: true }));
      await assertFails(deleteDoc(doc(db, 'apices/publico/references/vigente')));
    }
    await env.withSecurityRulesDisabled(async (context) => {
      const stored = await getDocs(collection(context.firestore(), 'apices/publico/references'));
      expect(stored.docs.map((snap) => snap.id).sort()).toEqual(['quitada', 'vigente']);
    });
  });
});
