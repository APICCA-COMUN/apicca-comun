// T-2.9 · Reglas de apices, versions y events: ejecutan la tabla única de T-2.7 (D-T18 (001)).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  APICE_ACCESS_TABLE,
  APICE_ACTORS,
  APICE_STATES,
  apiceFor,
  type ApiceActorName,
  type ApiceStateName,
} from '../../shared/domain/access';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

const ACTORS = Object.keys(APICE_ACTORS) as ApiceActorName[];
const STATES = Object.keys(APICE_STATES) as ApiceStateName[];
const apiceId = (actor: ApiceActorName, state: ApiceStateName) => `${actor}-${state}`;

/** Base de datos de quien actúa: sin sesión para el visitante, con su uid para los demás. */
function dbOf(actor: ApiceActorName) {
  return actor === 'visitor'
    ? env.unauthenticatedContext().firestore()
    : env.authenticatedContext(actor).firestore();
}

beforeAll(async () => {
  env = await createTestEnvironment();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const actor of ACTORS) {
      const { viewer } = APICE_ACTORS[actor];
      if (viewer === null) continue;
      await setDoc(doc(db, `accounts/${actor}`), {
        email: `${actor}@ejemplo.org`,
        name: actor,
        username: actor.toLowerCase(),
        role: viewer.role,
        status: viewer.status,
      });
    }
    for (const actor of ACTORS) {
      for (const state of STATES) {
        const id = apiceId(actor, state);
        await setDoc(doc(db, `apices/${id}`), { name: id, ...apiceFor(state, actor), version: 1 });
        await setDoc(doc(db, `apices/${id}/versions/1`), { n: 1, kind: 'create' });
        await setDoc(doc(db, `apices/${id}/events/e1`), { type: 'visibility' });
      }
    }
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · apices según la tabla única', () => {
  for (const row of APICE_ACCESS_TABLE) {
    const id = apiceId(row.actor, row.state);
    const label = `${row.actor} · ${row.state}`;

    it(`RF-13 (001): ${label} → leer el ápice ${row.view ? 'sí' : 'no'}`, async () => {
      const read = getDoc(doc(dbOf(row.actor), `apices/${id}`));
      await (row.view ? assertSucceeds(read) : assertFails(read));
    });

    it(`RF-12 (001): ${label} → leer versiones y eventos ${row.history ? 'sí' : 'no'}`, async () => {
      for (const path of [`apices/${id}/versions/1`, `apices/${id}/events/e1`]) {
        const read = getDoc(doc(dbOf(row.actor), path));
        await (row.history ? assertSucceeds(read) : assertFails(read));
      }
    });
  }
});

describe('firestore.rules · apices, escrituras y listas', () => {
  it('RNF-7 (001): nadie escribe, edita ni borra desde el cliente, ni siquiera quien podría editar', async () => {
    for (const actor of ACTORS) {
      const db = dbOf(actor);
      for (const path of [`apices/${apiceId(actor, 'public')}`, `apices/${apiceId(actor, 'public')}/versions/1`, `apices/${apiceId(actor, 'public')}/events/e1`]) {
        await assertFails(setDoc(doc(db, path), { x: 1 }));
        await assertFails(updateDoc(doc(db, path), { x: 1 }));
        await assertFails(deleteDoc(doc(db, path)));
      }
      await assertFails(setDoc(doc(db, 'apices/nuevo'), { name: 'n' }));
    }
  });

  it('RF-13 (001): un visitante lista los públicos y no archivados, y no una lista que podría traer otros', async () => {
    const db = dbOf('visitor');
    await assertSucceeds(
      getDocs(query(collection(db, 'apices'), where('visibility', '==', 'public'), where('isArchived', '==', false))),
    );
    await assertFails(getDocs(collection(db, 'apices')));
  });

  it('RF-14 (001): una persona inscrita lista los no archivados, y no una lista que traería archivados', async () => {
    const db = dbOf('member');
    await assertSucceeds(getDocs(query(collection(db, 'apices'), where('isArchived', '==', false))));
    await assertFails(getDocs(collection(db, 'apices')));
  });

  it('RF-12 (001): un ápice que no existe no deja leer sus versiones', async () => {
    await assertFails(getDoc(doc(dbOf('facilitator'), 'apices/fantasma/versions/1')));
  });
});
