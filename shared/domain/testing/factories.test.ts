// Utilidades de las fábricas: el sello de tiempo es coherente con el instante y los
// identificadores no se repiten.
import { describe, expect, it } from 'vitest';
import { isTimestampLike } from '../order';
import { DEFAULT_NOW, nextId, timestampFrom } from './factories';

describe('shared/domain/testing/factories', () => {
  it('timestampFrom separa segundos y nanosegundos', () => {
    const stamp = timestampFrom(new Date('2026-01-01T00:00:00.500Z'));
    expect(stamp).toEqual({ seconds: 1767225600, nanoseconds: 500_000_000 });
    expect(isTimestampLike(stamp)).toBe(true);
  });

  it('timestampFrom del instante por defecto es estable', () => {
    expect(timestampFrom(DEFAULT_NOW)).toEqual(timestampFrom(new Date('2026-09-01T15:00:00Z')));
  });

  it('nextId no repite identificadores y conserva el prefijo', () => {
    const a = nextId('apice');
    const b = nextId('apice');
    expect(a).not.toBe(b);
    expect(a.startsWith('apice-')).toBe(true);
  });
});
