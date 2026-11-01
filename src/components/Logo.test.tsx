import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOGO } from '../../shared/domain/identity';
import { Logo } from './Logo';

describe('Logo', () => {
  it('RF-17 (003) · 17.1: es un enlace al inicio con el nombre accesible «APICCA COMÚN, ir al inicio»', () => {
    render(<Logo />);
    const link = screen.getByRole('link', { name: 'APICCA COMÚN, ir al inicio' });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('RF-1 (002) · 1.2: el SVG se oculta a la tecnología de apoyo y no recibe foco', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('viewBox')).toBe(LOGO.viewBox);
    expect(svg.getAttribute('height')).toBe('32');
  });

  it('RF-1 (002) · 1.4: hay una capa por capa de LOGO y cada una usa su token', () => {
    const { container } = render(<Logo />);
    const paths = [...container.querySelectorAll('svg path')];
    expect(paths).toHaveLength(LOGO.layers.length);
    paths.forEach((path, i) => {
      expect(path.getAttribute('d')).toBe(LOGO.layers[i]!.d);
      expect(path.getAttribute('fill-rule')).toBe('evenodd');
      expect(path.classList.contains(`logo__layer--${LOGO.layers[i]!.token}`)).toBe(true);
      expect(path.classList.contains('logo__layer')).toBe(true);
    });
  });

  it('RF-1 (002) · 1.3: no contiene ningún encabezado', () => {
    const { container } = render(<Logo />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(container.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull();
  });

  it('RF-2 (003) · 2.1: el logo se muestra sin placa ni recuadro', () => {
    const { container } = render(<Logo />);
    expect(container.querySelector('.logo__plate')).toBeNull();
    expect(container.querySelector('a.logo > svg')).not.toBeNull();
  });
});
