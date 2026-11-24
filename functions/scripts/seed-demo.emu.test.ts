// T-1 (022): la siembra de demostración contra los emuladores (RF-2 (022), RF-4 (022)). Siembra una vez y mide cada
// pantalla; al final siembra de nuevo y compara.
import { Timestamp, type CollectionReference, type Firestore } from 'firebase-admin/firestore';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCtx, TEST_PROJECT_ID, type TestCtx } from '../src/testing';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo, type DemoSummary } from './seed-demo';

const TODAY = new Date('2026-11-11T15:00:00Z');
const AUTH = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';
const SLOW = 120_000;

let ctx: TestCtx;
let seeded: DemoSummary;

type Data = Record<string, unknown>;
const all = async (path: string): Promise<Data[]> => (await ctx.db.collection(path).get()).docs.map((doc) => doc.data());
const located = (apice: Data) => apice['location'] as { lat: number; lng: number; zone?: { cell: string } } | null;

/** Cuántos documentos deja la siembra en cada colección que se ve en el sitio. */
async function summary(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const path of ['accounts', 'apices', 'commonActions', 'threads', 'constitutionSections', 'constitutionDocuments', 'amendments', 'enrollmentRequests', 'invitations']) {
    counts[path] = (await ctx.db.collection(path).count().get()).data().count;
  }
  return counts;
}

beforeAll(async () => {
  ctx = createTestCtx({ now: TODAY });
  seeded = await seedDemo(ctx, { projectId: TEST_PROJECT_ID, today: TODAY });
}, SLOW);

