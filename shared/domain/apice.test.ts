import { describe, expect, it } from 'vitest';
import {
  APICE_STATUSES,
  AXES,
  INITIAL_APICE_STATUS,
  VISIBILITIES,
  normalizeContent,
  validateContent,
  type ContentInput,
} from './apice';
import { LIMITS } from './limits';

describe('apice · tipos base', () => {
  it('RF-6 (001): los cinco ejes son agua, alimento, cobijo, energía y comunicación', () => {
    expect(AXES).toEqual(['agua', 'alimento', 'cobijo', 'energía', 'comunicación']);
  });

  it('RF-8 (001): los estados son idea, prototipo y en marcha, y «idea» es el inicial', () => {
    expect(APICE_STATUSES).toEqual(['idea', 'prototipo', 'en marcha']);
    expect(INITIAL_APICE_STATUS).toBe('idea');
  });

  it('RF-7 (001): la visibilidad es privada o pública', () => {
    expect(VISIBILITIES).toEqual(['private', 'public']);
  });
});

const base: ContentInput = {
  name: 'Casa de semillas',
  description: 'Un banco comunitario de semillas.',
  axes: ['alimento'],
};

const issuesOf = (input: ContentInput) => {
  const result = validateContent(input);
  return result.ok ? [] : result.issues;
};

describe('validateContent · obligatorios', () => {
  it('RF-6 (001): un ápice con nombre, descripción y un eje es válido y los opcionales quedan vacíos', () => {
    const result = validateContent(base);
    expect(result).toEqual({ ok: true, value: { ...base, needs: '', offers: '' } });
  });

  it('RF-6 (001): cada dato obligatorio que falta se señala con su campo', () => {
    expect(issuesOf({ ...base, name: '' })).toEqual([{ field: 'name', code: 'field-required' }]);
    expect(issuesOf({ ...base, description: '' })).toEqual([{ field: 'description', code: 'field-required' }]);
    expect(issuesOf({ ...base, axes: [] })).toEqual([{ field: 'axes', code: 'field-required' }]);
  });

  it('RF-6 (001): si faltan los tres se señalan los tres', () => {
    expect(issuesOf({ name: '', description: '', axes: [] }).map((i) => i.field)).toEqual(['name', 'description', 'axes']);
  });

  it('RF-7 (001): los ejes repetidos o desconocidos se rechazan', () => {
    expect(issuesOf({ ...base, axes: ['agua', 'agua'] })).toEqual([{ field: 'axes', code: 'axes-duplicated' }]);
    expect(issuesOf({ ...base, axes: ['agua', 'fuego'] })).toEqual([{ field: 'axes', code: 'axis-unknown' }]);
  });

  it('RF-7 (001): varios ejes distintos son válidos', () => {
    expect(validateContent({ ...base, axes: ['agua', 'energía', 'comunicación'] }).ok).toBe(true);
  });
});

describe('validateContent · topes y caracteres', () => {
  it('RF-7 (001): el nombre admite 120 y uno más se rechaza con el excedente', () => {
    expect(validateContent({ ...base, name: 'a'.repeat(LIMITS.title) }).ok).toBe(true);
    expect(issuesOf({ ...base, name: 'a'.repeat(LIMITS.title + 1) })).toEqual([{ field: 'name', code: 'text-too-long', excess: 1 }]);
  });

  it('RF-7 (001): descripción, necesidades y aportes admiten 10.000 puntos de código y señalan cuántos sobran', () => {
    const ok = '😀'.repeat(LIMITS.text); // cuenta por puntos de código, no por unidades UTF-16
    expect(validateContent({ ...base, description: ok, needs: ok, offers: ok }).ok).toBe(true);
    const over = 'x'.repeat(LIMITS.text + 3);
    expect(issuesOf({ ...base, description: over, needs: over, offers: over })).toEqual([
      { field: 'description', code: 'text-too-long', excess: 3 },
      { field: 'needs', code: 'text-too-long', excess: 3 },
      { field: 'offers', code: 'text-too-long', excess: 3 },
    ]);
  });

  it('RF-7 (001): el tope se mide después de recortar los extremos', () => {
    expect(validateContent({ ...base, name: `  ${'a'.repeat(LIMITS.title)}  ` }).ok).toBe(true);
  });

  it('RF-7 (001): un carácter de control se rechaza en cualquier texto', () => {
    expect(issuesOf({ ...base, name: 'Ca\u0000sa' })).toEqual([{ field: 'name', code: 'control-characters' }]);
    expect(issuesOf({ ...base, description: 'uno\u0007dos' })).toEqual([{ field: 'description', code: 'control-characters' }]);
    expect(issuesOf({ ...base, needs: 'a\u007Fb' })).toEqual([{ field: 'needs', code: 'control-characters' }]);
  });

  it('RF-7 (001): los saltos de línea valen en la descripción pero no en el nombre', () => {
    expect(validateContent({ ...base, description: 'uno\ndos\r\ntres\tcuatro' }).ok).toBe(true);
    expect(issuesOf({ ...base, name: 'uno\ndos' })).toEqual([{ field: 'name', code: 'control-characters' }]);
  });

  it('RF-7 (001): dos ápices con el mismo nombre son válidos', () => {
    expect(validateContent(base).ok && validateContent({ ...base, description: 'Otra.' }).ok).toBe(true);
  });
});

describe('normalizeContent', () => {
  it('RF-7 (001): recorta los extremos de cada texto', () => {
    expect(normalizeContent({ ...base, name: '  Casa  ', needs: ' agua ', offers: '\tmanos\n' })).toMatchObject({
      name: 'Casa',
      needs: 'agua',
      offers: 'manos',
    });
  });

  it('RF-7 (001): conserva los saltos de línea interiores', () => {
    expect(normalizeContent({ ...base, description: '\n  uno\n\ndos  \n' }).description).toBe('uno\n\ndos');
  });

  it('RF-7 (001): un nombre de solo espacios queda vacío y se rechaza', () => {
    expect(normalizeContent({ ...base, name: '   ' }).name).toBe('');
    expect(issuesOf({ ...base, name: '   \t ' })).toEqual([{ field: 'name', code: 'field-required' }]);
    expect(issuesOf({ ...base, description: '\n \n' })).toEqual([{ field: 'description', code: 'field-required' }]);
  });
});
