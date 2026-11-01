import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnvironment();
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · denegación por defecto', () => {
  // RF-SEG-1: el sistema SHALL denegar por defecto toda lectura y escritura de Firestore
  // desde el cliente, con o sin sesión, hasta que una spec aprobada abra una colección.
  it('RF-SEG-1: todo está denegado por defecto', async () => {
    const visitor = env.unauthenticatedContext().firestore();
    const someone = env.authenticatedContext('uid-cualquiera').firestore();

    await assertFails(getDoc(doc(visitor, 'cualquiera/doc')));
    await assertFails(setDoc(doc(visitor, 'cualquiera/doc'), { x: 1 }));
    await assertFails(getDoc(doc(someone, 'cualquiera/doc')));
    await assertFails(setDoc(doc(someone, 'cualquiera/doc'), { x: 1 }));
    await assertFails(getDoc(doc(someone, 'apices/apice-1')));
    await assertFails(setDoc(doc(someone, 'apices/apice-1'), { name: 'Ápice' }));
  });

  // RF-SEG-1: la denegación alcanza también a los documentos anidados en subcolecciones.
  it('RF-SEG-1: las subcolecciones también están denegadas', async () => {
    const someone = env.authenticatedContext('uid-cualquiera').firestore();

    await assertFails(getDoc(doc(someone, 'apices/apice-1/hebras/hebra-1')));
    await assertFails(setDoc(doc(someone, 'apices/apice-1/hebras/hebra-1'), { x: 1 }));
  });
});
