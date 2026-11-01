// Índice de la documentación (D-T14 (003)): orden aplanado, anterior y siguiente.
import { describe, expect, it } from 'vitest';
import { flattenIndex, neighbours, type DocsIndex } from './index';

const index: DocsIndex = {
  secciones: [
    { titulo: 'Empezar', articulos: [{ slug: 'a', archivo: '01-a.md' }, { slug: 'b', archivo: '02-b.md' }] },
    { titulo: 'Vacía', articulos: [] },
    { titulo: 'Ápices', articulos: [{ slug: 'c', archivo: '03-c.md' }] },
  ],
};

describe('RF-14 (003) · índice de la documentación (D-T14 (003))', () => {
  it('RF-14 (003) · 14.5: flattenIndex aplana secciones y artículos en orden, con su sección', () => {
    expect(flattenIndex(index)).toEqual([
      { slug: 'a', archivo: '01-a.md', section: 'Empezar' },
      { slug: 'b', archivo: '02-b.md', section: 'Empezar' },
      { slug: 'c', archivo: '03-c.md', section: 'Ápices' },
    ]);
  });

  it('RF-14 (003) · 14.5: un índice sin secciones se aplana a una lista vacía', () => {
    expect(flattenIndex({ secciones: [] })).toEqual([]);
  });

  it('RF-14 (003) · 14.5: neighbours devuelve anterior y siguiente (cruza secciones)', () => {
    const n = neighbours(index, 'b');
    expect(n?.current.slug).toBe('b');
    expect(n?.previous?.slug).toBe('a');
    expect(n?.next?.slug).toBe('c');
  });

  it('RF-14 (003) · 14.5: el primero no tiene anterior', () => {
    const n = neighbours(index, 'a');
    expect(n?.previous).toBeNull();
    expect(n?.next?.slug).toBe('b');
  });

  it('RF-14 (003) · 14.5: el último no tiene siguiente', () => {
    const n = neighbours(index, 'c');
    expect(n?.previous?.slug).toBe('b');
    expect(n?.next).toBeNull();
  });

  it('RF-14 (003) · 14.6: un slug desconocido devuelve null', () => {
    expect(neighbours(index, 'zzz')).toBeNull();
    expect(neighbours({ secciones: [] }, 'a')).toBeNull();
  });
});
