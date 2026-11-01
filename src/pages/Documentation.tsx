// RF-10 (008) · 10.1 a 10.6, D-13 (008): columna de 1040 px, grupos del lienzo y anterior/siguiente como texto.
// RF-14 (003) · 14.1–14.7, RNF-4 (003), D-T10 (003), D-T14 (003), D-T16 (003) · Página `/documentacion[/:articulo]`:
// índice de texto, artículo con «Documentación › <sección>» sobre el `h1`, y anterior/siguiente. Los `.md` se leen
// con `import.meta.glob` (trozo propio); la carga está separada (`loadArticles`) para poder inyectarla en pruebas.
// Si la carga falla, el error sube a `LazyBoundary`, que muestra el aviso con «Reintentar».
import { useEffect, useState } from 'react';
import { flattenIndex, neighbours, type DocsIndex } from '../../shared/domain/docs';
import { parseMarkdown, inlineText, type Block } from '../../shared/domain/docs/markdown';
import indexData from '../../docs/documentacion/indice.json';
import { Link } from '../app/router';
import { DocBlocks } from '../components/DocBlocks';
import { NotFound } from './NotFound';
import './Documentation.css';

/** Devuelve el texto de todos los artículos, por nombre de archivo. */
export type LoadArticles = () => Promise<Record<string, string>>;

const loaders = import.meta.glob('/docs/documentacion/*.md', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;

/** Carga real: lee todos los `.md` (comparten trozo) y los indexa por nombre de archivo. */
export const loadAllArticles: LoadArticles = async () => {
  const entries = await Promise.all(
    Object.entries(loaders).map(async ([path, load]) => [path.split('/').pop() ?? path, await load()] as const),
  );
  return Object.fromEntries(entries);
};

function titleOf(blocks: Block[]): string | null {
  const first = blocks.find((b) => b.type === 'heading' && b.level === 1);
  return first && first.type === 'heading' ? inlineText(first.children) : null;
}

interface Props {
  /** Segmento `:articulo` de la ruta; sin él se abre el primer artículo. */
  slug?: string | undefined;
  index?: DocsIndex;
  loadArticles?: LoadArticles;
}

export function Documentation({ slug, index = indexData as DocsIndex, loadArticles = loadAllArticles }: Props) {
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  useEffect(() => {
    let alive = true;
    loadArticles().then(
      (loaded) => alive && setFiles(loaded),
      (error: unknown) => alive && setFailure(error instanceof Error ? error : new Error(String(error))),
    );
    return () => {
      alive = false;
    };
  }, [loadArticles]);
  // El error sube a `LazyBoundary`, que muestra el aviso; «Reintentar» remonta la página y vuelve a cargar.
  if (failure) throw failure;
  if (!files) return <p>Cargando…</p>;
  const flat = flattenIndex(index);
  const target = slug ?? flat[0]?.slug;
  const around = target === undefined ? null : neighbours(index, target);
  if (!around) return <NotFound />;

  const { current, previous, next } = around;
  const parsed = new Map(flat.map((a) => [a.slug, parseMarkdown(files[a.archivo] ?? '')]));
  const titleFor = (s: string) => titleOf(parsed.get(s) ?? []) ?? s;

  return (
    <div className="documentation">
      <nav aria-label="Índice de la documentación" className="documentation__index">
        {index.secciones.map((section) => (
          <section key={section.titulo} className="documentation__section">
            <p className="documentation__section-title">{section.titulo}</p>
            <ul>
              {section.articulos.map((a) => (
                <li key={a.slug}>
                  <Link href={`/documentacion/${a.slug}`} {...(a.slug === current.slug ? { 'aria-current': 'page' as const } : {})}>
                    {titleFor(a.slug)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <article className="documentation__article">
        <span className="documentation__crumb">Documentación › {current.section}</span>
        <DocBlocks blocks={parsed.get(current.slug) ?? []} />
        <div className="documentation__pager">
          {previous && (
            <Link href={`/documentacion/${previous.slug}`} rel="prev" aria-label={`Anterior: ${titleFor(previous.slug)}`}>
              ← {titleFor(previous.slug)}
            </Link>
          )}
          {next && (
            <Link href={`/documentacion/${next.slug}`} rel="next" aria-label={`Siguiente: ${titleFor(next.slug)}`}>
              {titleFor(next.slug)} →
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}

export default Documentation;
