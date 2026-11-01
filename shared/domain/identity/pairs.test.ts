// RF-2 (002), D-T3 (003): cada par obligatorio de §4.0 alcanza su umbral en los dos temas.
// RF-2 (003) · 2.2/2.4, RF-5 (003) · 5.1, RF-8 (003) · 8.4, RNF-1 (003): los pares que cambian en la 003.
import { describe, expect, it } from 'vitest';
import { failingPairs, REQUIRED_PAIRS } from './pairs';
import { THEMES, TOKENS, type TokenName } from './tokens';

const has = (fg: TokenName, bg: TokenName, threshold: number) =>
  REQUIRED_PAIRS.some((p) => p.fg === fg && p.bg === bg && p.threshold === threshold);

describe('pares obligatorios', () => {
  it('RF-2 (002) · 2.2: la tabla recoge los pares de §4.0 con su umbral', () => {
    for (const fg of ['text', 'text-muted'] as const)
      for (const bg of ['surface', 'background'] as const) expect(has(fg, bg, 4.5)).toBe(true);
    expect(has('action-blue', 'surface', 4.5) && has('action-blue', 'background', 4.5)).toBe(true);
    expect(has('brand-red', 'surface', 4.5)).toBe(true);
    expect(has('on-accent', 'action-blue', 4.5) && has('on-accent', 'brand-red', 4.5)).toBe(true);
    expect(has('focus', 'surface', 3) && has('focus', 'background', 3)).toBe(true);
    for (const axis of ['agua', 'alimento', 'cobijo', 'energia', 'comunicacion'])
      for (const bg of ['surface', 'charcoal'] as const)
        expect(has(`axis-${axis}-stroke` as TokenName, bg, 3), `${axis} sobre ${bg}`).toBe(true);
    expect(has('field-border', 'surface', 3)).toBe(true);
  });

  it('RF-2 (003) · 2.2/2.4: los logo-* no tienen par de contraste (D-12 (003))', () => {
    for (const pair of REQUIRED_PAIRS) {
      expect(pair.fg.startsWith('logo-'), `${pair.fg}/${pair.bg}`).toBe(false);
      expect(pair.bg.startsWith('logo-'), `${pair.fg}/${pair.bg}`).toBe(false);
    }
    expect(TOKENS.light['logo-gray']).toBe('#666666');
    expect(TOKENS.dark['logo-gray']).toBe('#FFFFFF');
    for (const theme of THEMES) {
      expect(TOKENS[theme]['logo-red']).toBe('#FF0000');
      expect(TOKENS[theme]['logo-blue']).toBe('#0096FF');
    }
  });

  it('RF-5 (003) · 5.1: field-border alcanza 3:1 sobre surface y sobre background', () => {
    expect(has('field-border', 'surface', 3) && has('field-border', 'background', 3)).toBe(true);
  });

  it('RF-8 (003) · 8.4: on-charcoal y on-charcoal-muted alcanzan 4,5:1 sobre charcoal', () => {
    expect(has('on-charcoal', 'charcoal', 4.5) && has('on-charcoal-muted', 'charcoal', 4.5)).toBe(true);
  });

  it('RNF-1 (003): text y text-muted se miden sobre surface y background, ya no sobre grid', () => {
    expect(REQUIRED_PAIRS.some((p) => (p.bg as string) === 'grid' || (p.bg as string) === 'plate')).toBe(false);
    expect(REQUIRED_PAIRS).toHaveLength(4 + 2 + 1 + 2 + 2 + 10 + 2 + 2);
  });

  it('RF-5 (003) · 5.1: falla si field-border claro baja de 3:1 sobre background', () => {
    const broken = { ...TOKENS.light, 'field-border': '#B0AEB8' };
    expect(failingPairs(broken).map((p) => `${p.fg}/${p.bg}`)).toContain('field-border/background');
  });

  it('RF-2 (002) · 2.2: todos los pares cumplen en los dos temas con los valores de plan §2 bis', () => {
    for (const theme of THEMES) expect(failingPairs(TOKENS[theme]), theme).toEqual([]);
  });

  it('RF-2 (002) · 2.2: falla si action-blue claro pasa al azul fiel del logo', () => {
    const broken = { ...TOKENS.light, 'action-blue': '#0096FF' };
    const failing = failingPairs(broken).map((p) => `${p.fg}/${p.bg}`);
    expect(failing).toContain('action-blue/surface');
    expect(failing).toContain('on-accent/action-blue');
  });
});
