// RF-11 (002) · 11.1, 11.2, RF-1 (002) · 1.7, D-21 (002): metadatos de vista previa e íconos en index.html.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');

/** Extrae el atributo content de una etiqueta <meta> por name o property. */
function getMeta(attr: 'name' | 'property', value: string): string | undefined {
  const tagRegex = new RegExp(`<meta\\s+[^>]*?${attr}=["']${value}["'][^>]*?>`, 'i');
  const match = tagRegex.exec(html);
  if (!match) return undefined;
  const contentMatch = /content=["']([^"']*)["']/i.exec(match[0]);
  return contentMatch ? contentMatch[1] : undefined;
}

/** Extrae los atributos de las etiquetas <link> que coinciden con el rel indicado. */
function getLinks(rel: string): Array<Record<string, string>> {
  const linkRegex = /<link\s+([^>]+)>/gi;
  const results: Array<Record<string, string>> = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const attrsStr = match[1] ?? '';
    const attrRegex = /([a-z0-9_-]+)=["']([^"']*)["']/gi;
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      if (attrMatch[1] && attrMatch[2] !== undefined) {
        attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
      }
    }
    if (attrs.rel === rel) {
      results.push(attrs);
    }
  }
  return results;
}

describe('index.html · metadatos de vista previa e íconos', () => {
  it('RF-11 (002) · 11.1: index.html declara metadatos de vista previa con og:image en apicca.com, og:description igual a description y twitter:card', () => {
    const metaDesc = getMeta('name', 'description');
    expect(metaDesc).toBe('API para Crear y Conectar Acciones Comunes');

    const ogTitle = getMeta('property', 'og:title');
    expect(ogTitle).toBe('APICCA COMÚN');

    const ogDesc = getMeta('property', 'og:description');
    expect(ogDesc).toBe(metaDesc);

    const ogImage = getMeta('property', 'og:image');
    expect(ogImage).toBe('https://apicca.com/brand/og-image.png');

    const twitterCard = getMeta('name', 'twitter:card');
    expect(twitterCard).toBe('summary_large_image');
  });

  it('RF-11 (002) · 11.2: index.html declara el ícono para pantalla de inicio con ruta relativa sin dominio', () => {
    const appleLinks = getLinks('apple-touch-icon');
    expect(appleLinks.length).toBeGreaterThanOrEqual(1);
    const appleIcon = appleLinks[0];
    const href = appleIcon?.href ?? '';
    expect(href).toBe('/brand/apple-touch-icon.png');
    expect(href.startsWith('/')).toBe(true);
    expect(href).not.toMatch(/^https?:\/\//);
    expect(href).not.toMatch(/^\/\//);
  });

  it('RF-1 (002) · 1.7: index.html declara los íconos de pestaña en SVG y PNG 32x32 con rutas relativas sin dominio', () => {
    const iconLinks = getLinks('icon');
    expect(iconLinks.length).toBeGreaterThanOrEqual(2);

    const svgIcon = iconLinks.find((link) => link.type === 'image/svg+xml');
    expect(svgIcon).toBeDefined();
    const svgHref = svgIcon?.href ?? '';
    expect(svgHref).toBe('/brand/favicon.svg');
    expect(svgHref.startsWith('/')).toBe(true);
    expect(svgHref).not.toMatch(/^https?:\/\//);
    expect(svgHref).not.toMatch(/^\/\//);

    const pngIcon = iconLinks.find((link) => link.sizes === '32x32');
    expect(pngIcon).toBeDefined();
    expect(pngIcon?.type).toBe('image/png');
    const pngHref = pngIcon?.href ?? '';
    expect(pngHref).toBe('/brand/favicon-32.png');
    expect(pngHref.startsWith('/')).toBe(true);
    expect(pngHref).not.toMatch(/^https?:\/\//);
    expect(pngHref).not.toMatch(/^\/\//);

    for (const link of iconLinks) {
      const href = link.href ?? '';
      expect(href.startsWith('/')).toBe(true);
      expect(href).not.toMatch(/^https?:\/\//);
      expect(href).not.toMatch(/^\/\//);
    }
  });
});
