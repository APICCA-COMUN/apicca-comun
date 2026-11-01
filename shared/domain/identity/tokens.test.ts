// RNF-4 (002), RF-2 (002): los tokens de §4.0 viven en un solo módulo, con valor en los dos temas.
// RF-1 (003) · 1.1, 1.2, RF-2 (003) · 2.2, 2.3, D-T2 (003): los valores de §4.0 (003) sustituyen a los de la 002.
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './color';
import { MAP_TINT, THEMES, TOKENS, TOKEN_NAMES, TYPE_SCALE } from './tokens';

const ms = (value: string): number => {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value);
  if (!match) throw new Error(`Duración inválida: ${value}`);
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
};

describe('tokens', () => {
  it('RNF-4 (002): los dos temas tienen exactamente los mismos nombres de token', () => {
    expect(Object.keys(TOKENS.light).sort()).toEqual(Object.keys(TOKENS.dark).sort());
    expect([...TOKEN_NAMES].sort()).toEqual(Object.keys(TOKENS.light).sort());
  });

  it('RNF-4 (002): están todos los tokens de la tabla de §4.0, con los cinco ejes', () => {
    const axisKeys = ['agua', 'alimento', 'cobijo', 'energia', 'comunicacion'];
    const expected = [
      'background', 'line', 'surface', 'text', 'text-muted', 'charcoal', 'on-charcoal', 'on-charcoal-muted',
      'brand-red', 'action-blue', 'on-accent', 'field-border', 'focus', 'logo-gray', 'logo-red', 'logo-blue',
      ...axisKeys.flatMap((k) => [`axis-${k}-fill`, `axis-${k}-stroke`]),
      'radius-block', 'radius-lot', 'radius-building', 'shadow-block', 'shadow-raised', 'duration-raise',
      'footer-bg', 'size-control', 'size-icon-control', 'focus-offset', 'content-max',
    ];
    expect([...TOKEN_NAMES].sort()).toEqual(expected.sort());
  });

  it('RNF-4 (002): los valores de plan §2 bis (muestra)', () => {
    expect(TOKENS.light['action-blue']).toBe('#005FB8');
    expect(TOKENS.dark['axis-energia-fill']).toBe('#E8B730');
    expect(TOKENS.light['axis-energia-stroke']).toBe('#A88300');
  });

  it('RF-1 (003) · 1.1, 1.2: background claro Niebla y oscuro azul noche', () => {
    expect(TOKENS.light.background).toBe('#E8E7EC');
    expect(TOKENS.dark.background).toBe('#14213D');
  });

  it('RF-1 (003) · 1.3: grid y plate ya no existen en ningún tema', () => {
    for (const theme of THEMES) {
      expect(Object.keys(TOKENS[theme])).not.toContain('grid');
      expect(Object.keys(TOKENS[theme])).not.toContain('plate');
    }
    expect(TOKEN_NAMES).not.toContain('grid' as never);
    expect(TOKEN_NAMES).not.toContain('plate' as never);
  });

  it('RF-2 (003) · 2.2, 2.3: logo-gray gris en claro y blanco en oscuro; el rojo y el azul fieles en ambos', () => {
    expect(TOKENS.light['logo-gray']).toBe('#666666');
    expect(TOKENS.dark['logo-gray']).toBe('#FFFFFF');
    for (const theme of THEMES) {
      expect(TOKENS[theme]['logo-red']).toBe('#FF0000');
      expect(TOKENS[theme]['logo-blue']).toBe('#0096FF');
    }
  });

  it('RF-3 (003) · 3.1, D-T2 (003): line, on-charcoal y on-charcoal-muted con los valores de §4.0', () => {
    expect(TOKENS.light.line).toBe('#D8D7DE');
    expect(TOKENS.dark.line).toBe('#2A3A5E');
    for (const theme of THEMES) {
      expect(TOKENS[theme]['on-charcoal']).toBe('#F3EFE6');
      expect(TOKENS[theme]['on-charcoal-muted']).toBe('#C4BDB0');
    }
  });

  it('RF-3 (003) · 3.1, D-T2 (003): radius-block y las dos sombras con los valores de §4.0', () => {
    for (const theme of THEMES) expect(TOKENS[theme]['radius-block']).toBe('14px');
    expect(TOKENS.light['shadow-block']).toBe('10px 10px 0 rgb(20 33 61 / .13)');
    expect(TOKENS.dark['shadow-block']).toBe('10px 10px 0 rgb(0 0 0 / .32)');
    expect(TOKENS.light['shadow-raised']).toBe('18px 18px 0 rgb(20 33 61 / .13)');
    expect(TOKENS.dark['shadow-raised']).toBe('18px 18px 0 rgb(0 0 0 / .32)');
  });

  it('RF-2 (005) · 2.1, 2.2, D-T1 (005): radius-lot vale 18 px en los dos temas', () => {
    for (const theme of THEMES) expect(TOKENS[theme]['radius-lot']).toBe('18px');
  });

  it('RNF-4 (002): MAP_TINT tiene valor para los dos temas', () => {
    for (const theme of THEMES) expect(MAP_TINT[theme]).toMatch(/\S/);
  });

  it('RNF-4 (002): duration-raise no pasa de 200 ms en ningún tema (límite de §4.0)', () => {
    for (const theme of THEMES) expect(ms(TOKENS[theme]['duration-raise'])).toBeLessThanOrEqual(200);
  });

  it('RNF-4 (002): los colores son hexadecimales de seis cifras', () => {
    for (const theme of THEMES) {
      for (const [name, value] of Object.entries(TOKENS[theme])) {
        if (/^(radius|shadow|duration|size|content)-|^focus-offset$/.test(name)) continue;
        expect(value, `${theme} ${name}`).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it('RF-1 (008) · 1.1, 1.3: footer-bg vale charcoal en claro y azul profundo en oscuro', () => {
    expect(TOKENS.light['footer-bg']).toBe('#33363B');
    expect(TOKENS.dark['footer-bg']).toBe('#0E1830');
  });

  it('RF-1 (008) · 1.1, 1.3: las medidas nuevas valen lo mismo que en el sistema de diseño, en los dos temas', () => {
    for (const theme of THEMES) {
      expect(TOKENS[theme]['radius-building']).toBe('10px');
      expect(TOKENS[theme]['size-control']).toBe('48px');
      expect(TOKENS[theme]['size-icon-control']).toBe('44px');
      expect(TOKENS[theme]['focus-offset']).toBe('3px');
      expect(TOKENS[theme]['content-max']).toBe('1200px');
    }
  });

  it('RF-1 (008) · 1.2: la escala de texto tiene los diez estilos con tamaño, altura de línea y peso', () => {
    expect(TYPE_SCALE).toEqual({
      display: { size: '48px', line: '1.1', weight: '800' },
      numeral: { size: '34px', line: '1', weight: '800' },
      heading: { size: '28px', line: '1.2', weight: '800' },
      'doc-heading': { size: '24px', line: '1.25', weight: '800' },
      title: { size: '22px', line: '1.2', weight: '800' },
      subheading: { size: '20px', line: '1.25', weight: '700' },
      lead: { size: '18px', line: '1.5', weight: '400' },
      body: { size: '16px', line: '1.5', weight: '400' },
      label: { size: '15px', line: '1.5', weight: '700' },
      meta: { size: '14px', line: '1.5', weight: '400' },
    });
  });

  it('RNF-1 (008): el texto del pie alcanza 4,5:1 sobre footer-bg y la inicial del avatar sobre axis-alimento-fill, en los dos temas', () => {
    for (const theme of THEMES) {
      const t = TOKENS[theme];
      expect(contrastRatio(t['on-charcoal'], t['footer-bg']), `${theme} on-charcoal`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t['on-charcoal-muted'], t['footer-bg']), `${theme} on-charcoal-muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.charcoal, t['axis-alimento-fill']), `${theme} avatar`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
