// Comprobación de la ubicación de las pruebas de utillaje (D-T12 (002)): `tests/tooling/`
// corre en `unit-node`, dentro de `npm test`, y sí lo recorre `rf-coverage`.
import { describe, expect, it } from 'vitest';

describe('pruebas de utillaje', () => {
  it('corren en Node, sin DOM', () => {
    expect(typeof document).toBe('undefined');
  });
});
