// Primer pintado del `index.html` real (RNF-6 (002), RF-3 (002) · 3.5, RF-11 (002) · 11.3, RNF-6 (003)): lo
// que se ve antes de la hoja de estilos, sin JavaScript, y el color de la barra del navegador.
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { hexToRgb, THEMES, TOKENS, type ThemeName } from '../../shared/domain/identity';

const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;
const other = (theme: ThemeName): ThemeName => (theme === 'light' ? 'dark' : 'light');

describe.each(THEMES)('primer pintado con el sistema en %s', (scheme) => {
  it(`RNF-6 (002): con la hoja bloqueada, el fondo, el texto y color-scheme son los del tema ${scheme}`, async () => {
    const page = await commands.openIndex({ colorScheme: scheme, block: ['stylesheet', 'font'] });
    expect(page.background).toBe(rgb(TOKENS[scheme].background));
    expect(page.color).toBe(rgb(TOKENS[scheme].text));
    expect(page.colorScheme).toBe(scheme);
  });

  it('RF-3 (002) · 3.5: con la hoja bloqueada y el tema contrario elegido, manda la elección', async () => {
    const theme = other(scheme);
    const page = await commands.openIndex({ colorScheme: scheme, theme, block: ['stylesheet'] });
    expect(page.dataTheme).toBe(theme);
    expect(page.background).toBe(rgb(TOKENS[theme].background));
    expect(page.colorScheme).toBe(theme);
  });

  it('RNF-6 (002): sin JavaScript, el <noscript> se ve sobre el fondo del tema', async () => {
    const page = await commands.openIndex({ colorScheme: scheme, javaScript: false });
    expect(page.noscript.visible).toBe(true);
    expect(page.noscript.text).toMatch(/necesita JavaScript/);
    expect(page.noscript.color).toBe(rgb(TOKENS[scheme].text));
    expect(page.background).toBe(rgb(TOKENS[scheme].background));
  });

  it('RNF-6 (002): con JavaScript, el <noscript> no se ve', async () => {
    const page = await commands.openIndex({ colorScheme: scheme });
    expect(page.noscript.visible).toBe(false);
  });

  it('RF-11 (002) · 11.3: sin elección, cada theme-color vale el background de su esquema', async () => {
    const page = await commands.openIndex({ colorScheme: scheme });
    expect(page.themeColors).toEqual({
      '(prefers-color-scheme: light)': TOKENS.light.background,
      '(prefers-color-scheme: dark)': TOKENS.dark.background,
    });
  });

  it('RF-11 (002) · 11.3: con elección, las dos theme-color valen el background del tema elegido', async () => {
    for (const theme of THEMES) {
      const page = await commands.openIndex({ colorScheme: scheme, theme });
      expect(Object.values(page.themeColors)).toEqual([TOKENS[theme].background, TOKENS[theme].background]);
    }
  });
});

describe('primer pintado con el papel y la tinta del sistema', () => {
  it('RNF-6 (003): con la hoja bloqueada, el fondo claro es el papel y el oscuro la tinta, con y sin elección', async () => {
    const light = TOKENS.light.background;
    const dark = TOKENS.dark.background;
    expect(light).not.toBe(dark);
    const paper = await commands.openIndex({ colorScheme: 'light', block: ['stylesheet', 'font'] });
    expect(paper.background).toBe(rgb(light));
    expect(paper.themeColors['(prefers-color-scheme: light)']).toBe(light);
    const chosen = await commands.openIndex({ colorScheme: 'dark', theme: 'light', block: ['stylesheet'] });
    expect(chosen.background).toBe(rgb(light));
    expect(Object.values(chosen.themeColors)).toEqual([light, light]);
    const night = await commands.openIndex({ colorScheme: 'dark', block: ['stylesheet', 'font'] });
    expect(night.background).toBe(rgb(dark));
  });
});
