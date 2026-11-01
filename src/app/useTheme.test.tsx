// Pruebas del gancho useTheme (RF-3 (002) · 3.3, RF-3 (002) · 3.4, D-22 (002), D-T7 (002)).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../shared/domain/identity';
import { THEME_KEY, applyTheme } from './theme';
import { useTheme } from './useTheme';

type Listener = (event: { matches: boolean }) => void;

function fakeSystem(dark: boolean): { listeners: Listener[]; setDark: (next: boolean) => void } {
  let isDark = dark;
  const listeners: Listener[] = [];
  window.matchMedia = ((query: string) => ({
    matches: isDark && query.includes('dark'),
    media: query,
    addEventListener: (_: string, listener: Listener) => {
      listeners.push(listener);
    },
    removeEventListener: (_: string, listener: Listener) => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    },
  })) as unknown as typeof window.matchMedia;

  const setDark = (next: boolean) => {
    isDark = next;
    for (const listener of [...listeners]) {
      listener({ matches: next });
    }
  };

  return { listeners, setDark };
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    fakeSystem(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RF-3 (002) · 3.3: sin elección el tema sigue al sistema cuando cambia', () => {
    const sys = fakeSystem(false);
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset['theme']).toBeUndefined();

    act(() => {
      sys.setDark(true);
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('RF-3 (002) · 3.3: con elección el aviso del sistema se ignora (D-22 (002))', () => {
    const sys = fakeSystem(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');

    act(() => {
      sys.setDark(false);
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('RF-3 (002) · 3.4: evento storage de otra pestaña con valor válido aplica el tema', () => {
    fakeSystem(false);
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'dark' }));
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('RF-3 (002) · 3.4: evento storage con valor nulo vuelve a seguir al sistema', () => {
    const sys = fakeSystem(false);
    applyTheme('dark');
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: null }));
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset['theme']).toBeUndefined();

    act(() => {
      sys.setDark(true);
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('RF-3 (002) · 3.4: evento storage con valor inválido vuelve a seguir al sistema', () => {
    const sys = fakeSystem(false);
    applyTheme('dark');
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'sepia' }));
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset['theme']).toBeUndefined();

    act(() => {
      sys.setDark(true);
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('RF-11 (002) · 11.3: cuando otra pestaña borra la elección, cada theme-color vuelve al fondo de su esquema (D-T7 (002))', () => {
    fakeSystem(false);
    const metas = (['light', 'dark'] as const).map((scheme) => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.media = `(prefers-color-scheme: ${scheme})`;
      document.head.append(meta);
      return meta;
    });
    try {
      applyTheme('dark');
      renderHook(() => useTheme());
      expect(metas.map((meta) => meta.content)).toEqual([TOKENS.dark.background, TOKENS.dark.background]);

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: null }));
      });

      expect(metas.map((meta) => meta.content)).toEqual([TOKENS.light.background, TOKENS.dark.background]);
    } finally {
      for (const meta of metas) meta.remove();
    }
  });
});
