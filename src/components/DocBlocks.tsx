// RF-14 (003) · 14.1, RNF-3 (003), D-T15 (003) · Pinta el árbol de `parseMarkdown` con elementos de React.
// Nunca interpreta el texto como HTML: no hay `innerHTML` y un enlace de esquema no admitido queda como texto.
import { Fragment } from 'react';
import type { Block, Inline } from '../../shared/domain/docs/markdown';
import { Link } from '../app/router';
import './DocBlocks.css';

/** Secuencia en línea: texto, énfasis, negrita, código y enlaces. */
export function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, i) => (
        <Fragment key={i}>{renderInline(inline)}</Fragment>
      ))}
    </>
  );
}

function renderInline(inline: Inline) {
  switch (inline.type) {
    case 'text':
      return inline.text;
    case 'emphasis':
      return (
        <em>
          <Inlines inlines={inline.children} />
        </em>
      );
    case 'strong':
      return (
        <strong>
          <Inlines inlines={inline.children} />
        </strong>
      );
    case 'code':
      return <code>{inline.text}</code>;
    case 'link': {
      const children = <Inlines inlines={inline.children} />;
      if (inline.href.startsWith('/') && !inline.href.startsWith('//')) return <Link href={inline.href}>{children}</Link>;
      if (/^https?:\/\//i.test(inline.href)) {
        return (
          <a href={inline.href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }
      return children;
    }
  }
}

/** Bloques de un artículo: encabezados `##`/`###`, párrafos, listas, citas y código. */
export function DocBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="doc-blocks">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: Block) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return (
        <Tag>
          <Inlines inlines={block.children} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p>
          <Inlines inlines={block.children} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines inlines={item.children} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote>
          <Inlines inlines={block.children} />
        </blockquote>
      );
    case 'code':
      return (
        <pre tabIndex={0}>
          <code>{block.text}</code>
        </pre>
      );
  }
}
