// T-43 (021) · RF-21 (021) · 21.3, 21.4, RNF-6 (021), D-T37 (021): la marca de que la invitación ya se vio vive solo en este
// navegador; si el almacenamiento falla, la invitación se sigue mostrando.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetWelcome, markWelcomeSeen, welcomeSeen } from './welcome';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('welcome', () => {
  it('RF-21 (021) · 21.3: al principio no se vio; tras marcarla, sí, y queda en este navegador', () => {
    expect(welcomeSeen()).toBe(false);
    markWelcomeSeen();
    expect(welcomeSeen()).toBe(true);
    expect(window.localStorage.getItem('apicca:bienvenida')).not.toBeNull();
  });

  it('RF-21 (021) · 21.4: olvidarla la vuelve a mostrar', () => {
    markWelcomeSeen();
    forgetWelcome();
    expect(welcomeSeen()).toBe(false);
  });

  it('RNF-6 (021): con el almacenamiento bloqueado no falla y la invitación se muestra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => markWelcomeSeen()).not.toThrow();
    expect(() => forgetWelcome()).not.toThrow();
    expect(welcomeSeen()).toBe(false);
  });
});
