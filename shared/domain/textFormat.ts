// Formato del texto: parser propio que convierte el texto en un árbol de bloques e inline. Gramática cerrada: párrafos,
// listas con viñetas (`- `) y numeradas (`n. `), negrita, cursiva y enlaces;
// cualquier otro marcado es texto literal. La web pinta el árbol sin `innerHTML`
// y solo crea <a> cuando `isSafeUrl` acepta la dirección.
import { validateUrl } from './urls';
import { countCodePoints } from './limits';

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'link'; url: string; children: InlineNode[] };

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] };

const BULLET = /^- (.*)$/;
const NUMBERED = /^\d+\. (.*)$/;

type LineKind = 'bullet' | 'numbered' | 'plain';

interface Line {
  kind: LineKind;
  /** Contenido sin el marcador de lista. */
  content: string;
}

function classify(line: string): Line {
  const bullet = BULLET.exec(line);
  if (bullet) return { kind: 'bullet', content: bullet[1] ?? '' };
  const numbered = NUMBERED.exec(line);
  if (numbered) return { kind: 'numbered', content: numbered[1] ?? '' };
  return { kind: 'plain', content: line };
}

/**
 * Los saltos de línea del sitio son `\n`: `\r\n` y `\r` sueltos se reducen a él antes de
 * mirar el texto. Está exportada porque no la usa solo el parser: cualquier módulo que parta
 * el texto en párrafos debe hacerlo con este mismo criterio, y dos maneras distintas de contar
 * una línea en blanco harían que la interfaz pintara un párrafo donde el módulo no ve ninguno.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Parte el texto en bloques separados por líneas en blanco.
 *
 * Está exportada para que quien necesite el texto ya partido en párrafos lo parta **con este
 * mismo criterio**; contarlos de otra manera haría que la interfaz y la lógica discreparan.
 */
