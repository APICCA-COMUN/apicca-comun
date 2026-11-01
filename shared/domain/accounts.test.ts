// Reglas de cuentas: contraseña, nombre, nombre de usuario, roles y estados.
import { describe, expect, it } from 'vitest';
import { RESERVED_USERNAMES, validateName, validatePassword, validateUsername } from './accounts';

describe('shared/domain/accounts', () => {
  it('RF-2 (001): la contraseña exige 8 caracteres y ninguna otra regla', () => {
    expect(validatePassword('1234567')).toEqual({ ok: false, code: 'password-too-short' });
    expect(validatePassword('12345678')).toEqual({ ok: true, value: '12345678' });
    expect(validatePassword('        ')).toEqual({ ok: true, value: '        ' });
    expect(validatePassword('😀'.repeat(8)).ok).toBe(true); // puntos de código, no unidades UTF-16
  });

  it('RF-2 (001): el nombre admite de 1 a 80 caracteres', () => {
    expect(validateName('')).toEqual({ ok: false, code: 'name-invalid' });
    expect(validateName('   ')).toEqual({ ok: false, code: 'name-invalid' });
    expect(validateName('a')).toEqual({ ok: true, value: 'a' });
    expect(validateName('a'.repeat(80)).ok).toBe(true);
    expect(validateName('a'.repeat(81))).toEqual({ ok: false, code: 'name-invalid' });
    expect(validateName('  Ana  ')).toEqual({ ok: true, value: 'Ana' });
  });

  it('RF-2 (001): el nombre de usuario pasa a minúsculas', () => {
    expect(validateUsername('Ab_1')).toEqual({ ok: true, value: 'ab_1' });
    expect(validateUsername('abc')).toEqual({ ok: true, value: 'abc' });
    expect(validateUsername('a'.repeat(24)).ok).toBe(true);
  });

  it('RF-2 (001): el nombre de usuario rechaza lo que no cumple la forma', () => {
    const invalid = { ok: false, code: 'username-invalid' };
    expect(validateUsername('ñandu')).toEqual(invalid);
    expect(validateUsername('ab')).toEqual(invalid);
    expect(validateUsername('a_')).toEqual(invalid); // 2 caracteres
    expect(validateUsername('___')).toEqual(invalid); // sin letra
    expect(validateUsername('123')).toEqual(invalid); // sin letra
    expect(validateUsername('a'.repeat(25))).toEqual(invalid);
    expect(validateUsername('ana lopez')).toEqual(invalid);
    expect(validateUsername('ana-lopez')).toEqual(invalid);
    expect(validateUsername('ánimo')).toEqual(invalid);
    expect(validateUsername('')).toEqual(invalid);
  });

  it('RF-2 (001): los nombres reservados se rechazan con cualquier combinación de mayúsculas', () => {
    expect([...RESERVED_USERNAMES]).toEqual(['facilitador', 'admin', 'apicca']);
    for (const name of ['facilitador', 'FACILITADOR', 'Admin', 'aDmIn', 'APICCA', 'apicca']) {
      expect(validateUsername(name)).toEqual({ ok: false, code: 'username-reserved' });
    }
    expect(validateUsername('admin2').ok).toBe(true);
  });
});
