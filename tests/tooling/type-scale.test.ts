// RF-2 (019) · 2.2, D-T3 (019): las hojas de `src/` no fijan tamaños de texto fuera de la escala del contrato de
// tokens. Solo valen `var(--type-*-size)`, `inherit` y el `100%` de la raíz (`styles/base.css`).
import { describe, expect, it } from 'vitest';
import { TYPE_SCALE } from '../../shared/domain/identity/tokens';
import { declarations } from './css-sources';

const SCALE = new Set(Object.keys(TYPE_SCALE).map((name) => `var(--type-${name}-size)`));

describe('escala tipográfica', () => {
  it('RF-2 (019) · 2.2: todo font-size de src/**/*.css es un token de la escala, inherit o el 100% de la raíz', () => {
    const sizes = declarations(/^font-size$/);
    expect(sizes.length).toBeGreaterThan(0);
    const outside = sizes.filter(({ where, value }) => {
      if (SCALE.has(value) || value === 'inherit') return false;
      return !(value === '100%' && where.startsWith('styles/base.css:'));
    });
    expect(outside.map(({ where, value }) => `${where} ${value}`)).toEqual([]);
  });

  it('RF-2 (019) · 2.2: el atajo font solo hereda, sin fijar un tamaño', () => {
    const shorthands = declarations(/^font$/);
    expect(shorthands.filter(({ value }) => value !== 'inherit').map(({ where, value }) => `${where} ${value}`)).toEqual([]);
  });
});
