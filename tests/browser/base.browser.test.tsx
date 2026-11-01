// La hoja base en los dos temas, con estilos calculados (RF-3 (002) · 3.1, 3.2, 3.5,
// RF-5 (002) · 5.5, RF-6 (002) · 6.4, D-T11 (002)) y el fondo pleno (RF-1 (003) · 1.1–1.3).
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { hexToRgb, THEMES, TOKENS } from '../../shared/domain/identity';

const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;
const root = document.documentElement;

afterEach(() => {
  delete root.dataset['theme'];
  document.body.replaceChildren();
});

describe.each(THEMES)('hoja base en el tema %s', (theme) => {
  it(`RF-1 (003) · 1.${theme === 'light' ? 1 : 2}: fondo pleno ${theme} con el token background`, () => {
    root.dataset['theme'] = theme;
    expect(getComputedStyle(root).backgroundColor).toBe(rgb(TOKENS[theme].background));
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it(`RF-1 (003) · 1.3: el fondo ${theme} no tiene cuadrícula, degradado, textura ni imagen`, () => {
    root.dataset['theme'] = theme;
    for (const el of [root, document.body]) {
      const style = getComputedStyle(el);
      expect(style.backgroundImage).toBe('none');
      expect(style.backgroundSize).not.toBe('24px 24px');
    }
    expect(getComputedStyle(root).getPropertyValue('--grid')).toBe('');
  });

  it('RF-3 (002) · 3.5: color-scheme y color de texto del tema', () => {
    root.dataset['theme'] = theme;
    const style = getComputedStyle(root);
    expect(style.colorScheme).toBe(theme);
    expect(style.color).toBe(rgb(TOKENS[theme].text));
  });

  it('RF-5 (002) · 5.5: párrafos y campos de 16 px con la pila de Nunito', () => {
    root.dataset['theme'] = theme;
    document.body.innerHTML = '<p>Texto</p><input aria-label="Campo"><textarea aria-label="Área"></textarea><select aria-label="Lista"></select><button>Botón</button>';
    for (const selector of ['p', 'input', 'textarea', 'select', 'button']) {
      const style = getComputedStyle(document.querySelector(selector)!);
      expect(parseFloat(style.fontSize), selector).toBeGreaterThanOrEqual(16);
      expect(style.fontFamily, selector).toMatch(/^Nunito, "Nunito Fallback"/);
    }
  });

  it('RF-6 (002) · 6.4: el foco de teclado se ve con el token focus', async () => {
    root.dataset['theme'] = theme;
    document.body.innerHTML = '<a href="#x">Enlace</a><button>Botón</button><input aria-label="Campo">';
    for (const selector of ['a', 'button', 'input']) {
      await userEvent.keyboard('{Tab}');
      const element = document.querySelector(selector)!;
      expect(document.activeElement).toBe(element);
      const style = getComputedStyle(element);
      expect(style.outlineStyle, selector).toBe('solid');
      expect(parseFloat(style.outlineWidth), selector).toBeGreaterThanOrEqual(2);
      expect(style.outlineColor, selector).toBe(rgb(TOKENS[theme].focus));
    }
  });

  it('RF-3 (002) · 3.1: los enlaces usan action-blue', () => {
    root.dataset['theme'] = theme;
    document.body.innerHTML = '<a href="#x">Enlace</a>';
    expect(getComputedStyle(document.querySelector('a')!).color).toBe(rgb(TOKENS[theme]['action-blue']));
  });
});
