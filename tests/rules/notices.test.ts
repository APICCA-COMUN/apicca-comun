// T-2 (012) · Reglas de notices/{uid}/items/{id}: lee solo su dueña con cuenta activa; nadie escribe (RF-6 (012)).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;
const account = (username: string, status = 'active') => ({ email: `${username}@x.org`, name: username, username, role: 'member', status });

beforeAll(async () => {
  env = await createTestEnvironment();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'accounts/ana'), account('ana'));
    await setDoc(doc(db, 'accounts/beto'), account('beto'));
    await setDoc(doc(db, 'accounts/susi'), account('susi', 'suspended'));
    await setDoc(doc(db, 'notices/ana/items/n1'), { type: 'apice-editado' });
    await setDoc(doc(db, 'notices/susi/items/n1'), { type: 'apice-editado' });
  });
});
afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · notices', () => {
  it('RF-6 (012): la dueña con cuenta activa lee sus avisos', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('ana').firestore(), 'notices/ana/items/n1')));
  });

  it('RF-6 (012): otra cuenta, una suspendida y un visitante no los leen', async () => {
    await assertFails(getDoc(doc(env.authenticatedContext('beto').firestore(), 'notices/ana/items/n1')));
    await assertFails(getDoc(doc(env.authenticatedContext('susi').firestore(), 'notices/susi/items/n1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'notices/ana/items/n1')));
  });

  it('RF-6 (012): ningún cliente escribe avisos, ni la dueña', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('ana').firestore(), 'notices/ana/items/n2'), { type: 'apice-editado' }));
  });
});
