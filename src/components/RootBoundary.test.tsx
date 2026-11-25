// RNF-10 (001): el límite de error raíz muestra un aviso y un enlace al inicio en vez de una página en blanco.
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { RootBoundary } from './RootBoundary';

afterEach(() => vi.restoreAllMocks());

function Broken(): never {
  throw new Error('roto');
}

describe('RootBoundary', () => {
  it('RNF-10 (001): sin errores pinta a sus hijos', () => {
    render(
      <RootBoundary>
        <p>Todo bien</p>
      </RootBoundary>,
    );
    expect(screen.getByText('Todo bien')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RNF-10 (001): si un hijo lanza al pintar, muestra el aviso y un enlace al inicio, en bloques', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <RootBoundary>
        <Broken />
      </RootBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toMatch('Algo salió mal');
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
    expectBlocks(container);
  });
});
