// T-9.3 · Lista de documentos de 20 en 20, lectura de un documento y de sus versiones.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentsSource, documentExcerpt } from './documents';
import { fake, fakeDb } from './fakeFirestore';

vi.mock('firebase/firestore', async () => (await import('./fakeFirestore')).fakeFirestoreModule);

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const documentRow = (n: number, isArchived = false, body = `Cuerpo ${n}`) => ({
  id: `d${n}`,
  data: { title: `Doc ${n}`, text: body, version: 1, createdAt: ts(n), updatedAt: ts(n), isArchived },
});

beforeEach(() => fake.reset());

describe('documents.ts', () => {
  it('RF-5 (004) · 5.1: el extracto es de 200 caracteres y sin formato', () => {
    const body = `# Título\n\nUn **párrafo** con [un enlace](https://ejemplo.org) y \`código\`.\n\n- uno\n- dos\n\n${'x'.repeat(300)}`;
    const excerpt = documentExcerpt(body);
    expect(Array.from(excerpt)).toHaveLength(200);
    expect(excerpt.startsWith('Título Un párrafo con un enlace y código. uno dos xxx')).toBe(true);
    expect(excerpt).not.toMatch(/[#*`\[\]]/);
  });

  it('RF-5 (004) · 5.1: un Markdown que no se entiende igual da un extracto sin marcas', () => {
    expect(documentExcerpt('<b>hola</b> **mundo**')).toBe('<b>hola</b> mundo');
  });

  it('RF-5 (004) · 5.1: la lista trae solo los no archivados, de 20 en 20, y devuelve el cursor de la página siguiente', async () => {
    fake.set('constitutionDocuments', [
      ...Array.from({ length: 25 }, (_, i) => documentRow(i + 1)),
      documentRow(99, true),
    ]);
    const source = createDocumentsSource(fakeDb);
    const first = await source.fetchPage({ archived: false });
    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.id).toBe('d25'); // el más reciente primero
    expect(first.cursor).not.toBeNull();
    expect(fake.queries[0]?.cs).toContainEqual({ t: 'where', field: 'isArchived', op: '==', value: false });
    const second = await source.fetchPage({ archived: false, cursor: first.cursor });
    expect(second.items.map((i) => i.id)).toEqual(['d5', 'd4', 'd3', 'd2', 'd1']);
    expect(second.cursor).toBeNull();
  });

  it('RF-5 (004) · 5.1: la fila lleva el extracto y no el texto completo', async () => {
    fake.set('constitutionDocuments', [documentRow(1, false, '## Hola\n\nmundo')]);
    const page = await createDocumentsSource(fakeDb).fetchPage({ archived: false });
    expect(page.items[0]).toEqual({ id: 'd1', title: 'Doc 1', excerpt: 'Hola mundo', updatedAt: 1000, version: 1 });
  });

  it('RF-5 (004) · 5.1: quien facilita pide los archivados aparte', async () => {
    fake.set('constitutionDocuments', [documentRow(1), documentRow(2, true)]);
    const page = await createDocumentsSource(fakeDb).fetchPage({ archived: true });
    expect(page.items.map((i) => i.id)).toEqual(['d2']);
  });

  it('RF-5 (004) · 5.2: un documento se lee completo y uno ausente llega como null', () => {
    fake.set('constitutionDocuments', [documentRow(1, false, 'texto largo')]);
    const source = createDocumentsSource(fakeDb);
    const seen: unknown[] = [];
    source.onDocument('d1', (d) => seen.push(d));
    source.onDocument('nada', (d) => seen.push(d));
    expect(seen[0]).toMatchObject({ id: 'd1', text: 'texto largo', version: 1, isArchived: false, createdAt: 1000 });
    expect(seen[1]).toBeNull();
  });

  it('RF-5 (004) · 5.4: las versiones de un documento llegan de la más reciente a la primera', () => {
    fake.set('constitutionDocuments/d1/versions', [
      { id: '1', data: { version: 1, title: 'a', text: 'x', byUid: 'u', byUsername: 'ana', at: ts(1) } },
      { id: '2', data: { version: 2, title: 'b', text: 'y', byUid: 'u', byUsername: 'ana', at: ts(2) } },
    ]);
    let versions: { version: number }[] = [];
    createDocumentsSource(fakeDb).onVersions('d1', (v) => (versions = v));
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
  });
});
