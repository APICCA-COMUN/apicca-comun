// Convertidor de Markdown propio, sin dependencias (D-T15 (003), RNF-3 (003)).
// Subconjunto cerrado: encabezados #, ## y ###, párrafos, listas con viñeta y numeradas,
// citas, bloques de código cercados y, en línea, énfasis, negrita, código y enlaces.
// Todo lo demás (HTML crudo, imágenes, tablas, listas anidadas…) lanza `MarkdownError` con la línea.
// La salida es un árbol de datos: nunca se interpreta como HTML.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'emphasis'; children: Inline[] }
  | { type: 'strong'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] };

export interface ListItem {
  /** Número escrito en la fuente (listas numeradas); `null` en las de viñeta. */
  number: number | null;
  children: Inline[];
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; lang: string | null; text: string };

/** Construcción fuera del subconjunto o mal formada; `line` empieza en 1. */
export class MarkdownError extends Error {
  readonly line: number;
  constructor(reason: string, line: number) {
    super(`Markdown no admitido en la línea ${line}: ${reason}`);
    this.name = 'MarkdownError';
    this.line = line;
  }
}

/** Texto plano de una secuencia en línea (sin marcas). */
export function inlineText(inlines: Inline[]): string {
  return inlines.map((i) => (i.type === 'text' || i.type === 'code' ? i.text : inlineText(i.children))).join('');
}

// ---------------------------------------------------------------- en línea

const ESCAPABLE = '\\`*[]()<>#-_!|.+';
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

function parseInline(src: string, startLine: number): Inline[] {
  let pos = 0;
  const lineAt = (p: number) => startLine + (src.slice(0, p).match(/\n/g)?.length ?? 0);
  const fail = (reason: string, p: number): never => {
    throw new MarkdownError(reason, lineAt(p));
  };

  const push = (out: Inline[], text: string) => {
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += text;
    else out.push({ type: 'text', text });
  };

  // `stop` es el cierre que espera esta secuencia: '*', '**', ']' o null (fin del texto).
  function seq(stop: '*' | '**' | ']' | null, openedAt: number): Inline[] {
    const out: Inline[] = [];
    while (pos < src.length) {
      const c = src[pos] as string;
      const next = src[pos + 1];

      if (c === '\\' && next !== undefined && ESCAPABLE.includes(next)) {
        push(out, next);
        pos += 2;
      } else if (c === '`') {
        const end = src.indexOf('`', pos + 1);
        if (end < 0) fail('código en línea sin cerrar', pos);
        out.push({ type: 'code', text: src.slice(pos + 1, end).replace(/\n/g, ' ') });
        pos = end + 1;
      } else if (c === '!' && next === '[') {
        fail('las imágenes no están admitidas', pos);
      } else if (c === '<' && next !== undefined && /[A-Za-z/!]/.test(next)) {
        fail('el HTML crudo no está admitido', pos);
      } else if (c === ']' && stop === ']') {
        pos += 1;
        return out;
      } else if (c === '[') {
        const at = pos;
        pos += 1;
        const children = seq(']', at);
        if (src[pos] !== '(') fail('enlace sin destino: se esperaba [texto](destino)', at);
        const close = src.indexOf(')', pos + 1);
        if (close < 0) fail('enlace sin cerrar', at);
        const href = src.slice(pos + 1, close).trim();
        if (href === '' || /\s/.test(href)) fail('destino de enlace vacío o con espacios', at);
        pos = close + 1;
        out.push({ type: 'link', href, children });
      } else if (c === '*') {
        const double = next === '*';
        if (stop === '**' && double) {
          pos += 2;
          return out;
        }
        if (stop === '*' && !isSpace(src[pos - 1])) {
          pos += 1;
          return out;
        }
        const width = double ? 2 : 1;
        if (isSpace(src[pos + width])) {
          push(out, '*'.repeat(width)); // asterisco rodeado de espacios: texto
          pos += width;
        } else {
          const at = pos;
          pos += width;
          const children = seq(double ? '**' : '*', at);
          out.push({ type: double ? 'strong' : 'emphasis', children });
        }
      } else {
        push(out, c === '\n' ? ' ' : c);
        pos += 1;
      }
    }
    if (stop === '*') fail('énfasis sin cerrar', openedAt);
    if (stop === '**') fail('negrita sin cerrar', openedAt);
    if (stop === ']') fail('enlace sin cerrar', openedAt);
    return out;
  }

  return seq(null, 0);
}

