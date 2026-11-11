// Reglas de Firestore de lo que dejó la generación de imágenes, tras su retiro (RF-27 (021) · 27.4, D-T6 (021)):
// `proposals`, `apices/{id}/images`, `generation` y `generationDays` se conservan, y ningún cliente los lee ni los
// escribe. Antes la propuesta la leía quien la pidió y las imágenes, quien veía el historial (RF-16 (001) y
// RF-17 (001), sustituidos).
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const ACCOUNTS: Record<string, { role: string; status: string }> = {
  ana: { role: 'member', status: 'active' },
  beto: { role: 'member', status: 'active' },
  fabi: { role: 'facilitator', status: 'active' },
  fran: { role: 'facilitator', status: 'suspended' },
  sofi: { role: 'member', status: 'suspended' },
};

const ACTORS = ['visitor', ...Object.keys(ACCOUNTS)];
const APICES = ['publico', 'privado', 'archivado'];

const dbOf = (actor: string) =>
  actor === 'visitor' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(actor).firestore();

beforeAll(async () => {
  env = await createTestEnvironment();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, account] of Object.entries(ACCOUNTS)) {
      await setDoc(doc(db, `accounts/${uid}`), { name: uid, username: uid, ...account });
    }
    const base = { authorUid: 'ana', version: 1, isArchived: false };
    await setDoc(doc(db, 'apices/publico'), { ...base, visibility: 'public' });
    await setDoc(doc(db, 'apices/privado'), { ...base, visibility: 'private' });
    await setDoc(doc(db, 'apices/archivado'), { ...base, visibility: 'public', isArchived: true });
    for (const id of APICES) {
      await setDoc(doc(db, `apices/${id}/images/vigente`), { altText: 'a', isRemoved: false, removal: null });
      await setDoc(doc(db, `apices/${id}/images/retirada`), { altText: 'b', isRemoved: true, removal: { reason: 'x' } });
    }
    await setDoc(doc(db, 'proposals/publico_ana'), { apiceId: 'publico', requestedByUid: 'ana', png: 'x' });
    await setDoc(doc(db, 'generation/ana'), { lock: null, consecutiveFailures: 0, blockedUntil: null });
    await setDoc(doc(db, 'generationDays/ana_2026-10-07'), { count: 1 });
    await setDoc(doc(db, 'generationDays/global_2026-10-07'), { count: 1 });
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · proposals', () => {
  it('RF-27 (021) · 27.4: nadie lee una propuesta guardada, ni quien la pidió ni la facilitación', async () => {
    for (const actor of ACTORS) await assertFails(getDoc(doc(dbOf(actor), 'proposals/publico_ana')));
  });

  it('RF-27 (021) · 27.4: nadie escribe ni borra una propuesta desde el cliente', async () => {
    await assertFails(setDoc(doc(dbOf('ana'), 'proposals/publico_ana'), { requestedByUid: 'ana', png: 'otra' }));
    await assertFails(setDoc(doc(dbOf('ana'), 'proposals/nueva_ana'), { requestedByUid: 'ana' }));
    await assertFails(deleteDoc(doc(dbOf('ana'), 'proposals/publico_ana')));
  });
});

describe('firestore.rules · apices/{id}/images', () => {
  it('RF-27 (021) · 27.4: nadie lee una imagen aceptada, vigente o retirada, ni su autora ni la facilitación', async () => {
    for (const actor of ACTORS) {
      for (const id of APICES) {
        await assertFails(getDoc(doc(dbOf(actor), `apices/${id}/images/vigente`)));
        await assertFails(getDoc(doc(dbOf(actor), `apices/${id}/images/retirada`)));
      }
      await assertFails(getDocs(collection(dbOf(actor), 'apices/publico/images')));
    }
  });

  it('RF-27 (021) · 27.4: nadie escribe ni borra imágenes desde el cliente, y siguen guardadas', async () => {
    await assertFails(setDoc(doc(dbOf('fabi'), 'apices/publico/images/nueva'), { isRemoved: false }));
    await assertFails(deleteDoc(doc(dbOf('fabi'), 'apices/publico/images/vigente')));
    await env.withSecurityRulesDisabled(async (context) => {
      const stored = await getDocs(collection(context.firestore(), 'apices/publico/images'));
      expect(stored.docs.map((snap) => snap.id).sort()).toEqual(['retirada', 'vigente']);
    });
  });
});

describe('firestore.rules · generation y generationDays', () => {
  it('RF-27 (021) · 27.4: el estado de la generación y sus contadores no se leen ni se escriben', async () => {
    for (const actor of ['ana', 'fabi', 'visitor']) {
      await assertFails(getDoc(doc(dbOf(actor), 'generation/ana')));
      await assertFails(getDoc(doc(dbOf(actor), 'generationDays/ana_2026-10-07')));
      await assertFails(getDoc(doc(dbOf(actor), 'generationDays/global_2026-10-07')));
    }
    await assertFails(setDoc(doc(dbOf('ana'), 'generationDays/ana_2026-10-07'), { count: 0 }));
    await assertFails(setDoc(doc(dbOf('ana'), 'generation/ana'), { lock: null }));
  });
});
