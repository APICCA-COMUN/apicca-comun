// Fecha de un hecho: día `YYYY-MM-DD` en la hora de Colombia (UTC−5, sin horario de verano);
// forma, calendario y no futura.
import { describe, expect, it } from 'vitest';
import { formatLongDate, formatLongDateMs, formatLongDateTime, formatLongDay, todayInColombia, validateEventDate } from './dates';

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

  it('RF-5 (024) · 5.1, D-T7 (024): formatLongDay da la fecha larga de un día YYYY-MM-DD, con los doce meses', () => {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    months.forEach((month, i) => {
      const mm = String(i + 1).padStart(2, '0');
      expect(formatLongDay(`2026-${mm}-03`), month).toBe(`3 de ${month} de 2026`);
    });
  });

  it('RF-5 (024) · 5.1, D-T7 (024): formatLongDay quita el cero del día y no mueve la fecha', () => {
    expect(formatLongDay('2026-11-03')).toBe('3 de noviembre de 2026');
    expect(formatLongDay('2026-11-30')).toBe('30 de noviembre de 2026');
    expect(formatLongDay('2026-01-01')).toBe('1 de enero de 2026');
  });

  it('RF-5 (024) · 5.1, D-T7 (024): formatLongDay cambia de año sin desfase', () => {
    expect(formatLongDay('2026-12-31')).toBe('31 de diciembre de 2026');
    expect(formatLongDay('2027-01-01')).toBe('1 de enero de 2027');
  });

  it('RF-5 (024) · 5.1, D-T7 (024): formatLongDay da texto vacío para un día que no es válido', () => {
    for (const bad of ['', 'hoy', '2026-9-2', '2026-13-01', '2026-02-30', '2025-02-29', '2026-04-31']) {
      expect(formatLongDay(bad), bad).toBe('');
    }
  });

  it('RF-5 (024) · 5.2, D-T7 (024): formatLongDateMs usa la hora de Bogotá, como formatLongDate', () => {
    // 23:30 del 1 de septiembre en Bogotá es 04:30 UTC del 2; 00:30 del 2 es 05:30 UTC.
    expect(formatLongDateMs(Date.parse('2026-09-02T04:30:00Z'))).toBe('1 de septiembre de 2026');
    expect(formatLongDateMs(Date.parse('2026-09-02T05:30:00Z'))).toBe('2 de septiembre de 2026');
  });

  it('RF-5 (024) · 5.2, D-T7 (024): formatLongDateMs da lo mismo que formatLongDate sobre el mismo instante', () => {
    const ms = Date.parse('2026-11-03T15:20:00Z');
    expect(formatLongDateMs(ms)).toBe(formatLongDate({ seconds: ms / 1000, nanoseconds: 0 }));
    expect(formatLongDateMs(ms)).toBe('3 de noviembre de 2026');
  });

  it('RF-6 (024), D-T9 (024): formatLongDateMs da texto vacío si el instante no es válido', () => {
    expect(formatLongDateMs(Number.NaN)).toBe('');
    expect(formatLongDateMs(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('RF-5 (024) · 5.2, D-T7 (024): formatLongDateTime da la fecha larga y la hora en 12 horas, con «a. m.» y «p. m.»', () => {
    const at = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 });
    expect(formatLongDateTime(at('2026-11-03T07:56:00Z'))).toBe('3 de noviembre de 2026, 2:56 a. m.');
    expect(formatLongDateTime(at('2026-11-03T18:05:00Z'))).toBe('3 de noviembre de 2026, 1:05 p. m.');
  });

  it('RF-5 (024) · 5.2, D-T7 (024): las 12:00 y las 00:00 se leen como 12 en 12 horas, a. m. o p. m.', () => {
    const at = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 });
    expect(formatLongDateTime(at('2026-11-03T17:00:00Z'))).toBe('3 de noviembre de 2026, 12:00 p. m.');
    expect(formatLongDateTime(at('2026-11-03T05:00:00Z'))).toBe('3 de noviembre de 2026, 12:00 a. m.');
  });

  it('RF-5 (024) · 5.2, D-T7 (024): formatLongDateTime cambia de año con la hora de Bogotá', () => {
    const at = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 });
    expect(formatLongDateTime(at('2027-01-01T03:00:00Z'))).toBe('31 de diciembre de 2026, 10:00 p. m.');
  });

  it('RF-5 (024) · 5.2, D-T7 (024): formatLongDateTime da texto vacío para un instante que no es válido', () => {
    expect(formatLongDateTime({ seconds: Number.NaN, nanoseconds: 0 })).toBe('');
  });
});
