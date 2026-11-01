// Doble de `AuthService` para las pruebas de interfaz: cada método registra sus llamadas
// y se puede programar para que falle con un código de Firebase Auth.
import { vi } from 'vitest';
import type { AuthService } from '../data/authService';

export function authError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

export function fakeAuth(overrides: Partial<AuthService> = {}): { [K in keyof AuthService]: ReturnType<typeof vi.fn> } & AuthService {
  return {
    signIn: vi.fn(() => Promise.resolve()),
    sendReset: vi.fn(() => Promise.resolve()),
    verifyResetCode: vi.fn(() => Promise.resolve('ana@ejemplo.org')),
    confirmReset: vi.fn(() => Promise.resolve()),
    ...overrides,
  } as never;
}
