// T-45 (021) · RF-23 (021) · 23.1, 23.4, RNF-6 (021), D-T39 (021): el boceto vive solo en este navegador y se vuelve un
// edificio del mapa, sin ubicación, con el rótulo «Boceto».
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SKETCH, SKETCH_ID, readSketch, saveSketch, sketchItem } from './sketch';

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('sketch', () => {
  it('RF-23 (021) · 23.1: sin nada guardado empieza sin ejes, en Idea; lo guardado se recupera en el orden de los ejes', () => {
    expect(readSketch()).toEqual(EMPTY_SKETCH);
    saveSketch({ axes: ['energía', 'agua'], status: 'prototipo' });
    expect(readSketch()).toEqual({ axes: ['agua', 'energía'], status: 'prototipo' });
  });

  it('RNF-6 (021): lo guardado mal formado o el almacenamiento bloqueado dan el boceto vacío, sin fallar', () => {
    window.sessionStorage.setItem('apicca:boceto', '{"axes": "agua", "status": "x"}');
    expect(readSketch()).toEqual(EMPTY_SKETCH);
    window.sessionStorage.setItem('apicca:boceto', 'no es json');
    expect(readSketch()).toEqual(EMPTY_SKETCH);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readSketch()).toEqual(EMPTY_SKETCH);
    expect(() => saveSketch({ axes: ['agua'], status: 'idea' })).not.toThrow();
  });

  it('RF-23 (021) · 23.2: con ejes es un edificio sin ubicación llamado «Boceto»; sin ejes no hay edificio', () => {
    expect(sketchItem(EMPTY_SKETCH)).toBeNull();
    expect(sketchItem({ axes: ['alimento'], status: 'en marcha' })).toEqual(
      expect.objectContaining({ id: SKETCH_ID, name: 'Boceto', axes: ['alimento'], status: 'en marcha', location: null, needs: '' }),
    );
  });
});
