import { describe, expect, it, vi } from 'vitest';
import { createDrafts } from './drafts';

describe('borradores en memoria', () => {
  it('RNF-10 (001): guarda, devuelve y borra lo escrito por clave', () => {
    const drafts = createDrafts();
    expect(drafts.get('ficha')).toBeUndefined();
    drafts.set('ficha', 'texto a medias');
    expect(drafts.get('ficha')).toBe('texto a medias');
    expect(drafts.hasAny()).toBe(true);
    drafts.clear('ficha');
    expect(drafts.hasAny()).toBe(false);
  });

  it('RNF-10 (001): un borrador vacío no cuenta como trabajo a conservar', () => {
    const drafts = createDrafts();
    drafts.set('ficha', '');
    expect(drafts.hasAny()).toBe(false);
  });

  it('RNF-10 (001): clearAll vacía todo y avisa a quien escucha', () => {
    const drafts = createDrafts();
    const listener = vi.fn();
    drafts.subscribe(listener);
    drafts.set('a', 'x');
    drafts.set('b', 'y');
    drafts.clearAll();
    expect(drafts.hasAny()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