export function splitBlocks(text: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const raw of normalizeLineEndings(text).split('\n')) {
    if (raw.trim().length === 0) {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push(raw);
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

export interface TextLinkError {
  /** La dirección rechazada o el `[texto](` que quedó sin cerrar. */
  link: string;
  reason: string;
}

/**
 * Inline de una línea: `**negrita**`, `*cursiva*`, `[texto](https://…)`.
 * Un marcador sin pareja o sin contenido es literal; el guion bajo es siempre literal.
 * Todo `[…](` abre un enlace: si no se cierra con `)` en la misma línea o su
 * dirección lleva espacios, se anota el error y el tramo queda como texto literal.
 * El formato no cruza líneas porque cada línea se parsea aparte.
 */
function parseInline(text: string, errors: TextLinkError[]): InlineNode[] {
  const nodes: InlineNode[] = [];
  let literal = '';
  const flush = () => {
    if (literal.length > 0) nodes.push({ type: 'text', text: literal });
    literal = '';
  };
  let i = 0;
  while (i < text.length) {
    const wrapped = matchWrapped(text, i);
    if (wrapped) {
      flush();
      nodes.push({ type: wrapped.type, children: parseInline(wrapped.inner, errors) });
      i = wrapped.end;
      continue;
    }
    const link = matchLink(text, i, errors);
    if (link) {
      flush();
      nodes.push({ type: 'link', url: link.url, children: parseInline(link.label, errors) });
      i = link.end;
      continue;
    }
    literal += text[i];
    i += 1;
  }
  flush();
  return nodes;
}

const LINK_OPEN = '](';

/** Si en `at` empieza `[texto](dirección)`, devuelve el tramo (anotando el error si la dirección no es válida); si está mal formado, anota el error y devuelve `null`. */
function matchLink(text: string, at: number, errors: TextLinkError[]): { label: string; url: string; end: number } | null {
  if (text[at] !== '[') return null;
  const labelEnd = text.indexOf(LINK_OPEN, at + 1);
  if (labelEnd === -1) return null;
  const opener = text.slice(at, labelEnd + LINK_OPEN.length);
  const urlStart = labelEnd + LINK_OPEN.length;
  const close = text.indexOf(')', urlStart);
  if (close === -1) {
    errors.push({ link: opener, reason: 'el enlace debe cerrar su dirección con ")" en la misma línea' });
    return null;
  }
  const url = text.slice(urlStart, close);
  if (/\s/.test(url)) {
    errors.push({ link: opener + url + ')', reason: 'la dirección de un enlace no admite espacios' });
    return null;
  }
  const valid = validateUrl(url);
  if (!valid.ok) errors.push({ link: url, reason: valid.reason });
  return { label: text.slice(at + 1, labelEnd), url, end: close + 1 };
}

const MARKERS: ReadonlyArray<{ marker: string; type: 'bold' | 'italic' }> = [
  { marker: '**', type: 'bold' },
  { marker: '*', type: 'italic' },
];

/** Si en `at` empieza un marcador con pareja y contenido, devuelve el tramo; si no, `null`. */
function matchWrapped(text: string, at: number): { type: 'bold' | 'italic'; inner: string; end: number } | null {
  for (const { marker, type } of MARKERS) {
    if (!text.startsWith(marker, at)) continue;
    const start = at + marker.length;
    const close = text.indexOf(marker, start);
    if (close > start) return { type, inner: text.slice(start, close), end: close + marker.length };
  }
  return null;
}

/** Un bloque de líneas se parte en corridas de la misma clase: párrafo, viñetas o numerada. */
function parseBlock(lines: string[], errors: TextLinkError[]): BlockNode[] {
  const nodes: BlockNode[] = [];
  let run: Line[] = [];
  const flush = () => {
    const first = run[0];
    if (!first) return;
    if (first.kind === 'plain') {
      const children: InlineNode[] = [];
      run.forEach((line, i) => {
        if (i > 0) children.push({ type: 'break' });
        children.push(...parseInline(line.content, errors));
      });
      nodes.push({ type: 'paragraph', children });
    } else {
      nodes.push({ type: 'list', ordered: first.kind === 'numbered', items: run.map((l) => parseInline(l.content, errors)) });
    }
    run = [];
  };
  for (const line of lines.map(classify)) {
    if (run.length > 0 && run[0]?.kind !== line.kind) flush();
    run.push(line);
  }
  flush();
  return nodes;
}

function parse(text: string): { tree: BlockNode[]; errors: TextLinkError[] } {
  const errors: TextLinkError[] = [];
  const tree = splitBlocks(text).flatMap((lines) => parseBlock(lines, errors));
  return { tree, errors };
}

/** Convierte el texto en el árbol de bloques que pinta la web. */
export function parseText(text: string): BlockNode[] {
  return parse(text).tree;
}

export interface TextResult {
  ok: boolean;
  errors: TextLinkError[];
}

/** Comprueba los enlaces del texto: bien formados y con dirección válida, cada error con su motivo, en orden de aparición. */
export function validateText(text: string): TextResult {
  const { errors } = parse(text);
  return { ok: errors.length === 0, errors };
}

/**
 * Los enlaces mal escritos de un texto, ya dichos: «dirección»: motivo..
 *
 * Es el catálogo de mensajes de los enlaces de un texto y vive en un solo sitio porque lo
 * necesitan tres: el cuerpo de un contenido (`content.ts`), el motivo de una propuesta o de una
 * objeción (`proposals.ts`) y, por ese, la op que lo comprueba fuera del navegador.
 * La frase termina en punto porque los motivos se muestran seguidos, uno detrás de otro.
 */
export function textLinkErrors(text: string): string[] {
  return validateText(text).errors.map((error) => `«${error.link}»: ${error.reason}.`);
}

function inlineToPlain(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text;
      if (node.type === 'break') return '\n';
      return inlineToPlain(node.children);
    })
    .join('');
}

/** El texto sin marcas: párrafos separados por línea en blanco, elementos de lista por salto de línea. */
export function plainText(tree: BlockNode[]): string {
  return tree
    .map((block) => (block.type === 'paragraph' ? inlineToPlain(block.children) : block.items.map(inlineToPlain).join('\n')))
    .join('\n\n');
}

/** Los primeros `limit` puntos de código del texto sin formato, con los espacios y saltos reducidos a uno. */
export function excerpt(text: string, limit: number): string {
  const plain = plainText(parseText(text)).replace(/\s+/g, ' ').trim();
  if (countCodePoints(plain) <= limit) return plain;
  return Array.from(plain).slice(0, limit).join('');
}
