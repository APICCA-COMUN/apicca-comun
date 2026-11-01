// Convertidor de Markdown propio (D-T15 (003)): bloques, en línea y errores con línea.
import { describe, expect, it } from 'vitest';
import { inlineText, MarkdownError, parseMarkdown, type Inline } from './markdown';

const t = (text: string) => ({ type: 'text', text });

function errorOf(text: string): MarkdownError {
  try {
    parseMarkdown(text);
  } catch (e) {
    return e as MarkdownError;
  }
  throw new Error('se esperaba un error');
}

describe('RF-14 (003) · parseMarkdown · bloques (D-T15 (003))', () => {
  it('RF-14 (003) · 14.1: encabezados #, ## y ### con su nivel', () => {
    expect(parseMarkdown('# Título\n\n## Sección\n\n### Parte')).toEqual([
      { type: 'heading', level: 1, children: [t('Título')] },
      { type: 'heading', level: 2, children: [t('Sección')] },
      { type: 'heading', level: 3, children: [t('Parte')] },
    ]);
  });

  it('RF-14 (003) · 14.1: un encabezado de nivel 4 o más es error con su línea', () => {
    const e = errorOf('# A\n\n#### D');
    expect(e).toBeInstanceOf(MarkdownError);
    expect(e.line).toBe(3);
  });

  it('RF-14 (003) · 14.1: párrafos separados por línea vacía; las líneas seguidas se unen con un espacio', () => {
    expect(parseMarkdown('uno\ndos\n\n\n\ntres')).toEqual([
      { type: 'paragraph', children: [t('uno dos')] },
      { type: 'paragraph', children: [t('tres')] },
    ]);
  });

  it('RF-14 (003) · 14.1: texto vacío o solo líneas vacías no produce bloques', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n  \n\n')).toEqual([]);
  });

  it('RF-14 (003) · 14.1: lista con viñeta (- y *)', () => {
    const item = (x: string) => ({ number: null, children: [t(x)] });
    expect(parseMarkdown('- a\n- b')).toEqual([{ type: 'list', ordered: false, items: [item('a'), item('b')] }]);
    expect(parseMarkdown('* c')).toEqual([{ type: 'list', ordered: false, items: [item('c')] }]);
  });

  it('RF-14 (003) · 14.1: una lista numerada tras una de viñeta es otra lista', () => {
    expect(parseMarkdown('- a\n1. b').map((b) => (b as { ordered: boolean }).ordered)).toEqual([false, true]);
  });

  it('RF-14 (003) · 14.1: lista numerada conserva el número escrito de cada elemento', () => {
    expect(parseMarkdown('1. a\n2. b\n3. c')).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [
          { number: 1, children: [t('a')] },
          { number: 2, children: [t('b')] },
          { number: 3, children: [t('c')] },
        ],
      },
    ]);
  });

  it('RF-14 (003) · 14.1: una línea con sangría continúa el elemento anterior', () => {
    expect(parseMarkdown('- uno\n  sigue\n- dos')).toEqual([
      { type: 'list', ordered: false, items: [{ number: null, children: [t('uno sigue')] }, { number: null, children: [t('dos')] }] },
    ]);
  });

  it('RF-14 (003) · 14.1: una línea vacía entre elementos de la misma lista no la parte', () => {
    const [list] = parseMarkdown('- a\n\n- b');
    expect(list).toMatchObject({ type: 'list' });
    expect((list as { items: unknown[] }).items).toHaveLength(2);
  });

  it('RF-14 (003) · 14.1: la lista anidada se rechaza con su línea', () => {
    const e = errorOf('- a\n  - b');
    expect(e.line).toBe(2);
    expect(errorOf('1. a\n   1. b').line).toBe(2);
  });

  it('RF-14 (003) · 14.1: un párrafo tras la lista, separado por línea vacía, es otro bloque', () => {
    const blocks = parseMarkdown('1. a\n\nNota');
    expect(blocks.map((b) => b.type)).toEqual(['list', 'paragraph']);
  });

  it('RF-14 (003) · 14.1: cita con > (varias líneas son una cita)', () => {
    expect(parseMarkdown('> uno\n> dos')).toEqual([{ type: 'quote', children: [t('uno dos')] }]);
  });

  it('RF-14 (003) · 14.1: bloque de código cercado, literal, con lenguaje opcional', () => {
    expect(parseMarkdown('```ts\nconst a = 1;\n\n**no**\n```')).toEqual([
      { type: 'code', lang: 'ts', text: 'const a = 1;\n\n**no**' },
    ]);
    expect(parseMarkdown('```\nx\n```')).toEqual([{ type: 'code', lang: null, text: 'x' }]);
  });

  it('RF-14 (003) · 14.1: un bloque de código sin cerrar es error en la línea de apertura', () => {
    expect(errorOf('hola\n\n```\nx').line).toBe(3);
  });
});

