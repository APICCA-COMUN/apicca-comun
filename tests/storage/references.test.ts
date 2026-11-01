// T-2 (007) · Reglas de Storage de `apices/**`: ningún cliente lee ni escribe; las referencias
// las entrega la op `readReference` (D-T2 (007), D-T4 (007)), que reemplaza la lectura de D-T10 (001).
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { clearStorage, createStorageTestEnvironment, storageOf } from './setup';

const PNG = { contentType: 'image/png' };
const FILE = 'apices/a1/references/r1';
const REMOVED_FILE = 'apices/a1/references/r2';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createStorageTestEnvironment();
});

beforeEach(async () => {
  await clearStorage(env);
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    const accounts: Record<string, { role: string; status: string }> = {
      ana: { role: 'member', status: 'active' },
      beto: { role: 'member', status: 'active' },
      fabi: { role: 'facilitator', status: 'active' },
      susi: { role: 'member', status: 'suspended' },
    };
    for (const [uid, account] of Object.entries(accounts)) {
      await setDoc(doc(db, `accounts/${uid}`), { name: uid, username: uid, ...account });
    }
    await setDoc(doc(db, 'apices/a1'), { visibility: 'public', isArchived: false, authorUid: 'ana' });
    await setDoc(doc(db, 'apices/a1/references/r1'), { path: FILE, isRemoved: false, removal: null });
    await setDoc(doc(db, 'apices/a1/references/r2'), { path: REMOVED_FILE, isRemoved: true, removal: { kind: 'removed' } });
    const storage = storageOf(admin);
    await uploadBytes(ref(storage, FILE), new Uint8Array([1, 2, 3]), PNG);
    await uploadBytes(ref(storage, REMOVED_FILE), new Uint8Array([4, 5, 6]), PNG);
  });
});

afterAll(async () => {
  await env.cleanup();
});

const storageAs = (uid: string | null) =>
  storageOf(uid === null ? env.unauthenticatedContext() : env.authenticatedContext(uid));

const setApice = (fields: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (admin) => {
    await updateDoc(doc(admin.firestore(), 'apices/a1'), fields);
  });

describe('storage.rules · apices/{id}/references', () => {
  it('RF-6 (007): nadie lee una referencia desde el cliente, con o sin sesión, ni siquiera un facilitador', async () => {
    for (const uid of [null, 'ana', 'beto', 'fabi', 'susi'] as const) {
      await assertFails(getBytes(ref(storageAs(uid), FILE)));
      await assertFails(getBytes(ref(storageAs(uid), REMOVED_FILE)));
    }
  });

  it('RF-6 (007): tampoco en un ápice público y no archivado', async () => {
    await setApice({ visibility: 'public', isArchived: false });
    await assertFails(getBytes(ref(storageAs(null), FILE)));
    await assertFails(getBytes(ref(storageAs('fabi'), FILE)));
  });

  it('RF-16 (001): nadie escribe ni borra referencias desde el cliente, ni siquiera un facilitador', async () => {
    for (const uid of ['ana', 'fabi'] as const) {
      await assertFails(uploadBytes(ref(storageAs(uid), 'apices/a1/references/r9'), new Uint8Array(10), PNG));
      await assertFails(uploadBytes(ref(storageAs(uid), FILE), new Uint8Array(10), PNG));
      await assertFails(deleteObject(ref(storageAs(uid), FILE)));
    }
  });
});
