// RF-4 (002): cada eje tiene su clave, su relleno por tema y su trazo (D-4 (002), D-13 (002)).
import { describe, expect, it } from 'vitest';
import { AXES } from '../apice';
import { AXIS_IDENTITY } from './axes';
import { contrastRatio, deltaE2000 } from './color';
import { THEMES, TOKENS } from './tokens';

describe('identidad de los ejes', () => {
  it('RF-4 (002) · 4.1: cubre los cinco ejes en el orden de AXES, con claves sin tilde', () => {
    expect(AXIS_IDENTITY.map((a) => a.axis)).toEqual([...AXES]);
    expect(AXIS_IDENTITY.map((a) => a.key)).toEqual(['agua', 'alimento', 'cobijo', 'energia', 'comunicacion']);
  });

  it('RF-4 (002) · 4.1: los tonos salen de los tokens de cada eje', () => {
    for (const a of AXIS_IDENTITY) {
      expect(a.fill).toBe(`axis-${a.key}-fill`);
      expect(a.stroke).toBe(`axis-${a.key}-stroke`);
    }
  });

  it('RF-4 (002) · 4.4: los rellenos difieren en al menos 20 de CIEDE2000, en cada tema', () => {
    for (const theme of THEMES) {
      const fills = AXIS_IDENTITY.map((a) => TOKENS[theme][a.fill]);
      for (let i = 0; i < fills.length; i++)
        for (let j = i + 1; j < fills.length; j++)
          expect(deltaE2000(fills[i]!, fills[j]!), `${theme} ${i}-${j}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('RF-4 (002) · 4.4: cada trazo alcanza 3:1 sobre surface y charcoal, en cada tema', () => {
    for (const theme of THEMES) {
      const t = TOKENS[theme];
      for (const a of AXIS_IDENTITY) {
        expect(contrastRatio(t[a.stroke], t.surface), `${theme} ${a.key}`).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(t[a.stroke], t.charcoal), `${theme} ${a.key}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
