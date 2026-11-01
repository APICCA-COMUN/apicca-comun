import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { DocBlocks, Inlines } from './DocBlocks';

afterEach(() => window.history.replaceState(null, '', '/'));

const SAMPLE = [
  '## Título dos',
  '',
  '### Título tres',
  '',
  'Párrafo con *énfasis*, **negrita** y `código`.',
  '',
  '- uno',
  '- dos',
  '',
  '1. primero',
  '2. segundo',
  '',
  '> una cita',
  '',
  '```js',
  'const a = 1;',
  '```',
].join('\n');

describe('DocBlocks (003)', () => {
  it('RF-14 (003) · 14.1: pinta cada bloque y cada marca en línea como elemento de React', () => {
    const { container } = render(<DocBlocks blocks={parseMarkdown(SAMPLE)} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Título dos' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Título tres' })).toBeTruthy();
    expect(container.querySelector('p em')?.textContent).toBe('énfasis');
    expect(container.querySelector('p strong')?.textContent).toBe('negrita');
    expect(container.querySelector('p code')?.textContent).toBe('código');
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(container.querySelector('blockquote')?.textContent).toBe('una cita');
    expect(container.querySelector('pre code')?.textContent).toBe('const a = 1;');
  });

  it('RNF-3 (003): un fragmento con <script> en el texto aparece como texto y no se interpreta', () => {
    const blocks = parseMarkdown('Hola `<script>alert(1)</script>` y \\<b\\>negrita\\</b\\>.');
    const { container } = render(<DocBlocks blocks={blocks} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<b>negrita</b>');
  });

  it('RF-14 (003) · 14.1: los enlaces internos usan Link y navegan sin recargar', async () => {
    const { container } = render(<DocBlocks blocks={parseMarkdown('Ver [la guía](/documentacion/ejes).')} />);
    const link = screen.getByRole('link', { name: 'la guía' });
    expect(link.getAttribute('href')).toBe('/documentacion/ejes');
    expect(link.getAttribute('target')).toBeNull();
    await userEvent.setup().click(link);
    expect(window.location.pathname).toBe('/documentacion/ejes');
    expect(container.querySelector('a')).toBe(link);
  });

  it('RF-14 (003) · 14.1: los enlaces externos http(s) abren aparte con rel seguro', () => {
    render(<DocBlocks blocks={parseMarkdown('Ver [sitio](https://ejemplo.org/x).')} />);
    const link = screen.getByRole('link', { name: 'sitio' });
    expect(link.getAttribute('href')).toBe('https://ejemplo.org/x');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('RNF-3 (003): un enlace con esquema no admitido se pinta como texto, sin href', () => {
    const { container } = render(<DocBlocks blocks={parseMarkdown('Ver [malo](javascript:alert(1)).')} />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('malo');
  });

  it('RF-9 (016) · 9.1: pinta solo como texto los enlaces con «/\\» o «//»', () => {
    for (const href of ['/\\evil.example', '//evil.example']) {
      const { container, unmount } = render(<DocBlocks blocks={parseMarkdown(`Ver [engaño](${href}).`)} />);
      expect(container.querySelector('a')).toBeNull();
      expect(container.textContent).toBe('Ver engaño.');
      unmount();
    }
  });

  it('RF-9 (016) · 9.1: conserva «/foro» como enlace interno', async () => {
    const { container } = render(<DocBlocks blocks={parseMarkdown('Ir al [foro](/foro).')} />);
    const link = screen.getByRole('link', { name: 'foro' });
    expect(link.getAttribute('href')).toBe('/foro');
    expect(link.getAttribute('target')).toBeNull();
    await userEvent.setup().click(link);
    expect(window.location.pathname).toBe('/foro');
    expect(container.querySelector('a')).toBe(link);
  });

  it('RF-14 (003) · 14.1: Inlines pinta texto en línea para otras páginas', () => {
    const [block] = parseMarkdown('Un **dato** claro.');
    const children = block?.type === 'paragraph' ? block.children : [];
    const { container } = render(<p><Inlines inlines={children} /></p>);
    expect(container.querySelector('strong')?.textContent).toBe('dato');
    expect(container.textContent).toBe('Un dato claro.');
  });

  it('RNF-3 (003): ningún archivo de src usa dangerouslySetInnerHTML', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.endsWith('DocBlocks.test.tsx')) {
          if (readFileSync(path, 'utf8').includes('dangerouslySetInnerHTML')) hits.push(path);
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(hits).toEqual([]);
  });
});
