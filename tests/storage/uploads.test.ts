// Reglas de Storage de `uploads/{uid}/…` tras el retiro de las referencias (RF-27 (021) · 27.2, D-T6 (021)): ya no hay
// operación que conceda una reserva ni que reclame un temporal, así que ninguna subida se acepta, ni siquiera con una
// reserva que haya quedado guardada. Antes la persona subía aquí su imagen de referencia (RF-15 (001) y
// RF-7 (016) · 7.3, sustituidos).
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { clearStorage, createStorageTestEnvironment, storageOf } from './setup';

const PNG = { contentType: 'image/png' };
const HOUR = 60 * 60 * 1000;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createStorageTestEnvironment();
});

/** Una reserva como las que concedía `reserveUpload`: vigente y de esa persona. */
async function seedReservation(uploadId: string, uid: string): Promise<void> {
  await env.withSecurityRulesDisabled(async (admin) => {
    await setDoc(doc(admin.firestore(), 'uploadReservations', uploadId), {
      uid,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + HOUR),
    });
  });
}

beforeEach(async () => {
  await clearStorage(env);
  await env.clearFirestore();
  await seedReservation('nueva', 'ana');
  await seedReservation('previo', 'ana');
  await env.withSecurityRulesDisabled(async (admin) => {
    await uploadBytes(ref(storageOf(admin), 'uploads/ana/previo'), new Uint8Array([1, 2, 3]), PNG);
  });
});

afterAll(async () => {
  await env.cleanup();
});

const storageAs = (uid: string | null) =>
  storageOf(uid === null ? env.unauthenticatedContext() : env.authenticatedContext(uid));

describe('storage.rules · uploads/{uid}', () => {
  it('RF-27 (021) · 27.2: una persona ya no sube a su carpeta, ni con una reserva vigente que haya quedado guardada', async () => {
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/nueva'), new Uint8Array(10), PNG));
    for (const contentType of ['image/jpeg', 'image/webp']) {
      await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/nueva'), new Uint8Array(10), { contentType }));
    }
  });

  it('RF-27 (021) · 27.2: tampoco sin reserva, a la carpeta de otra persona o sin sesión', async () => {
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/sin-reserva'), new Uint8Array(10), PNG));
    await assertFails(uploadBytes(ref(storageAs('beto'), 'uploads/ana/nueva'), new Uint8Array(10), PNG));
    await assertFails(uploadBytes(ref(storageAs(null), 'uploads/ana/nueva'), new Uint8Array(10), PNG));
  });

  it('RF-27 (021) · 27.2: nadie lee, sobrescribe ni borra un temporal que haya quedado', async () => {
    for (const uid of ['ana', 'beto', null] as const) {
      await assertFails(getBytes(ref(storageAs(uid), 'uploads/ana/previo')));
      await assertFails(deleteObject(ref(storageAs(uid), 'uploads/ana/previo')));
    }
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/previo'), new Uint8Array(10), PNG));
  });
});
