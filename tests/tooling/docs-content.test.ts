// RF-14 (003) · 14.8, 14.9; D-T14 (003), D-26 (003): estructura de la documentación. Verifica el índice,
// los archivos, los títulos y los enlaces internos; no compara el texto, que redacta la persona.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchRoute } from '../../src/app/router';
import { flattenIndex, type DocsIndex } from '../../shared/domain/docs';
import { parseMarkdown, inlineText, type Block, type Inline } from '../../shared/domain/docs/markdown';

const DIR = resolve(import.meta.dirname, '../../docs/documentacion');

/** Los doce títulos que exige RF-14 (003) · 14.9. */
const REQUIRED_TITLES = [
  'Qué es APICCA',
  'Cómo entrar',
  'Tu primer ápice',
  'Ápice',
  'Ejes',
  'Ficha del ápice',
  'Imagen pixelada',
  'Historial',
  'Facilitación',
  'Constitución y propuestas',
  'Solicitar inscripción',
  'Mi tablero',
];

function links(inlines: Inline[]): string[] {
  return inlines.flatMap((i) => (i.type === 'link' ? [i.href, ...links(i.children)] : i.type === 'emphasis' || i.type === 'strong' ? links(i.children) : []));
}

function blockLinks(blocks: Block[]): string[] {
  return blocks.flatMap((b) => {
    if (b.type === 'list') return b.items.flatMap((it) => links(it.children));
    if (b.type === 'code') return [];
    return links(b.children);
  });
}

/** Primer `# ` del artículo, o `null` si no tiene. */
function titleOf(blocks: Block[]): string | null {
  const h = blocks.find((b) => b.type === 'heading' && b.level === 1);
  return h && h.type === 'heading' ? inlineText(h.children).trim() : null;
}

