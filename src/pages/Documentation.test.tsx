import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocsIndex } from '../../shared/domain/docs/index';
import { LazyBoundary } from '../components/LazyBoundary';
import { expectBlocks } from '../testing/expectBlocks';
import { Documentation } from './Documentation';
import DocumentationDefault from './Documentation';

afterEach(() => window.history.replaceState(null, '', '/'));

const index: DocsIndex = {
  secciones: [
    {
      titulo: 'Primeros pasos',
      articulos: [
        { slug: 'uno', archivo: '01-uno.md' },
        { slug: 'dos', archivo: '02-dos.md' },
      ],
    },
    { titulo: 'Más cosas', articulos: [{ slug: 'tres', archivo: '03-tres.md' }] },
  ],
};
const files: Record<string, string> = {
  '01-uno.md': '# Artículo uno\n\nTexto del uno.',
  '02-dos.md': '# Artículo dos\n\nTexto del dos.',
  '03-tres.md': '# Artículo tres\n\nTexto del tres.',
};
const loadArticles = () => Promise.resolve(files);

function mount(slug?: string, load = loadArticles) {
  return render(
    <LazyBoundary>
      <Documentation slug={slug} index={index} loadArticles={load} />
    </LazyBoundary>,
  );
}

describe('Documentation (003)', () => {
  it('RF-14 (003) · 14.1: se exporta con nombre y como default', () => {
    expect(DocumentationDefault).toBe(Documentation);
  });

  it('RF-14 (003) · 14.1: el índice de texto trae todas las secciones y artículos, antes del artículo en el DOM', async () => {
    mount('dos');
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Artículo dos' });
    const nav = screen.getByRole('navigation', { name: /índice/i });
    for (const text of ['Primeros pasos', 'Más cosas']) expect(within(nav).getByText(text)).toBeTruthy();
    for (const slug of ['uno', 'dos', 'tres']) {
      expect(within(nav).getByRole('link', { name: `Artículo ${slug}` })).toBeTruthy();
    }
    expect(nav.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-14 (003) · 14.1: sobre el h1 va «Documentación › <sección>», sin sumar un nav', async () => {
    const { container } = mount('tres');
    const h1 = await screen.findByRole('heading', { level: 1 });
    const crumb = screen.getByText('Documentación › Más cosas');
    expect(crumb.tagName).toMatch(/^(SPAN|P)$/);
    expect(crumb.closest('nav')).toBeNull();
    expect(crumb.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('nav').length).toBeLessThanOrEqual(2);
  });

  it('RF-14 (003) · 14.4: aria-current="page" solo en el artículo vigente', async () => {
    mount('dos');
    await screen.findByRole('heading', { level: 1, name: 'Artículo dos' });
    const nav = screen.getByRole('navigation', { name: /índice/i });
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute('href')).toBe('/documentacion/dos');
  });

  it('RF-14 (003) · 14.5: anterior y siguiente; sin anterior en el primero ni siguiente en el último', async () => {
    const { unmount } = mount('dos');
    await screen.findByRole('heading', { level: 1, name: 'Artículo dos' });
    expect(screen.getByRole('link', { name: /Anterior/ }).getAttribute('href')).toBe('/documentacion/uno');
    expect(screen.getByRole('link', { name: /Siguiente/ }).getAttribute('href')).toBe('/documentacion/tres');
    unmount();
    const first = mount('uno');
    await screen.findByRole('heading', { level: 1, name: 'Artículo uno' });
    expect(screen.queryByRole('link', { name: /Anterior/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Siguiente/ })).toBeTruthy();
    first.unmount();
    mount('tres');
    await screen.findByRole('heading', { level: 1, name: 'Artículo tres' });
    expect(screen.queryByRole('link', { name: /Siguiente/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Anterior/ })).toBeTruthy();
  });

  it('RF-14 (003) · 14.6: sin slug abre el primer artículo', async () => {
    mount(undefined);
    expect(await screen.findByRole('heading', { level: 1, name: 'Artículo uno' })).toBeTruthy();
  });

  it('RF-14 (003) · 14.7: un artículo inexistente muestra NotFound', async () => {
    mount('no-existe');
    expect(await screen.findByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeTruthy();
  });

  it('RNF-4 (003) · D-T16 (003): una carga fallida muestra el aviso con «Reintentar» y reintentar la recupera', async () => {
    const load = vi
      .fn<() => Promise<Record<string, string>>>()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockImplementation(loadArticles);
    mount('uno', load);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Reintentar');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Artículo uno' })).toBeTruthy();
  });

  it('RF-10 (005) · 10.1: el artículo va directo sobre el fondo, sin lote', async () => {
    const { container } = mount('uno');
    const article = (await screen.findByRole('heading', { level: 1, name: 'Artículo uno' })).closest('article');
    expect(article).not.toBeNull();
    expect(article!.closest('.lot')).toBeNull();
    expect(container.querySelector('.lot')).toBeNull();
  });

  it('RF-3 (003) · 3.3: sin bloques anidados', async () => {
    const { container } = mount('uno');
    await screen.findByRole('heading', { level: 1, name: 'Artículo uno' });
    expectBlocks(container, { nesting: true });
  });

  it('RF-2 (017): el título del documento nombra el artículo y la documentación', async () => {
    mount('dos');
    await screen.findByRole('heading', { level: 1, name: 'Artículo dos' });
    expect(document.title).toBe('Artículo dos · Documentación · APICCA COMÚN');
  });

  it('RF-7 (017): un artículo inexistente lleva el título de la página no encontrada', async () => {
    mount('nada');
    await screen.findByRole('heading', { level: 1, name: 'No encontramos esta página' });
    expect(document.title).toBe('No encontramos esta página · APICCA COMÚN');
  });
});
