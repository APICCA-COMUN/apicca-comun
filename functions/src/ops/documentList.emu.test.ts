// T-5.4 (004): la lista de documentos con la consulta de `queries.ts` (RF-5 (004) · 5.1, D-T14 (004)).
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { documentsQuery } from '../../../shared/domain/constitution';
import { EXCERPT_LENGTH, type QueryShape } from '../../../shared/domain/discovery';
import { excerpt } from '../../../shared/domain/textFormat';
import { clearEmulators, createTestCtx, type TestCtx } from '../testing';
import { seedDocuments } from '../testing/constitutionKit';

let ctx: TestCtx;

/** Traduce la forma declarada a una consulta del Admin SDK, con tandas por cursor. */
function build(shape: QueryShape, after?: FirebaseFirestore.DocumentSnapshot): Query {
  let query: Query = ctx.db.collection(shape.collection);
  for (const condition of shape.conditions) query = query.where(condition.field, condition.op as '==', condition.value);
  if (shape.orderBy !== undefined) query = query.orderBy(shape.orderBy.field, shape.orderBy.direction);
  if (after !== undefined) query = query.startAfter(after);
  return shape.limit === undefined ? query : query.limit(shape.limit);
}

async function pages(archived: boolean) {
  const shape = documentsQuery({ archived });
  const out: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
  let last: FirebaseFirestore.DocumentSnapshot | undefined;
  for (;;) {
    const page = (await build(shape, last).get()).docs;
    if (page.length === 0) break;
    out.push(page);
    last = page[page.length - 1];
    if (page.length < (shape.limit ?? Infinity)) break;
  }
  return out;
}

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
});

describe('lista de documentos', () => {
  it('RF-5 (004) · 5.1: con 45 documentos no archivados da páginas de 20, 20 y 5 por `updatedAt` descendente, sin los archivados', async () => {
    const docs = Array.from({ length: 45 }, (_, i) => ({
      id: `d${String(i).padStart(2, '0')}`,
      updatedAt: new Date(Date.UTC(2026, 7, 1, 0, i)),
    }));
    await seedDocuments(ctx, [...docs, { id: 'viejo', isArchived: true, updatedAt: new Date('2026-09-01T00:00:00Z') }]);
    const result = await pages(false);
    expect(result.map((p) => p.length)).toEqual([20, 20, 5]);
    const ids = result.flat().map((d) => d.id);
    expect(ids[0]).toBe('d44');
    expect(ids[44]).toBe('d00');
    expect(ids).not.toContain('viejo');
    const times = result.flat().map((d) => (d.get('updatedAt') as Timestamp).toMillis());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect((await pages(true)).flat().map((d) => d.id)).toEqual(['viejo']);
  });

  it('RF-5 (004) · 5.1: cada fila lleva título, fecha y un extracto de 200 caracteres sin marcas de formato', async () => {
    const text = `**Negrita** y *cursiva* con [un enlace](https://ejemplo.org/a).\n\n- uno\n- dos\n\n${'palabra '.repeat(80)}`;
    await seedDocuments(ctx, [{ id: 'd1', title: 'Con formato', text, updatedAt: new Date('2026-08-20T09:00:00Z') }]);
    const [row] = (await pages(false)).flat();
    const snippet = excerpt(row?.get('text') as string, EXCERPT_LENGTH);
    expect(row?.get('title')).toBe('Con formato');
    expect((row?.get('updatedAt') as Timestamp).toDate().toISOString()).toBe('2026-08-20T09:00:00.000Z');
    expect(Array.from(snippet)).toHaveLength(EXCERPT_LENGTH);
    expect(snippet.startsWith('Negrita y cursiva con un enlace.')).toBe(true);
    expect(snippet).not.toMatch(/\*|\]\(|https:/);
  });
});
