// Pruebas del formato de texto. Gramática cerrada: párrafos, listas, negrita, cursiva y enlaces;
// lo demás es literal.
import { describe, expect, it } from 'vitest';
import { excerpt, parseText, plainText, validateText } from './textFormat';

const text = (t: string) => ({ type: 'text', text: t });
const br = { type: 'break' };

describe('shared/domain/textFormat · bloques', () => {
  it('los párrafos se separan por línea en blanco', () => {
    expect(parseText('Primero.\n\nSegundo.')).toEqual([
      { type: 'paragraph', children: [text('Primero.')] },
      { type: 'paragraph', children: [text('Segundo.')] },
    ]);
  });

  it('un salto de línea simple dentro de un párrafo es un salto, no un párrafo nuevo', () => {
    expect(parseText('línea uno\nlínea dos')).toEqual([
      { type: 'paragraph', children: [text('línea uno'), br, text('línea dos')] },
    ]);
  });

  it('las líneas con "- " forman una lista con viñetas', () => {
    expect(parseText('- uno\n- dos')).toEqual([
      { type: 'list', ordered: false, items: [[text('uno')], [text('dos')]] },
    ]);
  });

  it('las líneas con "n. " forman una lista numerada', () => {
    expect(parseText('1. uno\n2. dos\n10. diez')).toEqual([
      { type: 'list', ordered: true, items: [[text('uno')], [text('dos')], [text('diez')]] },
    ]);
  });

  it('"* " al inicio no abre viñeta: es texto literal', () => {
    expect(parseText('* no es viñeta')).toEqual([{ type: 'paragraph', children: [text('* no es viñeta')] }]);
  });

  it('un guion sin espacio o un número sin punto no abren lista', () => {
    expect(parseText('-sin espacio\n1)paréntesis')).toEqual([
      { type: 'paragraph', children: [text('-sin espacio'), br, text('1)paréntesis')] },
    ]);
  });

  it('una lista pegada a un párrafo empieza un bloque nuevo', () => {
    expect(parseText('Lista:\n- a\n- b\nfin')).toEqual([
      { type: 'paragraph', children: [text('Lista:')] },
      { type: 'list', ordered: false, items: [[text('a')], [text('b')]] },
      { type: 'paragraph', children: [text('fin')] },
    ]);
  });

  it('varias líneas en blanco, espacios sueltos y CRLF no producen bloques vacíos', () => {
    expect(parseText('a\r\n\r\n  \r\n\r\nb\n')).toEqual([
      { type: 'paragraph', children: [text('a')] },
      { type: 'paragraph', children: [text('b')] },
    ]);
    expect(parseText('')).toEqual([]);
    expect(parseText('   \n\n  ')).toEqual([]);
  });
});

describe('shared/domain/textFormat · negrita y cursiva', () => {
  const p = (children: unknown[]) => [{ type: 'paragraph', children }];

  it('**a** es negrita', () => {
    expect(parseText('di **a** ya')).toEqual(p([text('di '), { type: 'bold', children: [text('a')] }, text(' ya')]));
  });

  it('*b* es cursiva', () => {
    expect(parseText('di *b* ya')).toEqual(p([text('di '), { type: 'italic', children: [text('b')] }, text(' ya')]));
  });

  it('un marcador sin pareja es texto literal', () => {
    expect(parseText('**sin cerrar')).toEqual(p([text('**sin cerrar')]));
    expect(parseText('*suelto')).toEqual(p([text('*suelto')]));
    expect(parseText('2 * 3 = 6')).toEqual(p([text('2 * 3 = 6')]));
    expect(parseText('****')).toEqual(p([text('****')]));
    expect(parseText('**')).toEqual(p([text('**')]));
  });

  it('el guion bajo es siempre literal', () => {
    expect(parseText('_usuario_ y __doble__')).toEqual(p([text('_usuario_ y __doble__')]));
  });

  it('la cursiva puede ir dentro de la negrita y el formato funciona en listas', () => {
    expect(parseText('**a *b* c**')).toEqual(
      p([{ type: 'bold', children: [text('a '), { type: 'italic', children: [text('b')] }, text(' c')] }]),
    );
    expect(parseText('- **uno**\n- *dos*')).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'bold', children: [text('uno')] }], [{ type: 'italic', children: [text('dos')] }]],
      },
    ]);
  });

  it('el formato no cruza un salto de línea', () => {
    expect(parseText('*a\nb*')).toEqual(p([text('*a'), br, text('b*')]));
  });
});

