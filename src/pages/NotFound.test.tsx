import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { NotFound } from './NotFound';

describe('NotFound', () => {
  it('RF-14 (003) · 14.7, RF-7 (017): dice que no encontró la página, con título propio y un enlace a la portada (D-1 (017))', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeTruthy();
    expect(screen.getByText('Puede que el enlace esté mal escrito o que la página ya no exista.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
    expect(document.title).toBe('No encontramos esta página · APICCA COMÚN');
  });

  it('RF-14 (003) · 14.7: cumple las reglas de bloques', () => {
    const { container } = render(<NotFound />);
    expectBlocks(container, { nesting: true });
  });
});
