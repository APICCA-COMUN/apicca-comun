// T-4 (010) · RF-8 (010), RF-9 (010), RNF-2 (010), D-T4 (010): reglas de commonActions, sus participantes y sus versiones.
// Lectura pública de lo listado; lo archivado y lo de cuentas suspendidas, solo para quien corresponde; nadie escribe.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;
const account = (username: string, role = 'member', status = 'active') => ({ email: `${username}@x.org`, name: username, username, role, status });
const action = (authorUid: string, status: string, authorSuspended = false) => ({
  title: 'Camino',
  description: 'Una descripción larga.',
  axis: null,
  status,
  authorUid,
  authorUsername: authorUid,
  authorSuspended,
  isListed: status !== 'archivada' && !authorSuspended,
  apiceIds: ['a', 'b', 'c'],
  participantUids: [authorUid, 'beto'],
  participantCount: 2,
  version: 1,
  createdAt: 1,
});
const participant = (uid: string, suspended = false) => ({ uid, username: uid, joinedAt: 1, suspended });

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
    await setDoc(doc(db, 'commonActions/abierta'), action('ana', 'abierta'));
    await setDoc(doc(db, 'commonActions/cerrada'), action('ana', 'cerrada'));
    await setDoc(doc(db, 'commonActions/archivada'), action('ana', 'archivada'));
    await setDoc(doc(db, 'commonActions/de-susi'), action('susi', 'abierta', true));
    await setDoc(doc(db, 'commonActions/abierta/participants/ana'), participant('ana'));
    await setDoc(doc(db, 'commonActions/abierta/participants/susi'), participant('susi', true));
    await setDoc(doc(db, 'commonActions/archivada/participants/ana'), participant('ana'));
    await setDoc(doc(db, 'commonActions/abierta/versions/1'), { title: 'Camino', editedBy: 'ana', editedAt: 1 });
  });
});
afterAll(async () => {
  await env.cleanup();
});

const visitor = () => env.unauthenticatedContext().firestore();
const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('firestore.rules · commonActions', () => {
  it('RF-8 (010): un visitante lee las abiertas y las cerradas, y hace la consulta de la lista', async () => {
    await assertSucceeds(getDoc(doc(visitor(), 'commonActions/abierta')));
    await assertSucceeds(getDoc(doc(visitor(), 'commonActions/cerrada')));
    await assertSucceeds(getDocs(query(collection(visitor(), 'commonActions'), where('isListed', '==', true), orderBy('createdAt', 'desc'), limit(100))));
  });

  it('RF-6 (010), D-T5 (010): una persona hace la consulta de «Lo mío»', async () => {
    await assertSucceeds(
      getDocs(query(collection(as('beto'), 'commonActions'), where('isListed', '==', true), where('participantUids', 'array-contains', 'beto'), orderBy('createdAt', 'desc'), limit(100))),
    );
  });

  it('RF-8 (010): una archivada la leen solo su autora y un facilitador activo', async () => {
    await assertFails(getDoc(doc(visitor(), 'commonActions/archivada')));
    await assertFails(getDoc(doc(as('beto'), 'commonActions/archivada')));
    await assertSucceeds(getDoc(doc(as('ana'), 'commonActions/archivada')));
    await assertSucceeds(getDoc(doc(as('fabi'), 'commonActions/archivada')));
    await assertFails(getDocs(query(collection(visitor(), 'commonActions'), orderBy('createdAt', 'desc'))));
  });

  it('RF-9 (010): la de una autora suspendida no la lee el público; un facilitador sí', async () => {
    await assertFails(getDoc(doc(visitor(), 'commonActions/de-susi')));
    await assertFails(getDoc(doc(as('beto'), 'commonActions/de-susi')));
    await assertFails(getDoc(doc(as('susi'), 'commonActions/de-susi')));
    await assertSucceeds(getDoc(doc(as('fabi'), 'commonActions/de-susi')));
  });

  it('RF-5 (010) · 5.1, RF-9 (010): los participantes se leen sin los suspendidos; la persona suspendida y un facilitador sí los ven', async () => {
    await assertSucceeds(getDoc(doc(visitor(), 'commonActions/abierta/participants/ana')));
    await assertSucceeds(getDocs(query(collection(visitor(), 'commonActions/abierta/participants'), where('suspended', '==', false))));
    await assertFails(getDoc(doc(visitor(), 'commonActions/abierta/participants/susi')));
    await assertFails(getDocs(collection(visitor(), 'commonActions/abierta/participants')));
    await assertSucceeds(getDoc(doc(as('fabi'), 'commonActions/abierta/participants/susi')));
    await assertFails(getDoc(doc(visitor(), 'commonActions/archivada/participants/ana')));
  });

  it('RF-7 (010) · 7.3, D-T4 (010): las versiones las leen las cuentas activas que pueden leer la Acción Común', async () => {
    await assertFails(getDoc(doc(visitor(), 'commonActions/abierta/versions/1')));
    await assertSucceeds(getDoc(doc(as('beto'), 'commonActions/abierta/versions/1')));
    await assertFails(getDoc(doc(as('susi'), 'commonActions/abierta/versions/1')));
  });

  it('RNF-2 (010): ningún cliente escribe, ni la autora', async () => {
    await assertFails(setDoc(doc(as('ana'), 'commonActions/nueva'), action('ana', 'abierta')));
    await assertFails(setDoc(doc(as('ana'), 'commonActions/abierta'), action('ana', 'cerrada')));
    await assertFails(setDoc(doc(as('beto'), 'commonActions/abierta/participants/beto'), participant('beto')));
    await assertFails(setDoc(doc(as('ana'), 'commonActions/abierta/versions/2'), { title: 'x' }));
  });
});