// ----------------------------------------------------------------- bloques

const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;
const FENCE_OPEN = /^```\s*(\S*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const BULLET = /^[-*]\s+(.+)$/;
const ORDERED = /^(\d+)\.\s+(.+)$/;
const NESTED = /^\s+(?:[-*]|\d+\.)\s/;
const QUOTE = /^>\s?(.*)$/;

const isBlank = (l: string) => l.trim() === '';
const isTableLine = (l: string) => l.trimStart().startsWith('|') || TABLE_SEPARATOR.test(l);

function startsBlock(l: string): boolean {
  return (
    HEADING.test(l) || FENCE_OPEN.test(l) || RULE.test(l) || isTableLine(l) || BULLET.test(l) || ORDERED.test(l) || QUOTE.test(l)
  );
}

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] as string;
    const n = i + 1; // número de línea (desde 1)

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !FENCE_CLOSE.test(lines[j] as string)) body.push(lines[j++] as string);
      if (j >= lines.length) throw new MarkdownError('bloque de código sin cerrar', n);
      blocks.push({ type: 'code', lang: fence[1] || null, text: body.join('\n') });
      i = j + 1;
      continue;
    }

    if (RULE.test(line)) throw new MarkdownError('la regla horizontal no está admitida', n);
    if (isTableLine(line)) throw new MarkdownError('las tablas no están admitidas', n);

    const heading = HEADING.exec(line);
    if (heading) {
      const level = (heading[1] as string).length;
      if (level > 3) throw new MarkdownError('solo se admiten encabezados #, ## y ###', n);
      blocks.push({ type: 'heading', level: level as 1 | 2 | 3, children: parseInline(heading[2] as string, n) });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const parts: string[] = [];
      let j = i;
      while (j < lines.length && QUOTE.test(lines[j] as string)) parts.push(QUOTE.exec(lines[j++] as string)![1] as string);
      blocks.push({ type: 'quote', children: parseInline(parts.join('\n').trim(), n) });
      i = j;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const marker = ordered ? ORDERED : BULLET;
      const items: { number: number | null; raw: string; line: number }[] = [];
      let j = i;
      while (j < lines.length) {
        const cur = lines[j] as string;
        if (marker.test(cur)) {
          const m = marker.exec(cur)!;
          items.push({ number: ordered ? Number(m[1]) : null, raw: (ordered ? m[2] : m[1]) as string, line: j + 1 });
          j += 1;
        } else if (NESTED.test(cur)) {
          throw new MarkdownError('las listas anidadas no están admitidas', j + 1);
        } else if (/^\s+\S/.test(cur)) {
          (items[items.length - 1] as { raw: string }).raw += `\n${cur.trim()}`;
          j += 1;
        } else if (isBlank(cur)) {
          // Una línea vacía solo continúa la lista si el siguiente elemento es del mismo tipo.
          let k = j;
          while (k < lines.length && isBlank(lines[k] as string)) k += 1;
          if (k < lines.length && marker.test(lines[k] as string)) j = k;
          else break;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'list',
        ordered,
        items: items.map((it) => ({ number: it.number, children: parseInline(it.raw, it.line) })),
      });
      i = j;
      continue;
    }

    // Párrafo: sigue hasta una línea vacía o el inicio de otro bloque.
    const para: string[] = [line.trim()];
    let j = i + 1;
    while (j < lines.length && !isBlank(lines[j] as string) && !startsBlock(lines[j] as string)) para.push((lines[j++] as string).trim());
    blocks.push({ type: 'paragraph', children: parseInline(para.join('\n'), n) });
    i = j;
  }

  return blocks;
}
