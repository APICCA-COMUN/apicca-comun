// Fecha de un hecho: día `YYYY-MM-DD` en la hora de Colombia (UTC−5, sin horario de verano);
// forma, calendario y no futura.
import { describe, expect, it } from 'vitest';
import { formatLongDate, todayInColombia, validateEventDate } from './dates';

describe('shared/domain/dates', () => {
  it('a las 03:00 UTC en Colombia sigue siendo el día anterior', () => {
    expect(todayInColombia(new Date('2026-09-02T03:00:00Z'))).toBe('2026-09-01');
    expect(todayInColombia(new Date('2026-09-02T04:59:59Z'))).toBe('2026-09-01');
    expect(todayInColombia(new Date('2026-09-02T05:00:00Z'))).toBe('2026-09-02');
    expect(todayInColombia(new Date('2026-01-01T02:00:00Z'))).toBe('2025-12-31');
  });

  it('acepta un día pasado o el de hoy en Colombia', () => {
    const now = new Date('2026-09-02T03:00:00Z'); // 1 sep en Colombia
    expect(validateEventDate('2026-09-01', now)).toEqual({ ok: true });
    expect(validateEventDate('2024-02-29', now)).toEqual({ ok: true });
    expect(validateEventDate('1999-12-31', now)).toEqual({ ok: true });
  });

  it('rechaza una fecha posterior al día actual en Colombia', () => {
    const now = new Date('2026-09-02T03:00:00Z'); // 1 sep en Colombia, aunque en UTC ya es 2 sep
    expect(validateEventDate('2026-09-02', now)).toEqual({ ok: false, reason: expect.stringMatching(/futur|posterior/) });
  });

  it('rechaza el 30 de febrero y otras fechas sin calendario', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    expect(validateEventDate('2026-02-30', now)).toEqual({ ok: false, reason: expect.stringMatching(/no existe|calendario/) });
    expect(validateEventDate('2025-02-29', now)).toEqual({ ok: false, reason: expect.stringMatching(/no existe|calendario/) });
    expect(validateEventDate('2026-04-31', now)).toEqual({ ok: false, reason: expect.stringMatching(/no existe|calendario/) });
  });

  it('rechaza la forma que no sea YYYY-MM-DD', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    for (const bad of ['', '2026-9-2', '02/09/2026', '2026-09-02T00:00', '2026-13-01', '2026-00-10', '2026-09-00', 'hoy']) {
      expect(validateEventDate(bad, now), bad).toEqual({ ok: false, reason: expect.stringContaining('AAAA-MM-DD') });
    }
  });

  it('RF-11 (019) · 11.4, D-T23 (019): la fecha larga lleva día sin cero, mes en minúscula y año', () => {
    const at = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 });
    expect(formatLongDate(at('2026-11-03T15:00:00Z'))).toBe('3 de noviembre de 2026');
    expect(formatLongDate(at('2026-01-15T12:00:00Z'))).toBe('15 de enero de 2026');
    expect(formatLongDate(at('2026-12-31T20:00:00Z'))).toBe('31 de diciembre de 2026');
  });

  it('RF-11 (019) · 11.4, D-T23 (019): la fecha larga usa la hora de Bogotá (UTC−5)', () => {
    const at = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 });
    expect(formatLongDate(at('2026-11-03T04:59:59Z'))).toBe('2 de noviembre de 2026');
    expect(formatLongDate(at('2026-11-03T05:00:00Z'))).toBe('3 de noviembre de 2026');
    expect(formatLongDate(at('2026-01-01T02:00:00Z'))).toBe('31 de diciembre de 2025');
  });
});
