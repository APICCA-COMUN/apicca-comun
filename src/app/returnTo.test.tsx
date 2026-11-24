// RF-9 (024) · 9.2: la ruta de cada una de las cuatro páginas que vuelven al origen es interna y se guarda.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchRoute } from './router';
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

  it.each([
    ['/apices/a1/editar', 'apiceEdit'],
    ['/archivados', 'archived'],
    ['/apices/a1/historial', 'apiceHistory'],
    ['/facilitacion/cuentas', 'facilitationAccounts'],
    ['/facilitacion/invitaciones', 'facilitationInvitations'],
    ['/facilitacion/solicitudes', 'facilitationEnrollments'],
  ] as const)('RF-9 (024) · 9.2: la ruta %s es de la página %s, interna, y se guarda y se entrega tal cual', (path, page) => {
    expect(matchRoute(path).page).toBe(page);
    expect(isInternalPath(path)).toBe(true);
    saveReturnTo(path);
    expect(takeReturnTo()).toBe(path);
  });
});
