// Regresión del correo de restablecimiento: el enlace vuelve a la página de acción del propio sitio (RF-3 (001)).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPasswordResetEmail } = vi.hoisted(() => ({ sendPasswordResetEmail: vi.fn(() => Promise.resolve()) }));

vi.mock('firebase/auth', () => ({
  sendPasswordResetEmail,
  signInWithEmailAndPassword: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));
vi.mock('./firebase', () => ({ firebase: () => ({ auth: 'auth-de-prueba' }) }));

const { firebaseAuthService } = await import('./authService');

beforeEach(() => sendPasswordResetEmail.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe('firebaseAuthService.sendReset', () => {
  it('RF-3 (001): el enlace del correo lleva a /accion del sitio desde el que se pidió', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://apicca--preview-0rd2vdcl.web.app' } });
    await firebaseAuthService.sendReset('ana@ejemplo.org');
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('auth-de-prueba', 'ana@ejemplo.org', {
      url: 'https://apicca--preview-0rd2vdcl.web.app/accion',
      handleCodeInApp: true,
    });
  });

  it('RF-3 (001): sin ventana, el enlace usa el sitio publicado', async () => {
    vi.stubGlobal('window', undefined);
    await firebaseAuthService.sendReset('ana@ejemplo.org');
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('auth-de-prueba', 'ana@ejemplo.org', {
      url: 'https://apicca.web.app/accion',
      handleCodeInApp: true,
    });
  });
});
