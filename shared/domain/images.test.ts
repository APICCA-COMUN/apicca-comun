// Límites y validación de las referencias de un ápice (RF-15 (001)).
import { describe, expect, it } from 'vitest';
import {
  ALT_TEXT_MAX,
  MAX_IMAGE_DIMENSION,
  MAX_REFERENCES,
  REFERENCE_CONTENT_TYPES,
  REFERENCE_MAX_BYTES,
  validateAltText,
  validateReferenceMeta,
} from './images';
import { isErrorCode } from './messages';

const base = { contentType: 'image/png', bytes: 1000, altText: 'Un tanque de agua', currentCount: 0 };

const codeOf = (result: ReturnType<typeof validateReferenceMeta>): string | null =>
  result.ok ? null : result.code;

describe('shared/domain/images · límites', () => {
  it('RF-15 (001): los límites son 5 MiB, 5 referencias, 4096 px y tres formatos', () => {
    expect(REFERENCE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_REFERENCES).toBe(5);
    expect(MAX_IMAGE_DIMENSION).toBe(4096);
    expect(ALT_TEXT_MAX).toBe(200);
    expect([...REFERENCE_CONTENT_TYPES]).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});

describe('shared/domain/images · validateReferenceMeta', () => {
  it('RF-15 (001): una referencia válida se acepta con el texto alternativo recortado', () => {
    const result = validateReferenceMeta({ ...base, altText: '  Tanque  ', width: 800, height: 600 });
    expect(result).toEqual({
      ok: true,
      value: { contentType: 'image/png', bytes: 1000, altText: 'Tanque', width: 800, height: 600 },
    });
  });

  it('RF-15 (001): exactamente 5 MiB se acepta y 5 MiB + 1 byte no', () => {
    expect(validateReferenceMeta({ ...base, bytes: REFERENCE_MAX_BYTES }).ok).toBe(true);
    expect(codeOf(validateReferenceMeta({ ...base, bytes: REFERENCE_MAX_BYTES + 1 }))).toBe('image-too-large');
  });

  it('RF-15 (001): una imagen vacía o con peso inválido se rechaza', () => {
    expect(validateReferenceMeta({ ...base, bytes: 0 }).ok).toBe(false);
    expect(validateReferenceMeta({ ...base, bytes: Number.NaN }).ok).toBe(false);
  });

  it('RF-15 (001): la sexta referencia se rechaza y la quinta se acepta', () => {
    expect(validateReferenceMeta({ ...base, currentCount: 4 }).ok).toBe(true);
    expect(codeOf(validateReferenceMeta({ ...base, currentCount: 5 }))).toBe('references-full');
  });

  it('RF-15 (001): 4096 px se aceptan y 4097 px no, en cada lado', () => {
    expect(validateReferenceMeta({ ...base, width: 4096, height: 4096 }).ok).toBe(true);
    expect(codeOf(validateReferenceMeta({ ...base, width: 4097, height: 100 }))).toBe('image-dimensions-exceeded');
    expect(codeOf(validateReferenceMeta({ ...base, width: 100, height: 4097 }))).toBe('image-dimensions-exceeded');
  });

  it('RF-15 (001): JPG, PNG y WebP se aceptan; GIF y otros no', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateReferenceMeta({ ...base, contentType }).ok, contentType).toBe(true);
    }
    for (const contentType of ['image/gif', 'image/svg+xml', 'text/plain', '']) {
      expect(codeOf(validateReferenceMeta({ ...base, contentType })), contentType).toBe('image-type-unsupported');
    }
  });

  it('RF-15 (001): el texto alternativo vacío o solo de espacios se rechaza', () => {
    expect(codeOf(validateReferenceMeta({ ...base, altText: '' }))).toBe('alt-text-required');
    expect(codeOf(validateReferenceMeta({ ...base, altText: '   \n ' }))).toBe('alt-text-required');
  });

  it('RF-15 (001): el texto alternativo de 200 caracteres se acepta y el de 201 no', () => {
    expect(validateReferenceMeta({ ...base, altText: 'a'.repeat(200) }).ok).toBe(true);
    expect(codeOf(validateReferenceMeta({ ...base, altText: 'a'.repeat(201) }))).toBe('alt-text-too-long');
  });

  it('RF-15 (001): los códigos de rechazo tienen mensaje', () => {
    for (const code of [
      'image-too-large',
      'image-type-unsupported',
      'image-dimensions-exceeded',
      'references-full',
      'alt-text-required',
      'alt-text-too-long',
    ]) {
      expect(isErrorCode(code), code).toBe(true);
    }
  });
});

describe('shared/domain/images · validateAltText', () => {
  it('RF-15 (001): recorta y valida el texto alternativo por separado', () => {
    expect(validateAltText('  hola ')).toEqual({ ok: true, value: 'hola' });
    expect(validateAltText('').ok).toBe(false);
  });
});
