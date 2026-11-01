// Pruebas de validación de límites y formato de textos de la constitución (RF-16 (004), D-T17 (004)).
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../limits';
import {
  CONSTITUTION_LIMITS,
  validateComment,
  validateConstitutionText,
  validateDocument,
  validateDocumentText,
  validateDocumentTitle,
  validateProposalText,
  validateReason,
  validateSection,
  validateSectionText,
  validateSectionTitle,
  validateTitle,
} from './limits';

describe('shared/domain/constitution/limits', () => {
  it('RF-16 (004) · 16.1: máximos inclusivos en título, texto de sección, motivo, comentario y documento', () => {
    // 120 para títulos de sección y documento; 10 000 para texto de sección y documento;
    // 2 000 para motivo de propuesta u objeción; 10 000 para comentario (RF-16 (004) · 16.1).
    expect(CONSTITUTION_LIMITS.sectionTitle).toBe(LIMITS.title);
    expect(CONSTITUTION_LIMITS.documentTitle).toBe(LIMITS.title);
    expect(CONSTITUTION_LIMITS.sectionText).toBe(LIMITS.text);
    expect(CONSTITUTION_LIMITS.documentText).toBe(LIMITS.text);
    expect(CONSTITUTION_LIMITS.reason).toBe(LIMITS.reason);
    expect(CONSTITUTION_LIMITS.comment).toBe(LIMITS.comment);

    const cases = [
      { name: 'título de sección', fn: validateSectionTitle, limit: 120 },
      { name: 'título general', fn: validateTitle, limit: 120 },
      { name: 'título de documento', fn: validateDocumentTitle, limit: 120 },
      { name: 'texto de sección', fn: validateSectionText, limit: 10_000 },
      { name: 'sección (alias)', fn: validateSection, limit: 10_000 },
      { name: 'motivo', fn: validateReason, limit: 2_000 },
      { name: 'comentario', fn: validateComment, limit: 10_000 },
      { name: 'texto de documento', fn: validateDocumentText, limit: 10_000 },
      { name: 'documento (alias)', fn: validateDocument, limit: 10_000 },
      { name: 'texto de propuesta', fn: validateProposalText, limit: 10_000 },
    ];

    for (const { fn, limit } of cases) {
      // Justo en el límite inclusivo: pasa
      const atLimit = 'a'.repeat(limit);
      const resLimit = fn(atLimit);
      expect(resLimit.ok).toBe(true);
      expect(resLimit.excess).toBe(0);

      // Un carácter más: falla
      const overLimit = 'a'.repeat(limit + 1);
      const resOver = fn(overLimit);
      expect(resOver.ok).toBe(false);
      expect(resOver.excess).toBe(1);
    }
  });

  it('RF-16 (004) · 16.1: solo espacios en blanco cuenta como vacío en los validadores', () => {
    const blankSamples = ['', '   ', '\t', '\n\n', ' \t \r\n '];
    const validators = [
      validateSectionTitle,
      validateSectionText,
      validateReason,
      validateComment,
      validateDocumentText,
    ];

    for (const validate of validators) {
      for (const sample of blankSamples) {
        const res = validate(sample);
        expect(res.ok).toBe(false);
        expect(res.excess).toBe(0);
        expect(res.reason).toMatch(/vacío|espacios|obligatorio/i);
      }
    }
  });

  it('RF-16 (004) · 16.2: el rechazo por exceso informa exactamente cuántos caracteres sobran', () => {
    // 1 de sobra -> «sobra 1 carácter»
    const titleOver1 = validateSectionTitle('😀'.repeat(121));
    expect(titleOver1.ok).toBe(false);
    expect(titleOver1.excess).toBe(1);
    expect(titleOver1.reason).toBe('El título admite hasta 120 caracteres: sobra 1 carácter.');

    const reasonOver1 = validateReason('m'.repeat(2001));
    expect(reasonOver1.ok).toBe(false);
    expect(reasonOver1.excess).toBe(1);
    expect(reasonOver1.reason).toBe('El motivo admite hasta 2000 caracteres: sobra 1 carácter.');

    // 2 o más de sobra -> «sobran N caracteres»
    const sectionOver3 = validateSectionText('s'.repeat(10_003));
    expect(sectionOver3.ok).toBe(false);
    expect(sectionOver3.excess).toBe(3);
    expect(sectionOver3.reason).toBe('El texto admite hasta 10000 caracteres: sobran 3 caracteres.');

    const commentOver5 = validateComment('c'.repeat(10_005));
    expect(commentOver5.ok).toBe(false);
    expect(commentOver5.excess).toBe(5);
    expect(commentOver5.reason).toBe('El comentario admite hasta 10000 caracteres: sobran 5 caracteres.');

    const docOver2 = validateDocumentText('d'.repeat(10_002));
    expect(docOver2.ok).toBe(false);
    expect(docOver2.excess).toBe(2);
    expect(docOver2.reason).toBe('El texto admite hasta 10000 caracteres: sobran 2 caracteres.');
  });

  it('RF-16 (004) · 16.3: se acepta un enlace válido en los cinco textos', () => {
    const validWithLink = 'Acuerdo en [APICCA](https://apicca.com) para coordinar.';

    // Los cinco textos de la spec: título de sección, texto de sección, motivo, comentario y documento
    const fiveTexts = [
      { name: 'título de sección', fn: validateSectionTitle },
      { name: 'texto de sección', fn: validateSectionText },
      { name: 'motivo', fn: validateReason },
      { name: 'comentario', fn: validateComment },
      { name: 'documento', fn: validateDocumentText },
    ];

    for (const { fn } of fiveTexts) {
      const res = fn(validWithLink);
      expect(res.ok).toBe(true);
      expect(res.excess).toBe(0);
      expect(res.linkErrors).toEqual([]);
    }

    // Comprobar también por validateConstitutionText genérico
    const genericRes = validateConstitutionText(validWithLink, 'sectionText');
    expect(genericRes.ok).toBe(true);
    expect(genericRes.linkErrors).toEqual([]);
  });

  it('RF-16 (004) · 16.3: se rechazan enlaces mal formados o inseguros en los textos', () => {
    const invalidLinkText = 'Ver [sitio inseguro](http://inseguro.org) y [abierto](';
    const res = validateSectionText(invalidLinkText);
    expect(res.ok).toBe(false);
    expect(res.linkErrors.length).toBeGreaterThan(0);
    expect(res.linkErrors[0]).toContain('http://inseguro.org');
  });
});