describe('shared/domain/textFormat · enlaces', () => {
  const p = (children: unknown[]) => [{ type: 'paragraph', children }];

  it('[texto](https://…) es un enlace y su texto admite formato', () => {
    expect(parseText('ver [el sitio](https://example.org) hoy')).toEqual(
      p([text('ver '), { type: 'link', url: 'https://example.org', children: [text('el sitio')] }, text(' hoy')]),
    );
    expect(parseText('[**a**](HTTPS://x/y?z=1)')).toEqual(
      p([{ type: 'link', url: 'HTTPS://x/y?z=1', children: [{ type: 'bold', children: [text('a')] }] }]),
    );
    expect(validateText('ver [el sitio](https://example.org) hoy')).toEqual({ ok: true, errors: [] });
  });

  it('la dirección termina en el primer ")" y no admite espacios', () => {
    expect(parseText('[a](https://x/(1)) b')).toEqual(
      p([{ type: 'link', url: 'https://x/(1', children: [text('a')] }, text(') b')]),
    );
    const spaced = validateText('[a](https://x y)');
    expect(spaced.ok).toBe(false);
    expect(spaced.errors[0]?.reason).toMatch(/espacio/);
    expect(parseText('[a](https://x y)')).toEqual(p([text('[a](https://x y)')]));
  });

  it('un enlace con http:// se rechaza con el motivo', () => {
    const result = validateText('mira [esto](http://inseguro)');
    expect(result).toEqual({ ok: false, errors: [{ link: 'http://inseguro', reason: expect.stringContaining('https://') }] });
    expect(validateText('[a](https://)')).toEqual({ ok: false, errors: [{ link: 'https://', reason: expect.stringMatching(/detrás/) }] });
  });

  it('todo "[…](" abre un enlace: si no se cierra, se rechaza', () => {
    const result = validateText('esto [a]( queda abierto');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toEqual({ link: '[a](', reason: expect.stringMatching(/cerrar|\)/) });
    expect(validateText('[a](https://x\n)').ok).toBe(false);
  });

  it('corchetes sin "](" son texto literal', () => {
    expect(parseText('[nota] y (paréntesis) y [a] (b)')).toEqual(p([text('[nota] y (paréntesis) y [a] (b)')]));
    expect(validateText('[nota] y (paréntesis)')).toEqual({ ok: true, errors: [] });
  });

  it('validateText junta todos los errores del texto', () => {
    const result = validateText('[a](http://x) y [b](');
    expect(result.errors.map((e) => e.link)).toEqual(['http://x', '[b](']);
  });
});

describe('shared/domain/textFormat · texto sin formato y marcado literal', () => {
  const p = (children: unknown[]) => [{ type: 'paragraph', children }];

  it('plainText quita las marcas y conserva las palabras', () => {
    const t = '**Hola** *mundo* [enlace](https://x)\nsigue\n\n- uno\n- **dos**\n\n1. tres';
    expect(plainText(parseText(t))).toBe('Hola mundo enlace\nsigue\n\nuno\ndos\n\ntres');
    expect(plainText([])).toBe('');
  });

  it('el extracto tiene 200 puntos de código sin marcas', () => {
    const body = '**' + '😀'.repeat(150) + '** y ' + 'a'.repeat(100);
    const result = excerpt(body, 200);
    expect(Array.from(result).length).toBe(200);
    expect(result).not.toContain('*');
    expect(result.startsWith('😀'.repeat(150) + ' y ')).toBe(true);
  });

  it('un texto corto se devuelve entero, con los saltos y espacios reducidos a uno', () => {
    expect(excerpt('**Hola**\n\n- a\n- b', 200)).toBe('Hola a b');
    expect(excerpt('', 200)).toBe('');
  });

  it('el marcado no admitido se muestra literal', () => {
    expect(parseText('# Título')).toEqual(p([text('# Título')]));
    expect(parseText('## Otro')).toEqual(p([text('## Otro')]));
    expect(parseText('| a | b |\n|---|---|')).toEqual(p([text('| a | b |'), br, text('|---|---|')]));
    expect(parseText('`código` y ```bloque```')).toEqual(p([text('`código` y ```bloque```')]));
    expect(parseText('<b>html</b> &amp; <script>')).toEqual(p([text('<b>html</b> &amp; <script>')]));
    expect(parseText('> cita')).toEqual(p([text('> cita')]));
    expect(parseText('---')).toEqual(p([text('---')]));
    expect(parseText('a  \nb')).toEqual(p([text('a  '), br, text('b')]));
  });

  it('una imagen ![…](…) no es imagen: "!" literal seguido de un enlace', () => {
    expect(parseText('![foto](https://x/f.png)')).toEqual(
      p([text('!'), { type: 'link', url: 'https://x/f.png', children: [text('foto')] }]),
    );
  });
});
