// RF-3 (019) · 3.3, D-T4 (019): las hojas de `src/` no fijan radios fuera de los tokens. Cada parte del valor es
// `var(--radius-*)` o `0`; el círculo de los botones de ícono y de los nodos usa `radius-pill`.
import { describe, expect, it } from 'vitest';
import { declarations } from './css-sources';

const PART = /^(var\(--radius-[a-z]+\)|0)$/;

describe('radios', () => {
  it('RF-3 (019) · 3.3: todo radio de src/**/*.css es var(--radius-*) o 0', () => {
    const radii = declarations(/^border(-[a-z]+)*-radius$/);
    expect(radii.length).toBeGreaterThan(0);
    const outside = radii.filter(({ value }) => !value.split(/\s+/).every((part) => PART.test(part)));
    expect(outside.map(({ where, property, value }) => `${where} ${property}: ${value}`)).toEqual([]);
  });
});
