// T-3.1 a T-3.3 (004) · Reglas de la constitución común: estado, secciones, registro, documentos y propuestas.
// Lectura según plan §5.9 (004); ninguna escritura de cliente (RNF-3 (004), D-T15 (004)).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;
type Firestore = ReturnType<ReturnType<RulesTestEnvironment['unauthenticatedContext']>['firestore']>;

const account = (role: string, status: string) => ({
  email: 'x@ejemplo.org',
  name: 'N',
  username: 'x',
  role,
  status,
});

const visitor = (): Firestore => env.unauthenticatedContext().firestore();
const active = (): Firestore => env.authenticatedContext('ana').firestore();
const suspended = (): Firestore => env.authenticatedContext('susi').firestore();
const facilitator = (): Firestore => env.authenticatedContext('fabi').firestore();
const suspendedFacilitator = (): Firestore => env.authenticatedContext('fede').firestore();

const SEEDED = {
  'constitution/state': { isOpen: true, order: ['s1', 's2'], logSeq: 1 },
  'constitutionSections/s1': { title: 'Uno', text: 'T', isRetired: false },
  'constitutionSections/s2': { title: 'Dos', text: 'T', isRetired: true },
  'constitutionSections/s1/private/meta': { version: 1, proposedByUid: 'ana', proposedByUsername: 'ana' },
  'constitutionSections/s1/versions/1': { title: 'Uno', text: 'T', kind: 'initial' },
  'constitutionLog/1': { seq: 1, kind: 'opened', byUid: 'fabi', byUsername: 'fabi' },
  'constitutionDocuments/d1': { title: 'Doc', text: 'T', isArchived: false, version: 1 },
  'constitutionDocuments/d2': { title: 'Viejo', text: 'T', isArchived: true, version: 1 },
  'constitutionDocuments/d1/versions/1': { title: 'Doc', text: 'T', version: 1 },
  'amendments/a1': { kind: 'change', sectionId: 's1', isOpen: true, authorUid: 'ana' },
  'amendments/a1/revisions/1': { title: 'Uno', text: 'T' },
  'amendments/a1/comments/c1': { text: 'Hola', authorUid: 'ana' },
  'amendments/a1/comments/c1/versions/1': { text: 'Hol' },
  'amendments/a1/stances/ana': { agreement: 'active' },
  'amendments/a1/objections/o1': { uid: 'fabi', status: 'open' },
  'amendments/a1/events/1': { kind: 'opened' },
  'amendmentSlots/s:s1': { amendmentId: 'a1' },
} as const;

const AMENDMENT_PATHS = Object.keys(SEEDED).filter((path) => path.startsWith('amendments/'));

beforeAll(async () => {
  env = await createTestEnvironment();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'accounts/fabi'), account('facilitator', 'active'));
    await setDoc(doc(db, 'accounts/fede'), account('facilitator', 'suspended'));
    await setDoc(doc(db, 'accounts/ana'), account('member', 'active'));
    await setDoc(doc(db, 'accounts/susi'), account('member', 'suspended'));
    for (const [path, data] of Object.entries(SEEDED)) await setDoc(doc(db, path), data);
  });
});

afterAll(async () => {
  await env.cleanup();
});

async function canRead(db: Firestore, path: string, can: boolean): Promise<void> {
  if (can) await assertSucceeds(getDoc(doc(db, path)));
  else await assertFails(getDoc(doc(db, path)));
}

