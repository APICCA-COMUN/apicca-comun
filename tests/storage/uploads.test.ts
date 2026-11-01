// T-5.2 · Reglas de Storage de `uploads/{uid}/…`: la subida temporal de una referencia (D-T9 (001)).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { clearStorage, createStorageTestEnvironment, storageOf } from './setup';

const MIB = 1024 * 1024;
const PNG = { contentType: 'image/png' };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createStorageTestEnvironment();
});

beforeEach(async () => {
  await clearStorage(env);
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

  it('RF-15 (001): solo crear y borrar; sobrescribir un temporal se rechaza', async () => {
    await assertFails(uploadBytes(ref(storageAs('ana'), 'uploads/ana/previo'), new Uint8Array(10), PNG));
  });

  it('RF-15 (001): la dueña borra su temporal; otra persona no', async () => {
    await assertFails(deleteObject(ref(storageAs('beto'), 'uploads/ana/previo')));
    await assertSucceeds(deleteObject(ref(storageAs('ana'), 'uploads/ana/previo')));
  });
});
