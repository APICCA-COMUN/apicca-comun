// RF-1 (018) · 1.1 a 1.3 · T-2 (009) · Reglas de threads y threads/{id}/messages: lectura pública de lo no archivado; nadie escribe (RF-9 (009), RNF-2 (009)).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, startAfter, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;
const account = (username: string, role = 'member', status = 'active') => ({ email: `${username}@x.org`, name: username, username, role, status });
const thread = (authorUid: string, isArchived: boolean) => ({ title: 'Hilo', axis: 'agua', authorUid, authorUsername: authorUid, isArchived });
const message = (authorUid: string, isArchived: boolean, createdAt = 1) => ({ text: 'Hola', authorUid, authorUsername: authorUid, isArchived, createdAt });

beforeAll(async () => {
  env = await createTestEnvironment();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'accounts/ana'), account('ana'));
    await setDoc(doc(db, 'accounts/beto'), account('beto'));
    await setDoc(doc(db, 'accounts/fabi'), account('fabi', 'facilitator'));
    await setDoc(doc(db, 'accounts/susi'), account('susi', 'member', 'suspended'));
    await setDoc(doc(db, 'threads/abierto'), thread('ana', false));
    await setDoc(doc(db, 'threads/archivado'), thread('ana', true));
    await setDoc(doc(db, 'threads/abierto/messages/m1'), message('ana', false, 1));
    await setDoc(doc(db, 'threads/abierto/messages/m3'), message('beto', false, 2));
    await setDoc(doc(db, 'threads/abierto/messages/m4'), message('beto', false, 3));
    await setDoc(doc(db, 'threads/abierto/messages/m2'), message('beto', true));
    await setDoc(doc(db, 'threads/archivado/messages/m1'), message('ana', false));
  });
});
afterAll(async () => {
  await env.cleanup();
});

const visitor = () => env.unauthenticatedContext().firestore();
const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('firestore.rules · threads', () => {
  it('RF-9 (009): un visitante lee un hilo y sus mensajes no archivados', async () => {
    await assertSucceeds(getDoc(doc(visitor(), 'threads/abierto')));
    await assertSucceeds(getDoc(doc(visitor(), 'threads/abierto/messages/m1')));
    await assertSucceeds(getDocs(query(collection(visitor(), 'threads'), where('isArchived', '==', false))));
  });

  it('RF-9 (009): un visitante, otra persona y una cuenta suspendida no leen lo archivado', async () => {
    await assertFails(getDoc(doc(visitor(), 'threads/archivado')));
    await assertFails(getDoc(doc(as('beto'), 'threads/archivado')));
    await assertFails(getDoc(doc(as('susi'), 'threads/archivado')));
    await assertFails(getDoc(doc(visitor(), 'threads/abierto/messages/m2')));
  });

  it('RF-9 (009), RF-5 (009) · 5.1: los mensajes de un hilo archivado no se ven con él', async () => {
    await assertFails(getDoc(doc(visitor(), 'threads/archivado/messages/m1')));
    await assertFails(getDoc(doc(as('beto'), 'threads/archivado/messages/m1')));
  });

  it('RF-9 (009): la autora y un facilitador activo leen lo archivado', async () => {
    await assertSucceeds(getDoc(doc(as('ana'), 'threads/archivado')));
    await assertSucceeds(getDoc(doc(as('fabi'), 'threads/archivado')));
    await assertSucceeds(getDoc(doc(as('fabi'), 'threads/archivado/messages/m1')));
  });

  it('RNF-2 (009): ningún cliente escribe hilos ni mensajes, ni la autora', async () => {
    await assertFails(setDoc(doc(as('ana'), 'threads/nuevo'), thread('ana', false)));
    await assertFails(setDoc(doc(as('ana'), 'threads/abierto'), thread('ana', true)));
    await assertFails(setDoc(doc(as('ana'), 'threads/abierto/messages/m3'), message('ana', false)));
  });

  it('RF-1 (018) · 1.1 a 1.3: un visitante puede hacer las consultas de apertura, de la página reciente y de las anteriores', async () => {
    const messages = () => collection(visitor(), 'threads/abierto/messages');
    await assertSucceeds(getDocs(query(messages(), where('isArchived', '==', false), orderBy('createdAt', 'asc'), limit(1))));
    await assertSucceeds(getDocs(query(messages(), where('isArchived', '==', false), orderBy('createdAt', 'desc'), limit(50))));
    const cursor = await getDocs(query(messages(), where('isArchived', '==', false), orderBy('createdAt', 'desc'), limit(1)));
    await assertSucceeds(getDocs(query(messages(), where('isArchived', '==', false), orderBy('createdAt', 'desc'), startAfter(cursor.docs[0]), limit(50))));
  });

  it('RF-1 (018) · 1.1: un visitante no lee las páginas de un hilo archivado', async () => {
    await assertFails(getDocs(query(collection(visitor(), 'threads/archivado/messages'), where('isArchived', '==', false), orderBy('createdAt', 'desc'), limit(50))));
  });
});