/** Devuelve la lista de problemas; vacía si la documentación es válida. */
function validateDocs(index: DocsIndex, files: Record<string, string>): string[] {
  const problems: string[] = [];
  const flat = flattenIndex(index);

  const slugs = new Set<string>();
  for (const a of flat) {
    if (slugs.has(a.slug)) problems.push(`slug repetido: ${a.slug}`);
    slugs.add(a.slug);
  }
  const listed = new Set(flat.map((a) => a.archivo));
  for (const a of flat) if (!(a.archivo in files)) problems.push(`falta el archivo: ${a.archivo}`);
  for (const f of Object.keys(files)) if (!listed.has(f)) problems.push(`archivo fuera del índice: ${f}`);

  const titles: string[] = [];
  for (const a of flat) {
    const text = files[a.archivo];
    if (text === undefined) continue;
    let blocks: Block[];
    try {
      blocks = parseMarkdown(text);
    } catch (e) {
      problems.push(`${a.archivo}: ${(e as Error).message}`);
      continue;
    }
    const title = titleOf(blocks);
    if (!title) problems.push(`${a.archivo}: sin título`);
    else titles.push(title);

    for (const href of blockLinks(blocks)) {
      if (/^https?:\/\//.test(href)) continue;
      if (!href.startsWith('/')) {
        problems.push(`${a.archivo}: enlace no admitido: ${href}`);
        continue;
      }
      const path = href.split(/[?#]/)[0] ?? '';
      const route = matchRoute(path);
      if (route.page === 'notFound') problems.push(`${a.archivo}: enlace a ruta inexistente: ${href}`);
      else if (route.page === 'documentation' && route.params.articulo && !slugs.has(route.params.articulo)) {
        problems.push(`${a.archivo}: enlace a un slug fuera del índice: ${href}`);
      }
    }
  }
  for (const t of REQUIRED_TITLES) if (!titles.includes(t)) problems.push(`falta el artículo: ${t}`);
  return problems;
}

/** Índice y artículos sintéticos válidos, con los doce títulos. */
function synthetic(): { index: DocsIndex; files: Record<string, string> } {
  const files: Record<string, string> = {};
  const articulos = REQUIRED_TITLES.map((t, i) => {
    const archivo = `${String(i + 1).padStart(2, '0')}-a${i}.md`;
    files[archivo] = `# ${t}\n\nTexto con [otro](/documentacion/a0) y [mapa](/prototipado#x).\n`;
    return { slug: `a${i}`, archivo };
  });
  return { index: { secciones: [{ titulo: 'Todo', articulos }] }, files };
}

describe('RF-14 (003) · 14.8, 14.9: contenido de la documentación', () => {
  const index = JSON.parse(readFileSync(resolve(DIR, 'indice.json'), 'utf8')) as DocsIndex;
  const files = Object.fromEntries(
    readdirSync(DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => [f, readFileSync(resolve(DIR, f), 'utf8')]),
  );

  it('RF-14 (003) · 14.8: la documentación real no tiene problemas de estructura ni de enlaces', () => {
    expect(validateDocs(index, files)).toEqual([]);
  });

  it('RF-14 (003) · 14.8: cada archivo del índice existe en disco', () => {
    for (const a of flattenIndex(index)) expect(existsSync(resolve(DIR, a.archivo)), a.archivo).toBe(true);
  });

  it('RF-14 (003) · 14.9: los doce títulos exigidos están en el índice real', () => {
    const titles = flattenIndex(index).map((a) => titleOf(parseMarkdown(files[a.archivo] ?? '')));
    for (const t of REQUIRED_TITLES) expect(titles, t).toContain(t);
  });

  it('RF-14 (003) · 14.8: el caso sintético válido no tiene problemas', () => {
    const { index: i, files: f } = synthetic();
    expect(validateDocs(i, f)).toEqual([]);
  });

  it('RF-14 (003) · 14.8: falla si falta un archivo del índice', () => {
    const { index: i, files: f } = synthetic();
    delete f['01-a0.md'];
    expect(validateDocs(i, f).join('\n')).toMatch(/falta el archivo: 01-a0\.md/);
  });

  it('RF-14 (003) · 14.8: falla si hay un archivo fuera del índice', () => {
    const { index: i, files: f } = synthetic();
    f['99-extra.md'] = '# Extra\n';
    expect(validateDocs(i, f).join('\n')).toMatch(/fuera del índice: 99-extra\.md/);
  });

  it('RF-14 (003) · 14.8: falla si se repite un slug', () => {
    const { index: i, files: f } = synthetic();
    i.secciones[0]!.articulos[1]!.slug = 'a0';
    expect(validateDocs(i, f).join('\n')).toMatch(/slug repetido: a0/);
  });

  it('RF-14 (003) · 14.8: falla si un artículo no tiene título', () => {
    const { index: i, files: f } = synthetic();
    f['02-a1.md'] = 'Solo un párrafo.\n';
    expect(validateDocs(i, f).join('\n')).toMatch(/02-a1\.md: sin título/);
  });

  it('RF-14 (003) · 14.9: falla si falta uno de los doce títulos', () => {
    const { index: i, files: f } = synthetic();
    f['12-a11.md'] = '# Otro título\n';
    expect(validateDocs(i, f).join('\n')).toMatch(/falta el artículo: Mi tablero/);
  });

  it('RF-14 (003) · 14.8: falla con un enlace a una ruta inexistente', () => {
    const { index: i, files: f } = synthetic();
    f['03-a2.md'] += '\n[roto](/no-existe)\n';
    expect(validateDocs(i, f).join('\n')).toMatch(/03-a2\.md: enlace a ruta inexistente: \/no-existe/);
  });

  it('RF-14 (003) · 14.8: falla con un enlace a un slug de documentación fuera del índice', () => {
    const { index: i, files: f } = synthetic();
    f['03-a2.md'] += '\n[roto](/documentacion/nada)\n';
    expect(validateDocs(i, f).join('\n')).toMatch(/slug fuera del índice: \/documentacion\/nada/);
  });

  it('RF-14 (003) · 14.8: falla con un enlace de esquema no admitido', () => {
    const { index: i, files: f } = synthetic();
    f['03-a2.md'] += '\n[x](javascript:alert)\n';
    expect(validateDocs(i, f).join('\n')).toMatch(/enlace no admitido/);
  });
});
