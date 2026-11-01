// Mensajes de error de las ops: todo código tipificado tiene su texto en español con tildes.
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, MESSAGES, isErrorCode, messageFor } from './messages';

// Palabras comunes del dominio que, sin su tilde, delatan un texto mal escrito (plan §9.1, punto 8).
const WITHOUT_ACCENT =
  /\b(sesion|invitacion|contrasena|contrasenas|energia|ubicacion|accion|solicitud(?:es)?\sinscripcion|inscripcion|informacion|direccion|despues|ademas|esta\s+suspendida\s+por|minimo|maximo|valido|invalido|ultima|numero|codigo|correo\selectronico)\b/i;

describe('shared/domain/messages', () => {
  it('RNF-1 (001): todo código de error tiene un mensaje no vacío', () => {
    expect(ERROR_CODES.length).toBeGreaterThan(0);
    for (const code of ERROR_CODES) {
      expect(MESSAGES[code], code).toBeTypeOf('string');
      expect(MESSAGES[code].trim().length, code).toBeGreaterThan(0);
      expect(messageFor(code)).toBe(MESSAGES[code]);
    }
  });

  it('RNF-1 (001): no hay mensajes sin código ni códigos repetidos', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...ERROR_CODES].sort());
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('RNF-1 (001): los mensajes están en español con las tildes de sus palabras más comunes', () => {
    for (const code of ERROR_CODES) {
      expect(MESSAGES[code], code).not.toMatch(WITHOUT_ACCENT);
      expect(MESSAGES[code], code).toMatch(/[.?!]$/); // oración completa
    }
  });

  it('RNF-1 (001): isErrorCode distingue los códigos conocidos', () => {
    expect(isErrorCode(ERROR_CODES[0])).toBe(true);
    expect(isErrorCode('no-existe')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });

  // RF-1 (004) · 4, RF-6 (004) · 4, 6, RF-10 (004) · 3, RF-11 (004) · 2, RF-12 (004) · 6, RF-16 (004) · 4: códigos de la constitución.
  const CONSTITUTION_CODES = [
    'constitution-open',
    'constitution-not-open',
    'constitution-already-open',
    'section-not-found',
    'section-retired',
    'amendment-not-found',
    'comment-not-found',
    'amendment-closed',
    'amendment-unchanged',
    'amendment-limit',
    'not-amendment-author',
    'own-amendment',
    'agree-with-objection',
    'object-with-agreement',
    'objection-already-open',
    'text-empty',
  ];

  it('RF-16 (004) · 16.4, RF-1 (004) · 1.4, RF-6 (004) · 6.4, RF-10 (004) · 10.3, RF-11 (004) · 11.2, RF-12 (004) · 12.6: cada código nuevo de la constitución tiene su mensaje en español', () => {
    for (const code of CONSTITUTION_CODES) {
      expect(isErrorCode(code), code).toBe(true);
      expect(MESSAGES[code as keyof typeof MESSAGES].trim().length, code).toBeGreaterThan(0);
    }
    expect(MESSAGES['amendment-limit']).toMatch(/se alcanzó el máximo/i);
    expect(MESSAGES['amendment-limit']).toMatch(/100/);
  });
});