describe('firestore.rules · estado y secciones (004)', () => {
  it('RF-1 (004) · 1.2: cualquiera lee el estado de la constitución, también un visitante', async () => {
    for (const db of [visitor(), suspended(), active(), facilitator()]) await canRead(db, 'constitution/state', true);
  });

  it('RF-2 (004) · 2.3: el visitante lee las secciones vigentes y no las retiradas; la cuenta activa, todas', async () => {
    await canRead(visitor(), 'constitutionSections/s1', true);
    await canRead(visitor(), 'constitutionSections/s2', false);
    await assertSucceeds(getDocs(query(collection(visitor(), 'constitutionSections'), where('isRetired', '==', false))));
    await assertFails(getDocs(collection(visitor(), 'constitutionSections')));
    await canRead(active(), 'constitutionSections/s2', true);
    await canRead(facilitator(), 'constitutionSections/s2', true);
  });

  it('RF-2 (004) · 2.4: la autoría (private) y las versiones solo las leen cuentas activas', async () => {
    for (const path of ['constitutionSections/s1/private/meta', 'constitutionSections/s1/versions/1']) {
      await canRead(visitor(), path, false);
      await canRead(suspended(), path, false);
      await canRead(suspendedFacilitator(), path, false);
      await canRead(active(), path, true);
      await canRead(facilitator(), path, true);
    }
  });
});

describe('firestore.rules · registro y documentos (004)', () => {
  it('RF-3 (004) · 3.1: el registro de cambios lo leen solo cuentas activas', async () => {
    await canRead(visitor(), 'constitutionLog/1', false);
    await canRead(suspended(), 'constitutionLog/1', false);
    await canRead(active(), 'constitutionLog/1', true);
  });

  it('RF-5 (004) · 5.2: el visitante lee documentos no archivados; los archivados, solo un facilitador activo', async () => {
    await canRead(visitor(), 'constitutionDocuments/d1', true);
    await assertSucceeds(getDocs(query(collection(visitor(), 'constitutionDocuments'), where('isArchived', '==', false))));
    for (const db of [visitor(), suspended(), active(), suspendedFacilitator()]) {
      await canRead(db, 'constitutionDocuments/d2', false);
    }
    await canRead(facilitator(), 'constitutionDocuments/d2', true);
    await assertSucceeds(getDocs(query(collection(facilitator(), 'constitutionDocuments'), where('isArchived', '==', true))));
    await assertFails(getDocs(query(collection(active(), 'constitutionDocuments'), where('isArchived', '==', true))));
  });

  it('RF-5 (004) · 5.4: el historial de un documento lo leen solo cuentas activas', async () => {
    await canRead(visitor(), 'constitutionDocuments/d1/versions/1', false);
    await canRead(suspended(), 'constitutionDocuments/d1/versions/1', false);
    await canRead(active(), 'constitutionDocuments/d1/versions/1', true);
  });
});

describe('firestore.rules · propuestas (004)', () => {
  it('RF-9 (004) · 9.4: la propuesta y toda su deliberación las leen solo cuentas activas', async () => {
    for (const path of AMENDMENT_PATHS) {
      await canRead(visitor(), path, false);
      await canRead(suspended(), path, false);
      await canRead(suspendedFacilitator(), path, false);
      await canRead(active(), path, true);
      await canRead(facilitator(), path, true);
    }
  });

  it('RF-6 (004) · 6.5: las cerraduras de propuesta no las lee nadie desde el cliente', async () => {
    for (const db of [visitor(), suspended(), active(), facilitator()]) await canRead(db, 'amendmentSlots/s:s1', false);
  });
});

describe('firestore.rules · sin escrituras de cliente (004)', () => {
  it('RNF-3 (004): nadie crea, edita ni borra nada de la constitución desde el cliente, ni un facilitador', async () => {
    for (const db of [visitor(), suspended(), active(), facilitator()]) {
      for (const path of [...Object.keys(SEEDED), 'amendments/nueva', 'constitutionDocuments/nuevo']) {
        await assertFails(setDoc(doc(db, path), { x: 2 }));
        await assertFails(updateDoc(doc(db, path), { x: 2 }));
        await assertFails(deleteDoc(doc(db, path)));
      }
    }
  });

  it('RNF-1 (004): el registro y las versiones son inmutables: ni editarlos ni borrarlos', async () => {
    for (const path of ['constitutionLog/1', 'constitutionSections/s1/versions/1', 'constitutionDocuments/d1/versions/1']) {
      await assertFails(updateDoc(doc(facilitator(), path), { text: 'otro' }));
      await assertFails(deleteDoc(doc(facilitator(), path)));
    }
  });
});
