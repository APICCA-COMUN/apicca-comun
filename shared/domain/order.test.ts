// Comparación de sellos de tiempo y orden de listas, verificado con las fábricas.
import { describe, expect, it } from 'vitest';
import { compareTimestamps, compareTimestampsDescending, isTimestampLike } from './order';
import { timestampFrom } from './testing/factories';

const t = (iso: string) => timestampFrom(new Date(iso));

describe('shared/domain/order', () => {
  it('los sellos de tiempo se comparan por segundos y luego por nanosegundos', () => {
    expect(compareTimestamps({ seconds: 1, nanoseconds: 0 }, { seconds: 2, nanoseconds: 0 })).toBeLessThan(0);
    expect(compareTimestamps({ seconds: 1, nanoseconds: 5 }, { seconds: 1, nanoseconds: 3 })).toBeGreaterThan(0);
    expect(compareTimestamps({ seconds: 1, nanoseconds: 3 }, { seconds: 1, nanoseconds: 3 })).toBe(0);
  });

  it('el comparador descendente deja el más reciente primero', () => {
    const items = [
      { name: 'vieja', at: t('2026-08-01T00:00:00Z') },
      { name: 'nueva', at: t('2026-09-01T00:00:00Z') },
      { name: 'media', at: t('2026-08-15T00:00:00Z') },
    ];
    const sorted = [...items].sort((a, b) => compareTimestampsDescending(a.at, b.at));
    expect(sorted.map((x) => x.name)).toEqual(['nueva', 'media', 'vieja']);
  });

  // Quien compara sellos leídos de Firestore no sabe de qué SDK vienen: lo único seguro es su forma.
  it('un sello de tiempo se reconoce por su forma, no por su clase', () => {
    expect(isTimestampLike({ seconds: 1, nanoseconds: 0 })).toBe(true);
    expect(isTimestampLike({ seconds: 0, nanoseconds: 0, toMillis: () => 0 })).toBe(true);
    expect(isTimestampLike(undefined)).toBe(false);
    expect(isTimestampLike(null)).toBe(false);
    expect(isTimestampLike('2026-09-03')).toBe(false);
    expect(isTimestampLike({ seconds: 1 })).toBe(false);
    expect(isTimestampLike({ seconds: '1', nanoseconds: 0 })).toBe(false);
  });
});
