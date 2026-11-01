import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { NotFound } from './NotFound';

describe('NotFound', () => {
  it('RF-14 (003) · 14.7: muestra el mismo texto de la ruta desconocida de la 002', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'APICCA COMÚN' })).toBeTruthy();
    expect(screen.getByText('Sitio en construcción.')).toBeTruthy();
  });

  it('RF-14 (003) · 14.7: cumple las reglas de bloques', () => {
    const { container } = render(<NotFound />);
    expectBlocks(container, { nesting: true });
  });
});
