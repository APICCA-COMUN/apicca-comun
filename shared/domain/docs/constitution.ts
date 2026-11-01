// Lectura de la constitución a partir de `docs/constitution.md` (D-T17 (003), RF-15 (003) · 15.2).
import { inlineText, parseMarkdown, MarkdownError, type Block, type Inline } from './markdown';

export interface Principle {
  number: number;
  /** Encabezado en negrita, sin los dos puntos finales. */
  heading: string;
  /** Resto del principio, en línea. */
  text: Inline[];
}

export interface Constitution {
  title: string;
  principles: Principle[];
  /** Párrafo final (enmienda); `null` si el archivo no lo trae. */
  note: Inline[] | null;
}

/** El archivo no tiene la forma esperada (título, lista numerada consecutiva desde 1, nota). */
export class ConstitutionError extends Error {
  constructor(reason: string) {
    super(`Constitución mal formada: ${reason}`);
    this.name = 'ConstitutionError';
  }
}

/** Lanza `ConstitutionError` o `MarkdownError` si el texto no cumple la forma. */
export function parseConstitution(text: string): Constitution {
  const blocks: Block[] = parseMarkdown(text);

  const first = blocks[0];
  if (first?.type !== 'heading' || first.level !== 1) throw new ConstitutionError('falta el título «# …» al principio');
  const list = blocks.find((b): b is Extract<Block, { type: 'list' }> => b.type === 'list' && b.ordered);
  if (!list) throw new ConstitutionError('falta la lista numerada de principios');

  const principles = list.items.map((item, i): Principle => {
    if (item.number !== i + 1) {
      throw new ConstitutionError(`la numeración debe ser consecutiva desde 1: se esperaba ${i + 1} y hay ${item.number}`);
    }
    const [head, ...rest] = item.children;
    if (head?.type !== 'strong') throw new ConstitutionError(`el principio ${i + 1} no empieza con un encabezado en negrita`);
    const heading = inlineText(head.children).trim().replace(/:$/, '').trim();
    if (heading === '') throw new ConstitutionError(`el principio ${i + 1} tiene el encabezado vacío`);
    // El encabezado puede traer los dos puntos dentro o fuera de la negrita.
    const [lead, ...tail] = rest;
    const text: Inline[] =
      lead?.type === 'text' ? [{ type: 'text', text: lead.text.replace(/^:?\s+/, '') }, ...tail] : rest;
    return { number: item.number, heading, text };
  });

  const after = blocks.slice(blocks.indexOf(list) + 1).find((b) => b.type === 'paragraph');
  return { title: inlineText(first.children), principles, note: after?.type === 'paragraph' ? after.children : null };
}

export { MarkdownError };
