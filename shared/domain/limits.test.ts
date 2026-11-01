// Límites contados en puntos de código, inclusivos; vacío = solo espacios; correos en minúsculas.
import { describe, expect, it } from 'vitest';
import { LIMITS, countCodePoints, excessReason, isBlank, normalizeEmail, validateLength } from './limits';

describe('shared/domain/limits', () => {
  it('los límites son los de la tabla', () => {
    // La igualdad es exhaustiva a propósito: un límite nuevo no entra en la tabla sin pasar
    // por aquí (y sin su spec).
    expect(LIMITS).toEqual({
      title: 120,
      text: 10_000,
      linkDescription: 200,
      name: 80,
      bio: 256,
      email: 254,
      url: 2_000,
      links: 10,
      enrollmentMessage: 2_000,
      username: 24,
      usernameMin: 3,
      passwordMin: 8,
      reason: 2_000,
      comment: 10_000,
      openAmendments: 100,
    });
  });

  it('RF-16 (004) · 16.1: máximos de título, texto, motivo y comentario', () => {
    // Título y texto de sección o documento reutilizan `title` y `text` (D-T17 (004)).
    const cases: Array<[number, number]> = [
      [LIMITS.title, 120],
      [LIMITS.text, 10_000],
      [LIMITS.reason, 2_000],
      [LIMITS.comment, 10_000],
    ];
    for (const [limit, expected] of cases) {
      expect(limit).toBe(expected);
      expect(validateLength('a'.repeat(expected), limit).ok).toBe(true);
      expect(validateLength('a'.repeat(expected + 1), limit)).toMatchObject({ ok: false, excess: 1 });
    }
  });

  it('RF-16 (004) · 16.4: el máximo de propuestas abiertas a la vez es 100 (D-12 (004))', () => {
    expect(LIMITS.openAmendments).toBe(100);
  });

  it('un emoji cuenta como un punto de código y un salto de línea cuenta', () => {
    expect(countCodePoints('a😀b')).toBe(3);
    expect(countCodePoints('👩‍🚀')).toBe(3); // ZWJ: tres puntos de código, aunque se vea uno
    expect(countCodePoints('a\nb')).toBe(3);
    expect(countCodePoints('')).toBe(0);
    expect(countCodePoints('ñandú')).toBe(5);
  });

  it('el límite es inclusivo y el exceso dice cuántos sobran', () => {
    expect(validateLength('😀'.repeat(120), LIMITS.title)).toEqual({ ok: true, limit: 120, count: 120, excess: 0 });
    expect(validateLength('😀'.repeat(121), LIMITS.title)).toEqual({ ok: false, limit: 120, count: 121, excess: 1 });
    expect(validateLength('a\n'.repeat(60) + 'b', 120)).toEqual({ ok: false, limit: 120, count: 121, excess: 1 });
  });

  it('el conteo es en puntos de código y no en unidades UTF-16', () => {
    const emojis = '😀'.repeat(10_001);
    expect(emojis.length).toBe(20_002);
    expect(validateLength(emojis, LIMITS.text)).toEqual({ ok: false, limit: 10_000, count: 10_001, excess: 1 });
  });

  it('el aviso de exceso lleva el plural correcto', () => {
    const uno = validateLength('😀'.repeat(121), LIMITS.title);
    expect(excessReason('El título', uno)).toBe('El título admite hasta 120 caracteres: sobra 1 carácter.');
    const dos = validateLength('a\n'.repeat(5_000) + 'bc', LIMITS.text);
    expect(dos).toEqual({ ok: false, limit: 10_000, count: 10_002, excess: 2 });
    expect(excessReason('El texto', dos)).toBe('El texto admite hasta 10000 caracteres: sobran 2 caracteres.');
  });

  it('un campo con solo espacios se trata como vacío', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank(' \n\t ')).toBe(true);
    expect(isBlank(' a ')).toBe(false);
  });

  it('los correos se normalizan en minúsculas y sin espacios alrededor', () => {
    expect(normalizeEmail('  Ana.Perez@Example.ORG ')).toBe('ana.perez@example.org');
  });
});
