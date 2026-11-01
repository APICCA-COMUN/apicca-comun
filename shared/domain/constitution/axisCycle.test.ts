import { describe, expect, it } from 'vitest';
import { AXES } from '../apice';
import { axisForIndex } from './axisCycle';

describe('axisForIndex', () => {
  it('RF-11 (005) · 11.2, D-T10 (005): sigue el orden cíclico agua, alimento, cobijo, energía y comunicación', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10, 12].map(axisForIndex)).toEqual([
      'agua', 'alimento', 'cobijo', 'energía', 'comunicación', 'agua', 'alimento', 'agua', 'cobijo',
    ]);
    expect(AXES.map((_, i) => axisForIndex(i))).toEqual([...AXES]);
  });
});
