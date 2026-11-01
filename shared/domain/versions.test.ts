import { describe, expect, it } from 'vitest';
import { diffContent, isConflict, isNoopEdit, type EditableFields } from './versions';

const current: EditableFields = {
  name: 'Casa de semillas',
  description: 'Un banco comunitario.',
  axes: ['alimento'],
  needs: '',
  offers: '',
  status: 'idea',
};

describe('versions · conflicto', () => {
  it('RF-11 (001): la base igual a la vigente no es conflicto y una distinta sí', () => {
    expect(isConflict(3, 3)).toBe(false);
    expect(isConflict(2, 3)).toBe(true);
  });
});

describe('versions · edición sin cambios', () => {
  it('RF-12 (001): reenviar lo mismo, aun con espacios o ejes en otro orden, no crea versión', () => {
    expect(isNoopEdit(current, { ...current })).toBe(true);
    expect(isNoopEdit(current, { ...current, name: '  Casa de semillas ', description: 'Un banco comunitario.\n' })).toBe(true);
    const two: EditableFields = { ...current, axes: ['agua', 'energía'] };
    expect(isNoopEdit(two, { ...two, axes: ['energía', 'agua'] })).toBe(true);
  });

  it('RF-12 (001): cambiar un texto, los ejes o el estado sí es un cambio', () => {
    expect(isNoopEdit(current, { ...current, needs: 'manos' })).toBe(false);
    expect(isNoopEdit(current, { ...current, axes: ['alimento', 'agua'] })).toBe(false);
    expect(isNoopEdit(current, { ...current, status: 'prototipo' })).toBe(false);
  });
});

describe('versions · diffContent', () => {
  it('RF-11 (001): sin diferencias devuelve una lista vacía', () => {
    expect(diffContent(current, { ...current })).toEqual([]);
  });

  it('RF-11 (001): un campo cambiado trae el valor anterior y el nuevo', () => {
    expect(diffContent(current, { ...current, name: 'Casa' })).toEqual([{ field: 'name', before: 'Casa de semillas', after: 'Casa' }]);
  });

  it('RF-11 (001): varios campos cambiados salen en el orden de la ficha', () => {
    const next: EditableFields = { ...current, description: 'Otra.', offers: 'manos', status: 'en marcha' };
    expect(diffContent(current, next).map((c) => c.field)).toEqual(['description', 'offers', 'status']);
  });

  it('RF-11 (001): los ejes agregados y quitados se separan', () => {
    const next: EditableFields = { ...current, axes: ['agua', 'energía'] };
    expect(diffContent(current, next)).toEqual([{ field: 'axes', added: ['agua', 'energía'], removed: ['alimento'] }]);
  });
});
