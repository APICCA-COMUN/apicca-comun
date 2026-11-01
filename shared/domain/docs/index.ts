// Índice de la documentación (D-T14 (003), RF-14 (003) · 14.5, 14.6): puro, sin lectura de archivos.

export interface DocsIndexArticle {
  slug: string;
  archivo: string;
}

export interface DocsIndexSection {
  titulo: string;
  articulos: DocsIndexArticle[];
}

/** Forma de `docs/documentacion/indice.json`. */
export interface DocsIndex {
  secciones: DocsIndexSection[];
}

/** Un artículo del índice aplanado, con el título de su sección. */
export interface FlatArticle extends DocsIndexArticle {
  section: string;
}

export interface Neighbours {
  current: FlatArticle;
  previous: FlatArticle | null;
  next: FlatArticle | null;
}

/** Artículos de todas las secciones, en el orden del índice. */
export function flattenIndex(index: DocsIndex): FlatArticle[] {
  return index.secciones.flatMap((s) => s.articulos.map((a) => ({ slug: a.slug, archivo: a.archivo, section: s.titulo })));
}

/** Artículo vigente con su anterior y su siguiente; `null` si el `slug` no está en el índice. */
export function neighbours(index: DocsIndex, slug: string): Neighbours | null {
  const flat = flattenIndex(index);
  const at = flat.findIndex((a) => a.slug === slug);
  const current = flat[at];
  if (!current) return null;
  return { current, previous: flat[at - 1] ?? null, next: flat[at + 1] ?? null };
}
