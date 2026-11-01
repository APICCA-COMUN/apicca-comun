// El tema: dos posiciones, arranque en lo que el sistema dice y memoria en el navegador de
// quien visita, no en su cuenta.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { TOKENS } from '../../shared/domain/identity';
import { THEME_KEY, applyTheme, currentTheme, observeSystem, savedTheme } from './theme';

type Listener = (event: { matches: boolean }) => void;

/** Reemplaza el doble de `matchMedia` de `setup-dom` por uno que declara el tema del sistema. */
function fakeSystem(dark: boolean): Listener[] {
  const listeners: Listener[] = [];
  window.matchMedia = ((query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: (_: string, listener: Listener) => {
      listeners.push(listener);
    },
    removeEventListener: (_: string, listener: Listener) => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    },
  })) as unknown as typeof window.matchMedia;
  return listeners;
}

describe('el tema', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    fakeSystem(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mientras nadie elija, el tema es el que el sistema declara', () => {
    expect(savedTheme()).toBeNull();
    expect(currentTheme()).toBe('light');
    fakeSystem(true);
    expect(currentTheme()).toBe('dark');
    // Seguir al sistema es no poner el atributo.
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('la elección manda sobre el sistema y sobrevive a la recarga', () => {
    fakeSystem(true);
    applyTheme('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(currentTheme()).toBe('light');
    // Una recarga es el documento otra vez en blanco y el mismo almacenamiento.
    delete document.documentElement.dataset['theme'];
    expect(savedTheme()).toBe('light');
  });

  it('un valor guardado que no es un tema se ignora', () => {
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(savedTheme()).toBeNull();
    expect(currentTheme()).toBe('light');
  });

  // En una ventana privada, `localStorage` lanza al leer y al escribir. El sitio tiene que
  // seguir viéndose: se pierde la memoria, no la página.
  it('si el navegador no deja guardar, el tema sigue cambiando', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(savedTheme()).toBeNull();
    expect(() => applyTheme('dark')).not.toThrow();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('si el sistema cambia y nadie eligió, el sitio le sigue', () => {
    const listeners = fakeSystem(false);
    const seen: string[] = [];
    const stop = observeSystem((theme) => seen.push(theme));
    for (const listener of [...listeners]) listener({ matches: true });
    expect(seen).toEqual(['dark']);
    stop();
    for (const listener of [...listeners]) listener({ matches: false });
    expect(seen).toEqual(['dark']);
  });

  it('el guion de arranque de index.html usa la misma clave y los mismos valores', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`);
    expect(html).toContain("theme === 'light' || theme === 'dark'");
    expect(html).toContain('dataset.theme');
  });

  describe('theme-color (RF-11 (002) · 11.3, D-T7 (002))', () => {
    const page = new DOMParser().parseFromString(indexHtml, 'text/html');
    const bootScript = [...page.querySelectorAll('body script:not([src])')].map((script) => script.textContent).join('\n');
    const metas = () => [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const byMedia = (scheme: string) => metas().find((meta) => meta.getAttribute('media') === `(prefers-color-scheme: ${scheme})`);

    beforeEach(() => {
      // El <head> real de index.html, con sus dos metas tal como salen del repositorio.
      document.head.innerHTML = page.head.innerHTML;
    });

    it('RF-11 (002) · 11.3: index.html tiene dos theme-color, una por esquema, sin colores a mano', () => {
      expect(metas()).toHaveLength(2);
      expect(byMedia('light')).toBeDefined();
      expect(byMedia('dark')).toBeDefined();
      for (const meta of metas()) expect(meta.hasAttribute('content')).toBe(false);
    });

    it('RF-11 (002) · 11.3: sin elección, el arranque pone a cada meta el background de su esquema', () => {
      new Function(bootScript)();
      expect(byMedia('light')!.content).toBe(TOKENS.light.background);
      expect(byMedia('dark')!.content).toBe(TOKENS.dark.background);
    });

    it('RF-11 (002) · 11.3: con una elección guardada, el arranque pone su background en las dos', () => {
      localStorage.setItem(THEME_KEY, 'dark');
      new Function(bootScript)();
      for (const meta of metas()) expect(meta.content).toBe(TOKENS.dark.background);
    });

    it('RF-11 (002) · 11.3: tras applyTheme, las dos metas valen el background del tema elegido', () => {
      new Function(bootScript)();
      applyTheme('dark');
      for (const meta of metas()) expect(meta.content).toBe(TOKENS.dark.background);
      applyTheme('light');
      for (const meta of metas()) expect(meta.content).toBe(TOKENS.light.background);
    });
  });
});
