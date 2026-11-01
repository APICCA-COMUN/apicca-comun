import { describe, expect, it } from 'vitest';
import { placeNewSection } from './placement';

const order = ['a', 'b', 'c', 'd'];

describe('placement · lugar de una sección nueva', () => {
  it('RF-13 (004) · 13.5: va detrás de la referencia vigente, de la vigente anterior más cercana o al principio', () => {
    const table: Array<[string, string[], string | null, number]> = [
      ['referencia vigente', ['a', 'b', 'c', 'd'], 'b', 2],
      ['referencia vigente al final', ['a', 'b', 'c', 'd'], 'd', 4],
      ['referencia retirada', ['a', 'c', 'd'], 'b', 1],
      ['retiradas encadenadas', ['a', 'd'], 'c', 1],
      ['ninguna vigente anterior', ['c', 'd'], 'b', 0],
      ['al principio', ['a', 'b', 'c', 'd'], null, 0],
      ['sin vigentes', [], 'c', 0],
    ];
    for (const [, vigentes, after, expected] of table) {
      expect(placeNewSection(order, new Set(vigentes), after)).toBe(expected);
    }
  });

  it('RF-13 (004) · 13.5: la posición devuelta inserta la sección en el arreglo sin tocar el resto', () => {
    const at = placeNewSection(order, new Set(['a', 'c', 'd']), 'b');
    expect([...order.slice(0, at), 'nueva', ...order.slice(at)]).toEqual(['a', 'nueva', 'b', 'c', 'd']);
  });
});
