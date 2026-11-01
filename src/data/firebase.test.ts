// T-1.29: la conexión a emuladores solo se pide de forma explícita y solo en desarrollo.
import { describe, expect, it } from 'vitest';
import { shouldUseEmulators } from './firebase';

describe('shouldUseEmulators', () => {
  it('en desarrollo con la bandera encendida conecta con los emuladores', () => {
    expect(shouldUseEmulators({ DEV: true, VITE_USE_EMULATORS: 'true' })).toBe(true);
  });

  it('sin la bandera o fuera de desarrollo nunca conecta con emuladores', () => {
    expect(shouldUseEmulators({ DEV: true })).toBe(false);
    expect(shouldUseEmulators({ DEV: true, VITE_USE_EMULATORS: 'false' })).toBe(false);
    expect(shouldUseEmulators({ DEV: false, VITE_USE_EMULATORS: 'true' })).toBe(false);
  });
});
