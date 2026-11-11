// RF-14 (021) · 14.4, D-T23 (021): mientras se llena el formulario, el mapa muestra el edificio tal como quedará.
import { describe, expect, it } from 'vitest';
import type { ListedApice } from '../data/apices';
import { NEW_PREVIEW_ID, draftKeyOf, previewItems } from './draftPreview';

const HUERTA: ListedApice = {
  id: 'h',
  name: 'Huerta',
  description: 'd',
  axes: ['alimento'],
  status: 'idea',
  updatedAt: { seconds: 1, nanoseconds: 0 },
  needs: '',
};
const POZO: ListedApice = { ...HUERTA, id: 'p', name: 'Pozo', axes: ['agua'] };
const draft = (values: object) => JSON.stringify({ name: '', description: '', needs: '', offers: '', axes: [], status: 'idea', ...values });

describe('draftKeyOf', () => {
  it('RF-14 (021) · 14.4: la clave del borrador es la del formulario de cada panel', () => {
    expect(draftKeyOf({ kind: 'new' })).toBe('apice:new');
    expect(draftKeyOf({ kind: 'edit', id: 'h' })).toBe('apice:h');
    expect(draftKeyOf({ kind: 'view', id: 'h' })).toBeNull();
    expect(draftKeyOf(null)).toBeNull();
  });
});

describe('previewItems', () => {
  it('RF-14 (021) · 14.4: al editar, el edificio toma los ejes y la etapa del borrador', () => {
    const items = previewItems([HUERTA, POZO], { kind: 'edit', id: 'h' }, draft({ axes: ['cobijo', 'agua'], status: 'en marcha' }));
    expect(items.find((item) => item.id === 'h')).toMatchObject({ axes: ['agua', 'cobijo'], status: 'en marcha', name: 'Huerta' });
    expect(items.find((item) => item.id === 'p')).toBe(POZO);
  });

  it('RF-14 (021) · 14.4: al editar sin ejes elegidos, el edificio conserva los suyos', () => {
    const items = previewItems([HUERTA], { kind: 'edit', id: 'h' }, draft({ axes: [], status: 'prototipo' }));
    expect(items[0]).toMatchObject({ axes: ['alimento'], status: 'prototipo' });
  });

  it('RF-14 (021) · 14.4: al construir, suma un edificio sin ubicación, en «idea», con el nombre escrito', () => {
    const items = previewItems([HUERTA], { kind: 'new' }, draft({ name: '  Biblioteca  ', axes: ['comunicación'] }));
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ id: NEW_PREVIEW_ID, name: 'Biblioteca', axes: ['comunicación'], status: 'idea', location: null });
  });

  it('RF-14 (021) · 14.4: sin nombre, el edificio en construcción se llama «Nuevo ápice»', () => {
    const items = previewItems([], { kind: 'new' }, draft({ axes: ['energía'] }));
    expect(items[0]?.name).toBe('Nuevo ápice');
  });

  it('RF-14 (021) · 14.4: sin borrador, sin ejes, con un borrador ilegible o sin formulario abierto, no cambia nada', () => {
    const base = [HUERTA];
    expect(previewItems(base, { kind: 'new' }, undefined)).toBe(base);
    expect(previewItems(base, { kind: 'new' }, draft({ name: 'x' }))).toBe(base);
    expect(previewItems(base, { kind: 'edit', id: 'h' }, '{roto')).toBe(base);
    expect(previewItems(base, { kind: 'view', id: 'h' }, draft({ axes: ['agua'] }))).toBe(base);
    expect(previewItems(base, null, draft({ axes: ['agua'] }))).toBe(base);
  });

  it('RF-14 (021) · 14.4: ignora ejes y etapas que no existen', () => {
    const items = previewItems([HUERTA], { kind: 'edit', id: 'h' }, draft({ axes: ['fuego', 'agua'], status: 'otra' }));
    expect(items[0]).toMatchObject({ axes: ['agua'], status: 'idea' });
  });
});