describe('seed-demo · contenido', () => {
  it('RF-2 (022) · 2.1: cinco cuentas activas, una de facilitación, y cada una entra con su contraseña', async () => {
    const accounts = await all('accounts');
    expect(accounts).toHaveLength(5);
    expect(accounts.filter((account) => account['role'] === 'facilitator')).toHaveLength(1);
    expect(accounts.every((account) => account['status'] === 'active')).toBe(true);
    expect(DEMO_ACCOUNTS).toHaveLength(5);
    for (const account of DEMO_ACCOUNTS) {
      const response = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: DEMO_PASSWORD, returnSecureToken: true }),
      });
      expect(response.status, account.email).toBe(200);
    }
  });

  it('RF-2 (022) · 2.2: el mapa tiene los cinco ejes, las tres etapas, varias manzanas, una con más de siete, y dos sin ubicación', async () => {
    const apices = await all('apices');
    const shown = apices.filter((apice) => apice['visibility'] === 'public' && apice['isArchived'] === false);
    expect(new Set(shown.flatMap((apice) => apice['axes'] as string[]))).toEqual(new Set(['agua', 'alimento', 'cobijo', 'energía', 'comunicación']));
    expect(new Set(shown.map((apice) => apice['status']))).toEqual(new Set(['idea', 'prototipo', 'en marcha']));
    const cells = new Map<string, number>();
    for (const apice of shown) {
      const cell = located(apice)?.zone?.cell;
      if (cell !== undefined) cells.set(cell, (cells.get(cell) ?? 0) + 1);
    }
    expect(cells.size).toBeGreaterThanOrEqual(4);
    expect(Math.max(...cells.values())).toBeGreaterThan(7);
    expect(shown.filter((apice) => located(apice) === null)).toHaveLength(2);
    expect(apices.filter((apice) => apice['visibility'] === 'private')).toHaveLength(1);
    expect(apices.filter((apice) => apice['isArchived'] === true)).toHaveLength(1);
    expect(apices.filter((apice) => (apice['version'] as number) >= 3).length).toBeGreaterThanOrEqual(3);
  });

  it('RF-2 (022) · 2.3: cuatro caminos: dos abiertos con tres participantes o más, uno cerrado y uno entre zonas lejanas', async () => {
    const actions = await all('commonActions');
    expect(actions).toHaveLength(4);
    expect(actions.filter((action) => action['status'] === 'abierta' && (action['participantCount'] as number) >= 3).length).toBeGreaterThanOrEqual(2);
    expect(actions.filter((action) => action['status'] === 'cerrada')).toHaveLength(1);
    const apices = new Map((await ctx.db.collection('apices').get()).docs.map((doc) => [doc.id, doc.data()]));
    /** La mayor distancia, en grados, entre dos ápices del camino. */
    const span = (action: Data) => {
      const points = (action['apiceIds'] as string[]).map((id) => located(apices.get(id) ?? {})).filter((point) => point != null);
      return Math.max(0, ...points.flatMap((a) => points.map((b) => Math.hypot(a.lat - b.lat, a.lng - b.lng))));
    };
    expect(actions.some((action) => span(action) > 0.1)).toBe(true);
  });

  it('RF-2 (022) · 2.4: la Plaza tiene hilos en tres ejes, respuestas de varias personas, un mensaje editado y uno archivado', async () => {
    const threads = (await ctx.db.collection('threads').get()).docs;
    expect(new Set(threads.map((thread) => thread.get('axis'))).size).toBeGreaterThanOrEqual(3);
    const messages = (await Promise.all(threads.map((thread) => thread.ref.collection('messages').get()))).flatMap((snap) => snap.docs.map((doc) => doc.data()));
    const voices = await Promise.all(threads.map(async (thread) => new Set((await thread.ref.collection('messages').get()).docs.map((doc) => doc.get('authorUid'))).size));
    expect(Math.max(...voices)).toBeGreaterThanOrEqual(3);
    expect(messages.some((message) => message['editedAt'] != null)).toBe(true);
    expect(messages.filter((message) => message['isArchived'] === true)).toHaveLength(1);
  });

  it('RF-2 (022) · 2.5: la constitución está abierta, con secciones, un documento, una propuesta abierta deliberada y una cerrada', async () => {
    expect((await ctx.db.doc('constitution/state').get()).get('isOpen')).toBe(true);
    expect((await all('constitutionSections')).length).toBeGreaterThanOrEqual(3);
    expect((await all('constitutionDocuments')).length).toBeGreaterThanOrEqual(1);
    const amendments = (await ctx.db.collection('amendments').get()).docs;
    const open = amendments.filter((doc) => doc.get('isOpen') === true);
    expect(open).toHaveLength(1);
    const [ref] = open.map((doc) => doc.ref);
    expect((await ref!.collection('comments').count().get()).data().count).toBeGreaterThanOrEqual(2);
    expect((await ref!.collection('stances').where('agreement', '==', 'active').count().get()).data().count).toBeGreaterThanOrEqual(1);
    expect((await ref!.collection('objections').count().get()).data().count).toBeGreaterThanOrEqual(1);
    expect(amendments.filter((doc) => doc.get('isOpen') === false && doc.get('closedAt') != null).length).toBeGreaterThanOrEqual(1);
  });

  it('RF-2 (022) · 2.6: una solicitud y una invitación pendientes, y avisos sin ver', async () => {
    expect((await all('enrollmentRequests')).filter((request) => request['status'] === 'pending')).toHaveLength(1);
    expect((await all('invitations')).filter((invitation) => invitation['status'] === 'pending')).toHaveLength(1);
    let unseen = 0;
    for (const account of (await ctx.db.collection('accounts').get()).docs) {
      const seenAt = account.get('noticesSeenAt') as { toMillis(): number } | undefined;
      const items = await all(`notices/${account.id}/items`);
      unseen += items.filter((item) => seenAt === undefined || (item['createdAt'] as { toMillis(): number }).toMillis() > seenAt.toMillis()).length;
    }
    expect(unseen).toBeGreaterThan(0);
  });

  it('RF-1 (022) · 1.3: el resumen sale de lo sembrado: separa los ápices en públicos, privados y archivados y cuenta caminos e hilos', async () => {
    const apices = await all('apices');
    expect(seeded.apices).toEqual({
      public: apices.filter((apice) => apice['visibility'] === 'public' && apice['isArchived'] === false).length,
      private: apices.filter((apice) => apice['visibility'] === 'private' && apice['isArchived'] === false).length,
      archived: apices.filter((apice) => apice['isArchived'] === true).length,
    });
    expect(seeded.apices.public + seeded.apices.private + seeded.apices.archived).toBe(apices.length);
    expect(seeded.actions).toBe((await all('commonActions')).length);
    expect(seeded.threads).toBe((await all('threads')).length);
  });

  it('RF-4 (022) · 4.1: los ápices llevan la forma que escriben las operaciones: versión, zona calculada y autoría', async () => {
    const apices = (await ctx.db.collection('apices').get()).docs;
    for (const apice of apices) {
      expect((await apice.ref.collection('versions').count().get()).data().count, apice.id).toBe(apice.get('version'));
      const location = located(apice.data());
      if (location !== null) expect(location.zone?.cell, apice.id).toMatch(/^[0-9a-f]{15}$/);
      expect(DEMO_ACCOUNTS.map((account) => account.uid)).toContain(apice.get('authorUid'));
    }
  });

  it(
    'RF-4 (022) · 4.2: sembrar otra vez deja lo mismo',
    async () => {
      const before = await summary();
      await seedDemo(ctx, { projectId: TEST_PROJECT_ID, today: TODAY });
      expect(await summary()).toEqual(before);
    },
    SLOW,
  );
});

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Milisegundos desde la medianoche de Bogotá (UTC-5, sin horario de verano). */
const bogotaTimeOfDay = (ms: number): number => (((ms - 5 * HOUR_MS) % DAY_MS) + DAY_MS) % DAY_MS;
const bogotaClock = (ms: number): string => new Date(ms - 5 * HOUR_MS).toISOString().replace('T', ' ').slice(0, 16);
/** Plazos que la operación calcula hacia adelante (la propuesta abierta sigue abierta; la solicitud y la invitación caducan): no son momentos que ya ocurrieron. */
const DEADLINES = new Set(['closesAt', 'expiresAt']);

