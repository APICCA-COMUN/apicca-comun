// T-3.9 · Reglas del descubrimiento: las consultas de lista (no solo las lecturas por id) deben quedar
// acotadas por las reglas (D-T17 (001), D-T18 (001)). La tabla por documento vive en apices.test.ts.
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnvironment } from './setup';

let env: RulesTestEnvironment;

type Who = 'visitor' | 'member' | 'author' | 'facilitator' | 'suspended';

const ACCOUNTS: Record<Exclude<Who, 'visitor'>, { role: string; status: string }> = {
  member: { role: 'member', status: 'active' },
  author: { role: 'member', status: 'active' },
  facilitator: { role: 'facilitator', status: 'active' },
  suspended: { role: 'member', status: 'suspended' },
};

/** Cuatro ápices de «author» y uno público de «member»; cada combinación de visibilidad y archivo. */
const APICES = [
  { id: 'pub', authorUid: 'author', visibility: 'public', isArchived: false },
  { id: 'priv', authorUid: 'author', visibility: 'private', isArchived: false },
  { id: 'arch-pub', authorUid: 'author', visibility: 'public', isArchived: true },
  { id: 'arch-priv', authorUid: 'author', visibility: 'private', isArchived: true },
  { id: 'other-pub', authorUid: 'member', visibility: 'public', isArchived: false },
];

const dbOf = (who: Who) =>
  who === 'visitor' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(who).firestore();

const apices = (who: Who) => collection(dbOf(who), 'apices');

async function idsOf(who: Who, ...constraints: Parameters<typeof query>[1][]): Promise<string[]> {
  const snap = await getDocs(query(apices(who), ...constraints));
  return snap.docs.map((d) => d.id).sort();
}

const PUBLIC_LIVE = [where('visibility', '==', 'public'), where('isArchived', '==', false)] as const;

beforeAll(async () => {
  env = await createTestEnvironment();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, account] of Object.entries(ACCOUNTS)) {
      await setDoc(doc(db, `accounts/${uid}`), {
        email: `${uid}@ejemplo.org`,
        name: uid,
        username: uid,
        ...account,
      });
    }
    for (const { id, ...apice } of APICES) await setDoc(doc(db, `apices/${id}`), { name: id, version: 1, ...apice });
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules · consultas del descubrimiento', () => {
  it('RF-21 (001): un visitante lista lo público y no archivado, y solo eso', async () => {
    expect(await idsOf('visitor', ...PUBLIC_LIVE)).toEqual(['other-pub', 'pub']);
  });

  it('RF-21 (001): una consulta de visitante sin «visibility == public» o sin «isArchived == false» se deniega', async () => {
    await assertFails(getDocs(query(apices('visitor'))));
    await assertFails(getDocs(query(apices('visitor'), where('isArchived', '==', false))));
    await assertFails(getDocs(query(apices('visitor'), where('visibility', '==', 'public'))));
    await assertFails(getDocs(query(apices('visitor'), where('visibility', '==', 'private'))));
    await assertFails(getDocs(query(apices('visitor'), where('isArchived', '==', true))));
  });

  it('RF-21 (001): una persona inscrita lista los no archivados, públicos y privados', async () => {
    expect(await idsOf('member', where('isArchived', '==', false))).toEqual(['other-pub', 'priv', 'pub']);
  });

  it('RF-21 (001): una persona inscrita no lista archivados ni sin condiciones', async () => {
    await assertFails(getDocs(query(apices('member'))));
    await assertFails(getDocs(query(apices('member'), where('isArchived', '==', true))));
    await assertFails(getDocs(query(apices('member'), where('visibility', '==', 'public'))));
  });

  it('RF-21 (001): la autora lista sus archivados y no los de otra persona', async () => {
    expect(await idsOf('author', where('authorUid', '==', 'author'), where('isArchived', '==', true))).toEqual([
      'arch-priv',
      'arch-pub',
    ]);
    await assertFails(getDocs(query(apices('author'), where('authorUid', '==', 'member'), where('isArchived', '==', true))));
    await assertFails(getDocs(query(apices('author'), where('isArchived', '==', true))));
  });

  it('RF-14 (001): quien no es autora ni facilitadora no ve archivados ni con su nombre en la consulta', async () => {
    await assertFails(getDocs(query(apices('member'), where('authorUid', '==', 'author'), where('isArchived', '==', true))));
  });

  it('RF-21 (001): la facilitadora lista todo, también archivados y sin condiciones', async () => {
    expect(await idsOf('facilitator')).toEqual(['arch-priv', 'arch-pub', 'other-pub', 'priv', 'pub']);
    expect(await idsOf('facilitator', where('isArchived', '==', true))).toEqual(['arch-priv', 'arch-pub']);
  });

  it('RF-13 (001): una cuenta suspendida solo lista lo público y no archivado', async () => {
    expect(await idsOf('suspended', ...PUBLIC_LIVE)).toEqual(['other-pub', 'pub']);
    await assertFails(getDocs(query(apices('suspended'), where('isArchived', '==', false))));
    await assertFails(getDocs(query(apices('suspended'))));
  });

  // D-T12 (003): «mis ápices» de Mi tablero, sin cambiar firestore.rules.
  const MINE = (uid: string) => [where('authorUid', '==', uid), where('isArchived', '==', false)] as const;

  it('RF-11 (003) · 11.2: la autora lista con «mis ápices» sus no archivados, también el privado, y ninguno ajeno', async () => {
    expect(await idsOf('author', ...MINE('author'))).toEqual(['priv', 'pub']);
  });

  it('RF-11 (003) · 11.2: una cuenta suspendida y un visitante reciben denegación con «mis ápices»', async () => {
    await assertFails(getDocs(query(apices('suspended'), ...MINE('suspended'))));
    await assertFails(getDocs(query(apices('visitor'), ...MINE('author'))));
  });
});
