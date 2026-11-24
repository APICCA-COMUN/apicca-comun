// Jost servida desde el sitio, con los caracteres del español y un respaldo visible
// (RF-5 (002) · 5.1 a 5.4, D-T11 (002)).
import '../../src/styles/fonts.css';
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import fontUrl from '../../src/assets/fonts/jost-latin-var.woff2?url';

const SPANISH = [...'áéíóúÁÉÍÓÚñÑüÜ¿¡«»'];

/**
 * Los caracteres que la familia no dibuja. Se mide cada uno con dos respaldos de anchos muy
 * distintos: si el ancho no cambia, el glifo sale de la familia y no del respaldo.
 */
function missingGlyphs(family: string, chars: string[]): string[] {
  const context = document.createElement('canvas').getContext('2d')!;
  const width = (char: string, fallback: string) => {
    context.font = `64px "${family}", ${fallback}`;
    return context.measureText(char.repeat(8)).width;
  };
  return chars.filter((char) => width(char, 'monospace') !== width(char, 'serif'));
}

async function loadFace(family: string, unicodeRange?: string): Promise<void> {
  const face = new FontFace(family, `url(${fontUrl})`, unicodeRange === undefined ? {} : { unicodeRange });
  await face.load();
  document.fonts.add(face);
}

describe('fuente', () => {
  it('RF-5 (002) · 5.1: Jost carga desde el propio sitio', async () => {
    expect(new URL(fontUrl, location.href).origin).toBe(location.origin);
    await document.fonts.load('16px Jost');
    expect(document.fonts.check('16px Jost')).toBe(true);
    const jost = [...document.fonts].find((face) => face.family.replace(/["']/g, '') === 'Jost');
    expect(jost?.status).toBe('loaded');
  });

  it('RF-5 (002) · 5.2: el woff2 dibuja á é í ó ú Á É Í Ó Ú ñ Ñ ü Ü ¿ ¡ « »', async () => {
    await loadFace('Jost prueba');
    expect(missingGlyphs('Jost prueba', SPANISH)).toEqual([]);
  });

  it('RF-5 (002) · 5.2: la medición detecta una fuente sin ñ', async () => {
    // El mismo archivo limitado a un rango sin U+00F1 hace de fuente a la que le falta la ñ.
    await loadFace('Jost sin eñe', 'U+0000-00F0, U+00F2-00FF');
    expect(missingGlyphs('Jost sin eñe', SPANISH)).toEqual(['ñ']);
  });

  it('RF-5 (002) · 5.3, 5.4: con la fuente bloqueada y la precarga presente, el texto se ve con el respaldo', async () => {
    const page = await commands.openIndex({ block: ['font'] });
    expect(page.font.preload).toMatch(/\.woff2$/);
    expect(page.font.jost).toBe('error');
    expect(page.font.text.length).toBeGreaterThan(0);
    expect(page.font.textHeight).toBeGreaterThan(0);
    expect(page.font.family).toMatch(/^Jost, "Jost Fallback"/);
  });

  it('RF-5 (002) · 5.1: sin bloqueo, la página del build usa Jost', async () => {
    const page = await commands.openIndex();
    expect(page.font.jost).toBe('loaded');
  });
});