/** Todos los instantes guardados en Firestore, con su ruta, bajando por las subcolecciones. */
async function moments(db: Firestore): Promise<{ path: string; field: string; ms: number }[]> {
  const found: { path: string; field: string; ms: number }[] = [];
  const walk = (path: string, field: string, value: unknown): void => {
    if (value instanceof Timestamp) found.push({ path, field, ms: value.toMillis() });
    else if (Array.isArray(value)) value.forEach((item, index) => walk(path, `${field}[${index}]`, item));
    else if (value !== null && typeof value === 'object') for (const [key, inner] of Object.entries(value)) walk(path, `${field}.${key}`, inner);
  };
  const visit = async (collections: CollectionReference[]): Promise<void> => {
    for (const collection of collections) {
      for (const doc of (await collection.get()).docs) {
        for (const [key, value] of Object.entries(doc.data())) walk(doc.ref.path, key, value);
        await visit(await doc.ref.listCollections());
      }
    }
  };
  await visit(await db.listCollections());
  return found;
}

describe('seed-demo · horas de corrida', () => {
  // Hora de Bogotá de cada corrida: 03:00 (antes de las 5:00), 08:00 justas, 10:00, 20:30 y 23:50 (cerca de la medianoche).
  const RUNS = [
    ['03:00 de Bogotá', '2026-11-16T08:00:00Z'],
    ['08:00 de Bogotá', '2026-11-16T13:00:00Z'],
    ['10:00 de Bogotá', '2026-11-16T15:00:00Z'],
    ['20:30 de Bogotá', '2026-11-17T01:30:00Z'],
    ['23:50 de Bogotá', '2026-11-17T04:50:00Z'],
  ] as const;

  for (const [label, iso] of RUNS) {
    it(
      `RF-5 (022) · 5.1, 5.2: corrida a las ${label}: todo momento sembrado cae entre las 8:00 y las 20:00 de Bogotá y ninguno queda en el futuro`,
      async () => {
        const today = new Date(iso);
        await seedDemo(ctx, { projectId: TEST_PROJECT_ID, today });
        const found = await moments(ctx.db);
        expect(found.length).toBeGreaterThan(100);
        const outside = found.filter(({ ms }) => bogotaTimeOfDay(ms) < 8 * HOUR_MS || bogotaTimeOfDay(ms) > 20 * HOUR_MS);
        expect(outside.map(({ path, field, ms }) => `${path} ${field} ${bogotaClock(ms)}`)).toEqual([]);
        const future = found.filter(({ field, ms }) => !DEADLINES.has(field.split('.').pop() ?? field) && ms > today.getTime());
        expect(future.map(({ path, field, ms }) => `${path} ${field} ${bogotaClock(ms)}`)).toEqual([]);
      },
      SLOW,
    );
  }
});

describe('seed-demo · operación rechazada', () => {
  it(
    'RF-4 (022) · 4.3: si una operación es rechazada, la siembra se detiene con un error que la nombra y no sigue',
    async () => {
      const broken = { ...ctx, now: () => { throw new Error('reloj roto'); } };
      await expect(seedDemo(broken, { projectId: TEST_PROJECT_ID, today: TODAY })).rejects.toThrow(/createApice «Huerta de la Candelaria»/);
      expect(await all('apices')).toHaveLength(0);
      expect(await all('commonActions')).toHaveLength(0);
      expect(await all('threads')).toHaveLength(0);
    },
    SLOW,
  );
});
