// T-4.2 (004): lectura de títulos, textos, motivos y comentarios de la constitución en las ops.
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../../shared/domain/limits';
import { ApiError } from '../errors';
import { readComment, readReason, readText, readTitle } from './constitutionInput';

const failure = (run: () => unknown): ApiError => {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('No lanzó');
};

describe('constitutionInput', () => {
  it('RF-16 (004) · 16.1: solo espacios es vacío en título, texto, motivo y comentario', () => {
    for (const read of [
      (v: unknown) => readTitle(v, 'section'),
      (v: unknown) => readTitle(v, 'document'),
      (v: unknown) => readText(v, 'section'),
      (v: unknown) => readText(v, 'document'),
      readReason,
      readComment,
    ]) {
      expect(failure(() => read('')).code).toBe('text-empty');
      expect(failure(() => read(' \n\t  ')).code).toBe('text-empty');
    }
  });

  it('RF-16 (004) · 16.1: lo que no es texto se rechaza como solicitud inválida', () => {
    expect(failure(() => readTitle(undefined, 'section')).code).toBe('invalid-request');
    expect(failure(() => readText(5, 'document')).code).toBe('invalid-request');
  });

  it('RF-16 (004) · 16.2: el exceso se informa con los caracteres que sobran y el tope exacto cabe', () => {
    const over = failure(() => readTitle('a'.repeat(LIMITS.title + 3), 'document'));
    expect(over.code).toBe('text-too-long');
    expect(over.message).toContain('sobran 3 caracteres');
    expect(failure(() => readText('a'.repeat(LIMITS.text + 1), 'section')).message).toContain('sobra 1 carácter');
    expect(failure(() => readReason('a'.repeat(LIMITS.reason + 2))).message).toContain(`hasta ${LIMITS.reason}`);
    expect(failure(() => readComment('a'.repeat(LIMITS.comment + 1))).code).toBe('text-too-long');
    expect(readTitle('a'.repeat(LIMITS.title), 'section')).toHaveLength(LIMITS.title);
    expect(readText('a'.repeat(LIMITS.text), 'document')).toHaveLength(LIMITS.text);
  });

  it('RF-16 (004) · 16.2: los puntos de código cuentan una vez', () => {
    expect(readTitle('🌱'.repeat(LIMITS.title), 'section')).toHaveLength(LIMITS.title * 2);
  });

  it('RF-5 (004) · 5.3: un texto válido se devuelve tal cual', () => {
    expect(readTitle('Acuerdos de uso', 'document')).toBe('Acuerdos de uso');
    expect(readText('Primero.\n\n- uno\n- dos', 'document')).toBe('Primero.\n\n- uno\n- dos');
  });
});
