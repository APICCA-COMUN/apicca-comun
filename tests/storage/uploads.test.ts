// T-5.2 · Reglas de Storage de `uploads/{uid}/…`: la subida temporal de una referencia (D-T9 (001)), con reserva (RF-7 (016) · 7.3).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { clearStorage, createStorageTestEnvironment, storageOf } from './setup';

const MIB = 1024 * 1024;
const PNG = { contentType: 'image/png' };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createStorageTestEnvironment();
});

const HOUR = 60 * 60 * 1000;
/** Reservas que concedería `reserveUpload` (RF-7 (016) · 7.3); las de ana, salvo que se diga otra cosa. */
const RESERVED = ['nueva', 'justo', 'grande', 'jpg', 'webp', 'gif', 'txt', 'previo'];

async function seedReservation(uploadId: string, uid: string, expiresInMs: number): Promise<void> {
  await env.withSecurityRulesDisabled(async (admin) => {
    await setDoc(doc(admin.firestore(), 'uploadReservations', uploadId), {
      uid,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + expiresInMs),
    });
  });
}

beforeEach(async () => {
  await clearStorage(env);
  await env.clearFirestore();
  for (const uploadId of RESERVED) await seedReservation(uploadId, 'ana', HOUR);
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
  it('RF-15 (001): una persona sube una imagen a su propia carpeta', async () => {
    await assertSucceeds(uploadBytes(ref(storageAs('ana'), 'uploads/ana/nueva'), new Uint8Array(10), PNG));
  });

  it('RF-15 (001): subir a la carpeta de otra persona o sin sesión se rechaza', async () => {
    await assertFails(uploadBytes(ref(storageAs('beto'), 'uploads/ana/nueva'), new Uint8Array(10), PNG));
    await assertFails(uploadBytes(ref(storageAs(null), 'uploads/ana/nueva'), new Uint8Array(10), PNG));
  });

  it('RF-15 (001): nadie lee un temporal, ni su dueña (lo lee la op del servidor)', async () => {
    await assertFails(getBytes(ref(storageAs('ana'), 'uploads/ana/previo')));
    await assertFails(getBytes(ref(storageAs('beto'), 'uploads/ana/previo')));
  });

  it('RF-15 (001): el límite es 5 MiB exactos; 5 MiB más un byte se rechaza', async () => {
    await assertSucceeds(uploadBytes(ref(storageAs('ana'), 'uploads/ana/justo'), new Uint8Array(5 * MIB), PNG));
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/grande'), new Uint8Array(5 * MIB + 1), PNG));
  });

  it('RF-15 (001): solo se admiten JPG, PNG y WebP; un GIF o un texto se rechazan', async () => {
    for (const [name, contentType] of [
      ['jpg', 'image/jpeg'],
      ['webp', 'image/webp'],
    ] as const) {
      await assertSucceeds(uploadBytes(ref(storageAs('ana'), `uploads/ana/${name}`), new Uint8Array(10), { contentType }));
    }
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/gif'), new Uint8Array(10), { contentType: 'image/gif' }));
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/txt'), new Uint8Array(10), { contentType: 'text/plain' }));
  });

  it('RF-15 (001): solo crear; sobrescribir un temporal se rechaza', async () => {
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/previo'), new Uint8Array(10), PNG));
  });

  it('RF-7 (016) · 7.3: nadie borra un temporal desde el cliente, así una reserva sirve para una sola subida', async () => {
    await assertFails(deleteObject(ref(storageAs('beto'), 'uploads/ana/previo')));
    await assertFails(deleteObject(ref(storageAs('ana'), 'uploads/ana/previo')));
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/previo'), new Uint8Array(10), PNG));
  });

  it('RF-7 (016) · 7.3: sin reserva del servidor la subida se rechaza', async () => {
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/sin-reserva'), new Uint8Array(10), PNG));
  });

  it('RF-7 (016) · 7.3: con la reserva de otra persona la subida se rechaza', async () => {
    await seedReservation('de-beto', 'beto', HOUR);
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/de-beto'), new Uint8Array(10), PNG));
    await assertSucceeds(uploadBytes(ref(storageAs('beto'), 'uploads/beto/de-beto'), new Uint8Array(10), PNG));
  });

  it('RF-7 (016) · 7.3: con una reserva caducada la subida se rechaza', async () => {
    await seedReservation('vieja', 'ana', -1000);
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/vieja'), new Uint8Array(10), PNG));
  });
});
