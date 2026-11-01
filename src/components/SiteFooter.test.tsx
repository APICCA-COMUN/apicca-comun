// RF-8 (003) · 8.1, RF-1 (015), RF-2 (015), RF-4 (015), D-T3 (015): el pie es un `contentinfo` que muestra solo
// «Apoyado por» y el logo de MangleRojo enlazado a su sitio.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('RF-8 (003) · 8.1: es un único contentinfo', () => {
    render(<SiteFooter />);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });

  it('RF-1 (015) · 1.1–1.3: muestra «Apoyado por» y el logo negativo sin lema, con el texto alternativo «MangleRojo ORG»', () => {
    render(<SiteFooter />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Apoyado por')).toBeTruthy();
    const logo = within(footer).getByRole('img', { name: 'MangleRojo ORG' });
    expect(logo.getAttribute('src')).toBe('/brand/manglerojo-sin-lema-negativo.svg');
  });

  it('RF-2 (015): el logo enlaza a https://manglerojo.org en una pestaña nueva, con noopener y noreferrer', () => {
    render(<SiteFooter />);
    const link = within(screen.getByRole('contentinfo')).getByRole('link', { name: 'MangleRojo ORG' });
    expect(link.getAttribute('href')).toBe('https://manglerojo.org');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('RF-4 (015): el pie ya no muestra cuadros de eje, nombre, menú ni frase de cierre', () => {
    render(<SiteFooter />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.querySelectorAll('.site-footer__axis')).toHaveLength(0);
    expect(within(footer).queryByText('APICCA COMÚN')).toBeNull();
    expect(within(footer).queryByRole('navigation')).toBeNull();
    expect(within(footer).queryByText('Lo común se cuida entre todas las personas.')).toBeNull();
    expect(within(footer).getAllByRole('link')).toHaveLength(1);
  });
});
