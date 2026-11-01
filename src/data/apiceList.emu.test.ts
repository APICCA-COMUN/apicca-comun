// T-3.10 · Consultas paginadas por cursor contra el emulador (D-T17 (001)).
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PAGE_SIZE } from '../../shared/domain/discovery';
import { createTestEnvironment } from '../../tests/rules/setup';
import { createListSource } from './apices';

let env: RulesTestEnvironment;
const TOTAL = 30;

async function seed(): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (let i = 0; i < TOTAL; i += 1) {
      await setDoc(doc(db, `apices/a${String(i).padStart(2, '0')}`), {
        name: `Ápice ${i}`,
        description: 'Descripción',
        axes: i % 2 === 0 ? ['agua'] : ['energía'],
        status: i % 3 === 0 ? 'idea' : 'prototipo',
        visibility: i < 27 ? 'public' : 'private',
        isArchived: i === 5,
        authorUid: i < 10 ? 'u-ana' : 'u-beto',
        updatedAt: Timestamp.fromMillis(Date.parse('2026-09-01T00:00:00Z') + i * 60_000),
        image: null,
        version: 1,
      });
    }
  });
}

beforeAll(async () => {
  env = await createTestEnvironment();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});
afterAll(async () => {
  await env.cleanup();
});

describe('lista paginada de ápices', () => {
  it('RF-21 (001): pide 24 y la siguiente tanda con cursor, sin repetir ni omitir', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const source = createListSource(context.firestore() as never);
      const first = await source.fetchPage({ audience: 'member', filters: { axes: [], status: null } });
      expect(first.items).toHaveLength(PAGE_SIZE);
      expect(first.cursor).not.toBeNull();
      const second = await source.fetchPage({
        audience: 'member',
        filters: { axes: [], status: null },
        cursor: first.cursor,
      });
      // 30 ápices menos el archivado = 29: 24 + 5.
      expect(second.items).toHaveLength(5);
      expect(second.cursor).toBeNull();
      const ids = [...first.items, ...second.items].map((item) => item.id);
      expect(new Set(ids).size).toBe(29);
      expect(ids).not.toContain('a05');
      // Orden: del más reciente al más antiguo.
      expect(ids[0]).toBe('a29');
      expect(ids[28]).toBe('a00');
    });
  });

  it('RF-21 (001): el visitante solo recibe los públicos y no archivados', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const source = createListSource(context.firestore() as never);
      const page = await source.fetchPage({ audience: 'visitor', filters: { axes: [], status: null } });
      // 26 públicos no archivados: la primera tanda trae 24 y queda más.
      expect(page.items).toHaveLength(PAGE_SIZE);
      expect(page.items.every((item) => Number(item.id.slice(1)) < 27 && item.id !== 'a05')).toBe(true);
      expect(page.cursor).not.toBeNull();
    });
  });

  it('RF-21 (001): los filtros de eje y estado acotan la lista', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const source = createListSource(context.firestore() as never);
      const page = await source.fetchPage({
        audience: 'member',
        filters: { axes: ['agua'], status: 'idea' },
      });
      // Pares divisibles por 3 (múltiplos de 6): 0, 6, 12, 18, 24.
      expect(page.items.map((item) => item.id)).toEqual(['a24', 'a18', 'a12', 'a06', 'a00']);
    });
  });

  it('RF-21 (001): «archived-own» trae solo los archivados de la autora; «archived-all», todos', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const source = createListSource(context.firestore() as never);
      const own = await source.fetchPage({
        audience: 'archived-own',
        uid: 'u-ana',
        filters: { axes: [], status: null },
      });
      expect(own.items.map((item) => item.id)).toEqual(['a05']);
      const other = await source.fetchPage({
        audience: 'archived-own',
        uid: 'u-beto',
        filters: { axes: [], status: null },
      });
      expect(other.items).toEqual([]);
      const all = await source.fetchPage({ audience: 'archived-all', filters: { axes: [], status: null } });
      expect(all.items.map((item) => item.id)).toEqual(['a05']);
    });
  });

  it('RF-11 (003) · 11.2, 11.3: «mine» trae los propios públicos y privados, sin el archivado ni ajenos (D-T12 (003))', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const source = createListSource(context.firestore() as never);
      const ana = await source.fetchPage({ audience: 'mine', uid: 'u-ana', filters: { axes: [], status: null } });
      expect(ana.items.map((item) => item.id)).toEqual(['a09', 'a08', 'a07', 'a06', 'a04', 'a03', 'a02', 'a01', 'a00']);
      const beto = await source.fetchPage({ audience: 'mine', uid: 'u-beto', filters: { axes: [], status: null } });
      const ids = beto.items.map((item) => item.id);
      expect(ids).toHaveLength(20);
      expect(ids.slice(0, 3)).toEqual(['a29', 'a28', 'a27']);
      expect(ids.every((id) => Number(id.slice(1)) >= 10)).toBe(true);
    });
  });
});
