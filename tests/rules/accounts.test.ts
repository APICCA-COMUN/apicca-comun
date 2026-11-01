// T-1.11 · Reglas de accounts/{uid}: lee la propia persona (aun suspendida) y los facilitadores activos.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const account = (over: Record<string, unknown> = {}) => ({
  email: 'x@ejemplo.org',
  name: 'Nombre Real',
  username: 'x',
  role: 'member',
  status: 'active',
  ...over,
});

beforeAll(async () => {
  env = await createTestEnvironment();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'accounts/ana'), account({ username: 'ana' }));
    await setDoc(doc(db, 'accounts/beto'), account({ username: 'beto' }));
    await setDoc(doc(db, 'accounts/susi'), account({ username: 'susi', status: 'suspended' }));
    await setDoc(doc(db, 'accounts/fabi'), account({ username: 'fabi', role: 'facilitator' }));
    await setDoc(doc(db, 'accounts/fede'), account({ username: 'fede', role: 'facilitator', status: 'suspended' }));
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · accounts', () => {
  it('RNF-4 (001): la propia persona lee su cuenta y otra persona no', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('ana').firestore(), 'accounts/ana')));
    await assertFails(getDoc(doc(env.authenticatedContext('beto').firestore(), 'accounts/ana')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'accounts/ana')));
  });

  it('RF-5 (001): una cuenta suspendida lee la suya y nada más', async () => {
    const susi = env.authenticatedContext('susi').firestore();
    await assertSucceeds(getDoc(doc(susi, 'accounts/susi')));
    await assertFails(getDoc(doc(susi, 'accounts/ana')));
  });

  it('RNF-4 (001): un facilitador activo lee cualquier cuenta y uno suspendido no', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('fabi').firestore(), 'accounts/ana')));
    await assertFails(getDoc(doc(env.authenticatedContext('fede').firestore(), 'accounts/ana')));
  });

  it('RNF-4 (001): quien tiene sesión pero no cuenta no lee nada', async () => {
    await assertFails(getDoc(doc(env.authenticatedContext('fantasma').firestore(), 'accounts/ana')));
  });

  it('RNF-7 (001): toda escritura y todo borrado del cliente se deniegan, también a facilitadores', async () => {
    for (const uid of ['ana', 'susi', 'fabi']) {
      const db = env.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, `accounts/${uid}`), account()));
      await assertFails(updateDoc(doc(db, `accounts/${uid}`), { role: 'facilitator' }));
      await assertFails(deleteDoc(doc(db, `accounts/${uid}`)));
    }
    await assertFails(setDoc(doc(env.authenticatedContext('nueva').firestore(), 'accounts/nueva'), account()));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'accounts/otra'), account()));
  });
});
