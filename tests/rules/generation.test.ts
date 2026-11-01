// T-6.18 · Reglas de Firestore de la generación de imágenes: `proposals` (solo quien la pidió),
// `apices/{id}/images` (las retiradas, solo facilitadores) y `generation`/`generationDays` (nadie).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const ACCOUNTS: Record<string, { role: string; status: string }> = {
  ana: { role: 'member', status: 'active' },
  beto: { role: 'member', status: 'active' },
  fabi: { role: 'facilitator', status: 'active' },
  fran: { role: 'facilitator', status: 'suspended' },
  sofi: { role: 'member', status: 'suspended' },
};

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
    for (const id of ['publico', 'privado', 'archivado']) {
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
  it('RF-17 (001): la propuesta la lee solo quien la pidió', async () => {
    await assertSucceeds(getDoc(doc(dbOf('ana'), 'proposals/publico_ana')));
    await assertFails(getDoc(doc(dbOf('beto'), 'proposals/publico_ana')));
    await assertFails(getDoc(doc(dbOf('visitor'), 'proposals/publico_ana')));
  });

  it('RF-17 (001): ni los facilitadores leen la propuesta ajena', async () => {
    await assertFails(getDoc(doc(dbOf('fabi'), 'proposals/publico_ana')));
  });

  it('RF-17 (001): una cuenta suspendida no lee ni su propia propuesta', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'proposals/publico_sofi'), { apiceId: 'publico', requestedByUid: 'sofi' });
    });
    await assertFails(getDoc(doc(dbOf('sofi'), 'proposals/publico_sofi')));
  });

  it('RF-17 (001): nadie escribe ni borra la propuesta desde el cliente', async () => {
    await assertFails(setDoc(doc(dbOf('ana'), 'proposals/publico_ana'), { requestedByUid: 'ana', png: 'otra' }));
    await assertFails(setDoc(doc(dbOf('ana'), 'proposals/nueva_ana'), { requestedByUid: 'ana' }));
    await assertFails(deleteDoc(doc(dbOf('ana'), 'proposals/publico_ana')));
  });
});

describe('firestore.rules · apices/{id}/images', () => {
  it('RF-16 (001): la imagen vigente la leen las cuentas activas que ven el ápice, no los visitantes', async () => {
    await assertSucceeds(getDoc(doc(dbOf('beto'), 'apices/publico/images/vigente')));
    await assertSucceeds(getDoc(doc(dbOf('beto'), 'apices/privado/images/vigente')));
    await assertFails(getDoc(doc(dbOf('visitor'), 'apices/publico/images/vigente')));
    await assertFails(getDoc(doc(dbOf('sofi'), 'apices/publico/images/vigente')));
  });

  it('RF-16 (001): una imagen retirada la lee solo un facilitador activo', async () => {
    await assertFails(getDoc(doc(dbOf('beto'), 'apices/publico/images/retirada')));
    await assertFails(getDoc(doc(dbOf('ana'), 'apices/publico/images/retirada')));
    await assertFails(getDoc(doc(dbOf('visitor'), 'apices/publico/images/retirada')));
    await assertFails(getDoc(doc(dbOf('fran'), 'apices/publico/images/retirada')));
    await assertSucceeds(getDoc(doc(dbOf('fabi'), 'apices/publico/images/retirada')));
  });

  it('RF-16 (001): en un ápice archivado solo su autora y los facilitadores leen las imágenes', async () => {
    await assertFails(getDoc(doc(dbOf('beto'), 'apices/archivado/images/vigente')));
    await assertSucceeds(getDoc(doc(dbOf('ana'), 'apices/archivado/images/vigente')));
    await assertSucceeds(getDoc(doc(dbOf('fabi'), 'apices/archivado/images/vigente')));
  });

  it('RF-16 (001): nadie escribe ni borra imágenes desde el cliente', async () => {
    await assertFails(setDoc(doc(dbOf('fabi'), 'apices/publico/images/nueva'), { isRemoved: false }));
    await assertFails(deleteDoc(doc(dbOf('fabi'), 'apices/publico/images/vigente')));
  });
});

describe('firestore.rules · generation y generationDays', () => {
  it('RF-17 (001): el estado de la generación y los contadores no se leen ni se escriben', async () => {
    for (const actor of ['ana', 'fabi', 'visitor']) {
      await assertFails(getDoc(doc(dbOf(actor), 'generation/ana')));
      await assertFails(getDoc(doc(dbOf(actor), 'generationDays/ana_2026-10-07')));
      await assertFails(getDoc(doc(dbOf(actor), 'generationDays/global_2026-10-07')));
    }
    await assertFails(setDoc(doc(dbOf('ana'), 'generationDays/ana_2026-10-07'), { count: 0 }));
    await assertFails(setDoc(doc(dbOf('ana'), 'generation/ana'), { lock: null }));
  });
});
