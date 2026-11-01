// Doble de `firebase/firestore` para probar las fuentes de la constitución sin emulador: ejecuta en memoria las
// consultas que arman (`where`, `orderBy`, `limit`, `startAfter`) y anota cada lectura. Solo lo importan las pruebas.
import type { Firestore } from 'firebase/firestore';
import { isTimestampLike } from '../../../shared/domain/order';

type Row = { id: string; data: Record<string, unknown> };
type Constraint =
  | { t: 'where'; field: string; op: string; value: unknown }
  | { t: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { t: 'limit'; n: number }
  | { t: 'startAfter'; id: string };

export interface FakeQuery {
  kind: 'query' | 'collection';
  path: string;
  cs: Constraint[];
}
export interface FakeDocRef {
  kind: 'doc';
  path: string;
}

/** Contenido por ruta de colección (`amendments`, `amendments/a1/comments`…). */
export const fake = {
  data: {} as Record<string, Row[]>,
  /** Cada ruta que se leyó (colección, documento o conteo), en orden. */
  reads: [] as string[],
  /** Cada consulta armada, con sus restricciones. */
  queries: [] as FakeQuery[],
  reset(): void {
    this.data = {};
    this.reads = [];
    this.queries = [];
  },
  set(path: string, rows: Row[]): void {
    this.data[path] = rows;
  },
};

export const fakeDb = {} as Firestore;

const key = (v: unknown): number | string | boolean => (isTimestampLike(v) ? v.seconds * 1e9 + v.nanoseconds : (v as number | string | boolean));

function run(q: FakeQuery): Row[] {
  let rows = [...(fake.data[q.path] ?? [])];
  for (const c of q.cs) {
    if (c.t !== 'where') continue;
    rows = rows.filter((r) => {
      const a = key(r.data[c.field]);
      const b = key(c.value);
      return c.op === '==' ? a === b : c.op === '<=' ? a <= b : c.op === '>=' ? a >= b : c.op === '<' ? a < b : a > b;
    });
  }
  const order = q.cs.find((c): c is Extract<Constraint, { t: 'orderBy' }> => c.t === 'orderBy');
  if (order) {
    const sign = order.direction === 'asc' ? 1 : -1;
    rows.sort((x, y) => (key(x.data[order.field]) < key(y.data[order.field]) ? -sign : key(x.data[order.field]) > key(y.data[order.field]) ? sign : 0));
  }
  const after = q.cs.find((c): c is Extract<Constraint, { t: 'startAfter' }> => c.t === 'startAfter');
  if (after) rows = rows.slice(rows.findIndex((r) => r.id === after.id) + 1);
  const cap = q.cs.find((c): c is Extract<Constraint, { t: 'limit' }> => c.t === 'limit');
  return cap ? rows.slice(0, cap.n) : rows;
}

const docSnap = (row: Row) => ({ id: row.id, exists: () => true, data: () => row.data });
const missing = (id: string) => ({ id, exists: () => false, data: () => undefined });

function findDoc(path: string): Row | undefined {
  const i = path.lastIndexOf('/');
  return (fake.data[path.slice(0, i)] ?? []).find((r) => r.id === path.slice(i + 1));
}

/** Se usa con `vi.mock('firebase/firestore', async () => (await import('./fakeFirestore')).fakeFirestoreModule)`. */
export const fakeFirestoreModule = {
  collection: (_db: unknown, ...segments: string[]): FakeQuery => ({ kind: 'collection', path: segments.join('/'), cs: [] }),
  doc: (_db: unknown, ...segments: string[]): FakeDocRef => ({ kind: 'doc', path: segments.join('/') }),
  where: (field: string, op: string, value: unknown): Constraint => ({ t: 'where', field, op, value }),
  orderBy: (field: string, direction: 'asc' | 'desc' = 'asc'): Constraint => ({ t: 'orderBy', field, direction }),
  limit: (n: number): Constraint => ({ t: 'limit', n }),
  startAfter: (snapshot: { id: string }): Constraint => ({ t: 'startAfter', id: snapshot.id }),
  query: (base: FakeQuery, ...cs: Constraint[]): FakeQuery => {
    const built: FakeQuery = { kind: 'query', path: base.path, cs };
    fake.queries.push(built);
    return built;
  },
  async getDocs(q: FakeQuery) {
    fake.reads.push(q.path);
    return { docs: run(q).map(docSnap) };
  },
  async getDoc(ref: FakeDocRef) {
    fake.reads.push(ref.path);
    const row = findDoc(ref.path);
    return row ? docSnap(row) : missing(ref.path);
  },
  async getCountFromServer(q: FakeQuery) {
    fake.reads.push(q.path);
    return { data: () => ({ count: run(q).length }) };
  },
  count: () => ({ t: 'count' }),
  onSnapshot(target: FakeQuery | FakeDocRef, next: (snapshot: unknown) => void) {
    fake.reads.push(target.path);
    if (target.kind === 'doc') {
      const row = findDoc(target.path);
      next(row ? docSnap(row) : missing(target.path));
    } else {
      next({ docs: run(target).map(docSnap) });
    }
    return () => undefined;
  },
};
