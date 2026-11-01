// La denegación por defecto de Cloud Storage (`match /{allPaths=**}`). Mientras una spec
// aprobada no abra una ruta, ninguna sesión (visitante o con cuenta) lee, sube ni borra
// objetos desde el cliente. Cuando una spec abra una ruta, esta prueba debe reformularse
// para decir que lo que ninguna puerta abre sigue cerrado.
//
// Las rutas incluyen objetos ya sembrados (negar la sobrescritura) y rutas que no
// existen (negar la creación): son dos cosas distintas.
import { assertFails, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, getMetadata, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearStorage, createStorageTestEnvironment, readStorageRules, storageOf } from './setup';

/** Objetos sembrados: uno anidado bajo dos carpetas y otro bajo un prefijo cualquiera. */
const SEEDED = ['apices/apice-1/portada', 'sonda/a.txt'];
/** Las rutas que se prueban; las dos últimas no existen todavía. */
const PATHS = ['apices/apice-1/portada', 'sonda/a.txt', 'raiz.txt', 'uploads/uid-1/mas/hondo'];

const BYTES = new Uint8Array([137, 80, 78, 71]);
const IMAGE = { contentType: 'image/png' };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createStorageTestEnvironment();
});

beforeEach(async () => {
  await clearStorage(env);
  await env.withSecurityRulesDisabled(async (admin) => {
    const storage = storageOf(admin);
    for (const path of SEEDED) await uploadBytes(ref(storage, path), BYTES, IMAGE);
  });
});

afterAll(async () => {
  await env.cleanup();
});

/** Como `assertFails`, pero el fallo dice quién intentaba qué y en qué ruta. */
async function denies(what: string, operation: Promise<unknown>): Promise<void> {
  try {
    await assertFails(operation);
  } catch (error) {
    throw new Error(`${what} — ${error instanceof Error ? error.message : String(error)}`);
  }
}

describe('storage.rules · denegación por defecto', () => {
  // RF-SEG-2: el sistema SHALL denegar por defecto toda lectura, subida y borrado de
  // Storage desde el cliente, con o sin sesión, hasta que una spec aprobada abra una ruta.
  it('RF-SEG-2: Storage no admite lectura ni escritura desde el cliente', async () => {
    const actors: ReadonlyArray<readonly [string, RulesTestContext]> = [
      ['visitante sin sesión', env.unauthenticatedContext()],
      ['persona con sesión', env.authenticatedContext('uid-1')],
    ];

    for (const [who, context] of actors) {
      const storage = storageOf(context);
      for (const path of PATHS) {
        const target = ref(storage, path);
        const what = `${who} · ${path}`;
        await denies(`${what} · getMetadata`, getMetadata(target));
        await denies(`${what} · getBytes`, getBytes(target));
        await denies(`${what} · uploadBytes`, uploadBytes(target, BYTES, IMAGE));
        await denies(`${what} · deleteObject`, deleteObject(target));
      }
    }
  });
});

describe('RF-7 (007): reglas desplegadas', () => {
  it('RF-7 (007): no consultan Firestore', () => {
    const rules = readStorageRules();
    expect(rules).not.toMatch(/firestore\./);
    expect(rules).not.toContain('/databases/');
  });
});