describe('RF-14 (003) · parseMarkdown · en línea y errores (D-T15 (003))', () => {
  const para = (text: string) => (parseMarkdown(text)[0] as { children: Inline[] }).children;

  it('RF-14 (003) · 14.1: énfasis, negrita y código en línea', () => {
    expect(para('a *b* **c** `d` e')).toEqual([
      t('a '),
      { type: 'emphasis', children: [t('b')] },
      t(' '),
      { type: 'strong', children: [t('c')] },
      t(' '),
      { type: 'code', text: 'd' },
      t(' e'),
    ]);
  });

  it('RF-14 (003) · 14.1: énfasis dentro de negrita y viceversa', () => {
    expect(para('**a *b***')).toEqual([{ type: 'strong', children: [t('a '), { type: 'emphasis', children: [t('b')] }] }]);
  });

  it('RF-14 (003) · 14.1: el código en línea no interpreta énfasis ni enlaces', () => {
    expect(para('`*a* [b](c)`')).toEqual([{ type: 'code', text: '*a* [b](c)' }]);
  });

  it('RF-14 (003) · 14.1: enlaces [texto](destino), con el texto en línea', () => {
    expect(para('ver [la **guía**](/documentacion/apice) y [web](https://a.org/x)')).toEqual([
      t('ver '),
      { type: 'link', href: '/documentacion/apice', children: [t('la '), { type: 'strong', children: [t('guía')] }] },
      t(' y '),
      { type: 'link', href: 'https://a.org/x', children: [t('web')] },
    ]);
  });

  it('RF-14 (003) · 14.1: la barra invertida escapa un carácter especial', () => {
    expect(para('a \\*b\\* c')).toEqual([t('a *b* c')]);
  });

  it('RF-14 (003) · 14.1: el asterisco suelto rodeado de espacios es texto', () => {
    expect(para('2 * 3 * 4')).toEqual([t('2 * 3 * 4')]);
  });

  it('RF-14 (003) · 14.1: énfasis, negrita, código o enlace sin cerrar son error con su línea', () => {
    expect(errorOf('ok\n\nuna *palabra sin cerrar').line).toBe(3);
    expect(errorOf('una **negrita').line).toBe(1);
    expect(errorOf('un `código').line).toBe(1);
    expect(errorOf('un [enlace](sin cerrar').line).toBe(1);
    expect(errorOf('un [enlace sin destino] aquí').line).toBe(1);
  });

  it('RF-14 (003) · 14.1: el error de en línea cuenta la línea dentro del párrafo', () => {
    expect(errorOf('uno\ndos\ntres *cuatro').line).toBe(3);
  });

  it('RF-14 (003) · 14.1: HTML crudo es error con su línea', () => {
    expect(errorOf('hola\n\n<div>x</div>').line).toBe(3);
    expect(errorOf('texto <b>negrita</b>').line).toBe(1);
    expect(errorOf('<!-- nota -->').line).toBe(1);
  });

  it('RF-14 (003) · 14.1: un < que no abre una etiqueta es texto', () => {
    expect(para('3 < 5 y 7 > 2')).toEqual([t('3 < 5 y 7 > 2')]);
  });

  it('RF-14 (003) · 14.1: imágenes son error con su línea', () => {
    expect(errorOf('a\n\n![alt](x.png)').line).toBe(3);
  });

  it('RF-14 (003) · 14.1: tablas son error con su línea', () => {
    expect(errorOf('x\n\n| a | b |\n|---|---|\n| 1 | 2 |').line).toBe(3);
  });

  it('RF-14 (003) · 14.1: la regla horizontal es error con su línea', () => {
    expect(errorOf('a\n\n---').line).toBe(3);
  });

  it('RF-14 (003) · 14.1: el mensaje del error nombra la línea', () => {
    expect(errorOf('<div>').message).toContain('línea 1');
  });

  it('RF-14 (003) · 14.1: el texto con <script> dentro de código es solo texto', () => {
    expect(parseMarkdown('```\n<script>x</script>\n```')).toEqual([{ type: 'code', lang: null, text: '<script>x</script>' }]);
  });

  it('RF-14 (003) · 14.1: inlineText devuelve el texto plano de una secuencia en línea', () => {
    expect(inlineText(para('a **b *c*** `d` [e](/f)'))).toBe('a b c d e');
  });
});
