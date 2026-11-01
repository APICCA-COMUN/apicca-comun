// Pruebas de resolución del tema según preferencia guardada y del sistema (RF-3 (002) · 3.3, D-22 (002)).
import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('RF-3 (002) · 3.3: sin elección sigue al sistema (light)', () => {
    expect(resolveTheme(undefined, 'light')).toBe('light');
  });

  it('RF-3 (002) · 3.3: sin elección sigue al sistema (dark)', () => {
    expect(resolveTheme(undefined, 'dark')).toBe('dark');
  });

  it('RF-3 (002) · 3.3: con elección manda la elección aunque el sistema sea dark', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

  it('RF-3 (002) · 3.3: con elección manda la elección aunque el sistema sea light', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('RF-3 (002) · 3.3: con valor null sigue al sistema', () => {
    expect(resolveTheme(null, 'light')).toBe('light');
    expect(resolveTheme(null, 'dark')).toBe('dark');
  });

  it('RF-3 (002) · 3.3: con valor inválido como sepia sigue al sistema', () => {
    expect(resolveTheme('sepia', 'light')).toBe('light');
    expect(resolveTheme('sepia', 'dark')).toBe('dark');
    expect(resolveTheme(123, 'dark')).toBe('dark');
    expect(resolveTheme({}, 'light')).toBe('light');
  });
});
