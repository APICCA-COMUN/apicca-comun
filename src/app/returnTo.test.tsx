import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInternalPath, saveReturnTo, takeReturnTo } from './returnTo';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('returnTo · ruta de origen (D-T19 (004))', () => {
  it('RF-3 (004) · 3.4: solo son internas las rutas que empiezan por «/» y no por «//» ni «/\\»', () => {
    expect(isInternalPath('/constitucion/historial')).toBe(true);
    expect(isInternalPath('//otro.sitio')).toBe(false);
    expect(isInternalPath('/\\otro.sitio')).toBe(false);
    expect(isInternalPath('https://otro.sitio')).toBe(false);
    expect(isInternalPath('constitucion')).toBe(false);
  });

  it('RF-3 (004) · 3.4: guarda la ruta, la entrega una sola vez y la borra', () => {
    saveReturnTo('/constitucion/historial');
    expect(takeReturnTo()).toBe('/constitucion/historial');
    expect(takeReturnTo()).toBeNull();
  });

  it('RF-3 (004) · 3.4: no guarda una ruta que no es interna', () => {
    saveReturnTo('//otro.sitio');
    expect(window.sessionStorage.getItem('apicca:returnTo')).toBeNull();
  });

  it('RF-3 (004) · 3.4: si sessionStorage falla, no lanza', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => saveReturnTo('/constitucion/historial')).not.toThrow();
    expect(takeReturnTo()).toBeNull();
  });
});
