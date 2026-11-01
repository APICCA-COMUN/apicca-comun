// T-5.3 · Reglas de Firestore de `apices/{id}/references`: las ve quien ve el ápice si no están quitadas;
// las quitadas, solo los facilitadores; nadie escribe desde el cliente (D-T1 (001)).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const ACCOUNTS: Record<string, { role: string; status: string }> = {
  ana: { role: 'member', status: 'active' },
  beto: { role: 'member', status: 'active' },
  fabi: { role: 'facilitator', status: 'active' },
  fran: { role: 'facilitator', status: 'suspended' },
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
      await setDoc(doc(db, `accounts/${uid}`), { name: uid, username: uid, ...account });
    }
    const base = { authorUid: 'ana', version: 1, isArchived: false };
    await setDoc(doc(db, 'apices/publico'), { ...base, visibility: 'public' });
    await setDoc(doc(db, 'apices/privado'), { ...base, visibility: 'private' });
    await setDoc(doc(db, 'apices/archivado'), { ...base, visibility: 'public', isArchived: true });
    for (const id of ['publico', 'privado', 'archivado']) {
      await setDoc(doc(db, `apices/${id}/references/vigente`), { altText: 'a', isRemoved: false, removal: null });
      await setDoc(doc(db, `apices/${id}/references/quitada`), { altText: 'b', isRemoved: true, removal: { kind: 'removed' } });
    }
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · apices/{id}/references', () => {
  it('RF-13 (001): ápice público: un visitante lee la referencia vigente', async () => {
    await assertSucceeds(getDoc(doc(dbOf('visitor'), 'apices/publico/references/vigente')));
  });

  it('RF-13 (001): ápice privado: el visitante no la lee y una cuenta activa sí', async () => {
    await assertFails(getDoc(doc(dbOf('visitor'), 'apices/privado/references/vigente')));
    await assertSucceeds(getDoc(doc(dbOf('beto'), 'apices/privado/references/vigente')));
    await assertFails(getDoc(doc(dbOf('fran'), 'apices/privado/references/vigente')));
  });

  it('RF-13 (001): ápice archivado: solo su autora y los facilitadores leen la referencia', async () => {
    await assertFails(getDoc(doc(dbOf('visitor'), 'apices/archivado/references/vigente')));
    await assertFails(getDoc(doc(dbOf('beto'), 'apices/archivado/references/vigente')));
    await assertSucceeds(getDoc(doc(dbOf('ana'), 'apices/archivado/references/vigente')));
    await assertSucceeds(getDoc(doc(dbOf('fabi'), 'apices/archivado/references/vigente')));
  });

  it('RF-16 (001): una referencia quitada solo la lee un facilitador activo', async () => {
    const path = 'apices/publico/references/quitada';
    await assertFails(getDoc(doc(dbOf('visitor'), path)));
    await assertFails(getDoc(doc(dbOf('ana'), path)));
    await assertFails(getDoc(doc(dbOf('fran'), path)));
    await assertSucceeds(getDoc(doc(dbOf('fabi'), path)));
  });

  it('RF-16 (001): la lista de referencias vigentes se consulta con el filtro isRemoved, las quitadas solo las ve un facilitador', async () => {
    const vigentes = query(collection(dbOf('beto'), 'apices/publico/references'), where('isRemoved', '==', false));
    await assertSucceeds(getDocs(vigentes));
    await assertFails(getDocs(collection(dbOf('beto'), 'apices/publico/references')));
    await assertSucceeds(getDocs(collection(dbOf('fabi'), 'apices/publico/references')));
  });

  it('RF-16 (001): ninguna persona escribe referencias desde el cliente, ni un facilitador', async () => {
    for (const actor of ['ana', 'fabi']) {
      const db = dbOf(actor);
      await assertFails(setDoc(doc(db, 'apices/publico/references/nueva'), { isRemoved: false }));
      await assertFails(updateDoc(doc(db, 'apices/publico/references/vigente'), { isRemoved: true }));
      await assertFails(deleteDoc(doc(db, 'apices/publico/references/vigente')));
    }
  });
});
