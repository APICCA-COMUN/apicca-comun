// T-1.12 · Reglas de invitations, enrollmentRequests, usernames y rateLimits; uploadReservations (RF-7 (016) · 7.3).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const account = (role: string, status: string) => ({
  email: 'x@ejemplo.org',
  name: 'N',
  username: 'x',
  role,
  status,
});

const FACILITATOR_ONLY = ['invitations/k1', 'enrollmentRequests/r1'];
const NOBODY = ['usernames/ana', 'rateLimits/h1'];

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
    for (const path of [...FACILITATOR_ONLY, ...NOBODY]) await setDoc(doc(db, path), { x: 1 });
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · invitaciones y solicitudes', () => {
  it('RF-1 (001): solo un facilitador activo lee invitaciones y solicitudes', async () => {
    for (const path of FACILITATOR_ONLY) {
      await assertSucceeds(getDoc(doc(env.authenticatedContext('fabi').firestore(), path)));
      await assertFails(getDoc(doc(env.authenticatedContext('fede').firestore(), path))); // suspendido
      await assertFails(getDoc(doc(env.authenticatedContext('ana').firestore(), path))); // inscrita
      await assertFails(getDoc(doc(env.authenticatedContext('susi').firestore(), path))); // suspendida
      await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path))); // visitante
    }
  });

  it('RF-4 (001): nadie escribe ni borra desde el cliente, ni siquiera un facilitador', async () => {
    for (const path of FACILITATOR_ONLY) {
      for (const db of [
        env.authenticatedContext('fabi').firestore(),
        env.authenticatedContext('ana').firestore(),
        env.unauthenticatedContext().firestore(),
      ]) {
        await assertFails(setDoc(doc(db, path), { x: 2 }));
        await assertFails(updateDoc(doc(db, path), { x: 2 }));
        await assertFails(deleteDoc(doc(db, path)));
      }
    }
  });
});

describe('firestore.rules · usernames y rateLimits', () => {
  it('RNF-7 (001): nadie lee, escribe ni borra, ni siquiera un facilitador', async () => {
    for (const path of NOBODY) {
      for (const db of [
        env.authenticatedContext('fabi').firestore(),
        env.authenticatedContext('ana').firestore(),
        env.authenticatedContext('susi').firestore(),
        env.unauthenticatedContext().firestore(),
      ]) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { x: 2 }));
        await assertFails(deleteDoc(doc(db, path)));
      }
    }
  });
});

describe('firestore.rules · uploadReservations (spec 016)', () => {
  it('RF-7 (016) · 7.3: ningún cliente lee, crea ni borra una reserva de subida, ni la suya', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'uploadReservations/u1'), { uid: 'ana' });
    });
    for (const db of [
      env.authenticatedContext('fabi').firestore(),
      env.authenticatedContext('ana').firestore(),
      env.unauthenticatedContext().firestore(),
    ]) {
      await assertFails(getDoc(doc(db, 'uploadReservations/u1')));
      await assertFails(setDoc(doc(db, 'uploadReservations/u2'), { uid: 'ana' }));
      await assertFails(deleteDoc(doc(db, 'uploadReservations/u1')));
    }
  });
});
