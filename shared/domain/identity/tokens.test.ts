// RNF-4 (002), RF-2 (002): los tokens de §4.0 viven en un solo módulo, con valor en los dos temas.
// RF-1 (003) · 1.1, 1.2, RF-2 (003) · 2.2, 2.3, D-T2 (003): los valores de §4.0 (003) sustituyen a los de la 002.
// RF-1 (021) · 1.3, D-T7 (021): el contrato ya no define la paleta del terreno.
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './color';
import * as tokens from './tokens';
import { MAP_TINT, THEMES, TOKENS, TOKEN_NAMES, TYPE_SCALE, type TokenName } from './tokens';

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

  it('RNF-4 (002), D-T2 (019): están todos los tokens de la tabla de §4.0, con los cinco ejes y los de la 019', () => {
    const axisKeys = ['agua', 'alimento', 'cobijo', 'energia', 'comunicacion'];
    const expected = [
      'background', 'line', 'surface', 'text', 'text-muted', 'charcoal', 'on-charcoal', 'on-charcoal-muted',
      'brand-red', 'action-blue', 'on-accent', 'field-border', 'focus', 'logo-gray', 'logo-red', 'logo-blue',
      ...axisKeys.flatMap((k) => [`axis-${k}-fill`, `axis-${k}-stroke`]),
      'radius-block', 'radius-lot', 'radius-building', 'shadow-block', 'shadow-raised', 'duration-raise',
      'footer-bg', 'size-control', 'size-icon-control', 'focus-offset', 'content-max',
      'radius-pill', 'node-ring', 'veil',
      'trama', 'ruta', 'contorno-superficie', 'glifo-sobre-eje',
      'stroke-border', 'stroke-zone', 'stroke-outline', 'stroke-divider', 'focus-width',
    ];
    expect([...TOKEN_NAMES].sort()).toEqual(expected.sort());
  });

  it('RNF-4 (002): los valores de plan §2 bis (muestra)', () => {
    // Sistema «APICCA · Mapa»: la acción principal es tinta; los ejes son iguales en los dos temas.
    expect(TOKENS.light['action-blue']).toBe('#141414');
    expect(TOKENS.dark['axis-energia-fill']).toBe('#FFD200');
    expect(TOKENS.light['axis-energia-stroke']).toBe('#141414');
  });

  it('RF-1 (003) · 1.1, 1.2: background papel en claro y casi negro en oscuro (sistema «APICCA · Mapa»)', () => {
    expect(TOKENS.light.background).toBe('#FFFFFF');
    expect(TOKENS.dark.background).toBe('#121212');
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
    // line es la trama del sistema; charcoal es la tinta llena, que en oscuro se invierte.
    expect(TOKENS.light.line).toBe('#D3D3D3');
    expect(TOKENS.dark.line).toBe('#343434');
    expect(TOKENS.light['on-charcoal']).toBe('#FFFFFF');
    expect(TOKENS.dark['on-charcoal']).toBe('#121212');
  });

  it('RF-3 (003) · 3.1, D-T2 (003): radius-block 0 y sin sombras (sistema «APICCA · Mapa»)', () => {
    for (const theme of THEMES) {
      expect(TOKENS[theme]['radius-block']).toBe('0px');
      expect(TOKENS[theme]['shadow-block']).toBe('none');
      expect(TOKENS[theme]['shadow-raised']).toBe('none');
    }
  });

  it('RF-2 (005) · 2.1, 2.2, D-T1 (005): radius-lot vale 0 en los dos temas (sistema «APICCA · Mapa»)', () => {
    for (const theme of THEMES) expect(TOKENS[theme]['radius-lot']).toBe('0px');
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
        // `veil` lleva transparencia, como las sombras (D-T2 (019)).
        if (/^(radius|shadow|duration|size|content|stroke)-|^focus-(offset|width)$|^veil$/.test(name)) continue;
        expect(value, `${theme} ${name}`).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it('RF-1 (008) · 1.1, 1.3: footer-bg es tinta llena, invertida en oscuro', () => {
    expect(TOKENS.light['footer-bg']).toBe('#141414');
    expect(TOKENS.dark['footer-bg']).toBe('#FFFFFF');
  });

  it('RF-1 (008) · 1.1, 1.3: las medidas nuevas valen lo mismo que en el sistema de diseño, en los dos temas', () => {
    for (const theme of THEMES) {
      expect(TOKENS[theme]['radius-building']).toBe('0px');
      expect(TOKENS[theme]['size-control']).toBe('48px');
      expect(TOKENS[theme]['size-icon-control']).toBe('44px');
      expect(TOKENS[theme]['focus-offset']).toBe('3px');
      expect(TOKENS[theme]['content-max']).toBe('1200px');
    }
  });

  it('RF-1 (008) · 1.2, RF-2 (019) · 2.3, D-T3 (019): la escala de texto tiene los doce estilos con tamaño, altura de línea y peso; hero, display y heading son fluidos', () => {
    expect(TYPE_SCALE).toEqual({
      hero: { size: 'clamp(36px, 6.4vw, 80px)', line: '0.92', weight: '800' },
      display: { size: 'clamp(28px, 4vw, 38px)', line: '1.05', weight: '800' },
      numeral: { size: '34px', line: '1', weight: '800' },
      heading: { size: 'clamp(22px, 3vw, 27px)', line: '1.1', weight: '800' },
      'doc-heading': { size: '22px', line: '1.15', weight: '800' },
      title: { size: '20px', line: '1.1', weight: '800' },
      subheading: { size: '18px', line: '1.2', weight: '800' },
      lead: { size: '19px', line: '1.4', weight: '400' },
      body: { size: '16px', line: '1.5', weight: '400' },
      'label-primary': { size: '17px', line: '1.2', weight: '800' },
      label: { size: '15px', line: '1.2', weight: '800' },
      meta: { size: '14px', line: '1.3', weight: '400' },
    });
  });

  it('RNF-1 (008), RF-15 (019) · 15.1, D-T9 (019): el texto del pie alcanza 4,5:1 sobre footer-bg y la inicial (on-charcoal) sobre charcoal, en los dos temas', () => {
    for (const theme of THEMES) {
      const t = TOKENS[theme];
      expect(contrastRatio(t['on-charcoal'], t['footer-bg']), `${theme} on-charcoal`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t['on-charcoal-muted'], t['footer-bg']), `${theme} on-charcoal-muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t['on-charcoal'], t.charcoal), `${theme} inicial`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('RF-2 (019) · 2.3, D-T3 (019): los tamaños fluidos no pasan de 2,5 veces su mínimo (WCAG 1.4.4)', () => {
    for (const name of ['hero', 'display', 'heading'] as const) {
      const match = /^clamp\((\d+)px, [\d.]+vw, (\d+)px\)$/.exec(TYPE_SCALE[name].size);
      expect(match, name).not.toBeNull();
      expect(Number(match![2]) / Number(match![1]), name).toBeLessThanOrEqual(2.5);
    }
  });

  it('RF-3 (019) · 3.1, D-T2 (019): radius-pill vale 0 en los dos temas (sistema «APICCA · Mapa»: sin píldoras)', () => {
    for (const theme of THEMES) expect(TOKENS[theme]['radius-pill']).toBe('0px');
  });

  it('RF-20 (019) · 20.3, D-T2 (019), D-T13 (019): node-ring contrasta 3:1 o más con background y surface, en los dos temas', () => {
    expect(TOKENS.light['node-ring']).toBe('#141414');
    expect(TOKENS.dark['node-ring']).toBe('#FFFFFF');
    for (const theme of THEMES) {
      const t = TOKENS[theme];
      expect(contrastRatio(t['node-ring'], t.background), `${theme} fondo`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t['node-ring'], t.surface), `${theme} superficie`).toBeGreaterThanOrEqual(3);
    }
  });

  it('RF-14 (019) · 14.1, D-T2 (019): veil vela el fondo con transparencia en los dos temas', () => {
    expect(TOKENS.light.veil).toBe('rgb(20 20 20 / .55)');
    expect(TOKENS.dark.veil).toBe('rgb(0 0 0 / .65)');
  });
});

describe('RF-1 (021) · 1.3: sin paleta del terreno', () => {
  it('RF-1 (021) · 1.3, D-T7 (021): el contrato de tokens ya no exporta la paleta del terreno de RF-1 (019)', () => {
    expect(Object.keys(tokens).filter((name) => /terrain/i.test(name))).toEqual([]);
  });
});

describe('paleta «E3 · Celda»', () => {
  it('los cinco ejes valen lo mismo en claro y en oscuro, con el glifo en tinta', () => {
    const fills = { agua: '#0096FF', alimento: '#47C254', cobijo: '#FF8F00', energia: '#FFD200', comunicacion: '#FF0000' };
    for (const theme of THEMES) {
      for (const [k, v] of Object.entries(fills)) {
        expect(TOKENS[theme][`axis-${k}-fill` as TokenName], `${theme} ${k}`).toBe(v);
        expect(TOKENS[theme][`axis-${k}-stroke` as TokenName], `${theme} ${k} trazo`).toBe('#141414');
      }
      expect(TOKENS[theme]['glifo-sobre-eje']).toBe('#141414');
    }
  });

  it('papel, tinta, suave y trama en claro y en oscuro', () => {
    expect(TOKENS.light.surface).toBe('#FFFFFF');
    expect(TOKENS.light.text).toBe('#141414');
    expect(TOKENS.light['text-muted']).toBe('#666666');
    expect(TOKENS.light.trama).toBe('#D3D3D3');
    expect(TOKENS.light['on-charcoal-muted']).toBe('#D3D3D3');
    expect(TOKENS.light['on-accent']).toBe('#FFFFFF');
    expect(TOKENS.dark.surface).toBe('#121212');
    expect(TOKENS.dark.text).toBe('#FFFFFF');
    expect(TOKENS.dark['text-muted']).toBe('#B4B4B4');
    expect(TOKENS.dark.trama).toBe('#343434');
    expect(TOKENS.dark['on-charcoal-muted']).toBe('#343434');
    expect(TOKENS.dark['on-accent']).toBe('#121212');
    expect(TOKENS.dark['contorno-superficie']).toBe('#FFFFFF');
  });
});

describe('sistema «APICCA · Mapa»', () => {
  it('el glifo sobre cada eje alcanza 4,5:1 y la ruta deja leer el color del eje a 3:1, en los dos temas', () => {
    for (const theme of THEMES) {
      const t = TOKENS[theme];
      for (const k of ['agua', 'alimento', 'cobijo', 'energia', 'comunicacion'] as const) {
        const fill = t[`axis-${k}-fill`];
        expect(contrastRatio(t['glifo-sobre-eje'], fill), `${theme} glifo ${k}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(fill, t.ruta), `${theme} ruta ${k}`).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(t['contorno-superficie'], t.background), `${theme} contorno`).toBeGreaterThanOrEqual(3);
    }
  });
});
