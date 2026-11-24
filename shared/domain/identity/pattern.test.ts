// Sistema «APICCA · Mapa»: el port tipado de la geometría da los mismos trazados que el `bundle.js` del sistema.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { AXES } from '../apice';
import { axisIdentity } from './axes';
import { glyph, GLYPH_UNIT, pattern, RULE_BY_STATUS, type PatternRule } from './pattern';

interface Bundle {
  REGLA: Record<string, string>;
  patron(eje: string, regla: string, W: number, H: number, o?: object): string;
  forma(eje: string, cx: number, cy: number, s: number, modo: string): string;
}

const source = readFileSync(resolve(import.meta.dirname, '../../../tests/fixtures/sistema-mapa/bundle.js'), 'utf8');
const sandbox = { window: {} as { Apicca?: Bundle } };
runInNewContext(source, sandbox);
const A = sandbox.window.Apicca!;

const paths = (html: string) => [...html.matchAll(/<path d="([^"]*)"/g)].map((m) => m[1]);
const viewBox = (html: string) => /viewBox="([^"]+)"/.exec(html)![1];
const RULES: PatternRule[] = ['tresbolillo', 'encaje', 'eco'];
const SIZES = [
  [128, 86, 0.55],
  [56, 34, 0.34],
  [97, 84, 0.42],
] as const;

describe('patrón del sistema «APICCA · Mapa»', () => {
  it('la regla de cada Etapa es la del sistema', () => {
    expect(RULE_BY_STATUS).toEqual(A.REGLA);
  });

  it('cada eje tiene su glifo y no hay dos iguales', () => {
    expect(new Set(Object.values(GLYPH_UNIT).map((pts) => JSON.stringify(pts))).size).toBe(5);
  });

  for (const axis of AXES)
    for (const rule of RULES)
      it(`${axis} · ${rule}: mismos trazados y viewBox que bundle.js`, () => {
        const { key } = axisIdentity(axis);
        for (const [W, H, scale] of SIZES) {
          const html = A.patron(axis, rule, W, H, { escala: scale });
          const ours = pattern(key, rule, W, H, { scale });
          expect(ours.viewBox).toBe(viewBox(html));
          expect([ours.solid, ...(ours.stroke ? [ours.stroke.d] : [])]).toEqual(paths(html));
        }
      });

  for (const axis of AXES)
    it(`${axis}: el glifo suelto coincide con forma() en los tres modos`, () => {
      const { key } = axisIdentity(axis);
      for (const mode of ['macizo', 'contorno', 'mitad'] as const) {
        const html = A.forma(axis, 12, 12, 7.9, mode);
        const ours = glyph(key, 12, 12, 7.9, mode);
        expect([ours.d, ...(ours.half ? [ours.half] : [])]).toEqual(paths(html));
        if (ours.strokeWidth !== undefined) expect(html).toContain(`stroke-width: ${ours.strokeWidth.toFixed(1)}px`);
      }
    });
});
