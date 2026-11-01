import { describe, expect, it } from 'vitest';
import { DELIBERATION_HOURS, EXTENSION_HOURS, dueAt, extendedDueAt, isDue } from './deadlines';

const HOUR = 3600 * 1000;
const opened = Date.UTC(2026, 9, 9, 15, 30, 0);

describe('deadlines · plazos', () => {
  it('RF-12 (004) · 12.2: el plazo es de 360 h exactas y la ampliación suma otras 360 h al cierre original', () => {
    expect(DELIBERATION_HOURS).toBe(360);
    expect(EXTENSION_HOURS).toBe(360);
    const closesAt = dueAt(opened);
    expect(closesAt - opened).toBe(360 * HOUR);
    expect(extendedDueAt(closesAt)).toBe(opened + 720 * HOUR);
  });

  it('RF-12 (004) · 12.2: isDue es falso un milisegundo antes y verdadero en el instante y después', () => {
    const closesAt = dueAt(opened);
    expect(isDue(closesAt, closesAt - 1)).toBe(false);
    expect(isDue(closesAt, closesAt)).toBe(true);
    expect(isDue(closesAt, closesAt + 1)).toBe(true);
    const second = extendedDueAt(closesAt);
    expect(isDue(second, second - 1)).toBe(false);
    expect(isDue(second, second)).toBe(true);
  });
});
