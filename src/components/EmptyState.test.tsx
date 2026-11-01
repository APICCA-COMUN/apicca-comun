import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('RF-21 (001): sin ápices, una persona inscrita ve «Crear el primero»', () => {
    render(<EmptyState kind="no-apices" canCreate onClearFilters={() => {}} />);
    expect(screen.getByRole('link', { name: 'Crear el primero' }).getAttribute('href')).toBe('/apices/nuevo');
  });

  it('RF-21 (001): sin ápices, un visitante lo lee pero no ve la oferta de crear', () => {
    render(<EmptyState kind="no-apices" canCreate={false} onClearFilters={() => {}} />);
    expect(screen.getByText(/Todavía no hay ápices/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Crear el primero' })).toBeNull();
  });

  it('RF-21 (001): sin resultados ofrece quitar los filtros', async () => {
    const onClear = vi.fn();
    render(<EmptyState kind="no-results" canCreate onClearFilters={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('RF-4 (003) · 4.9: el estado vacío es un bloque con «block block-empty» y «Crear el primero» es secundario', () => {
    const { container, rerender } = render(<EmptyState kind="no-results" canCreate onClearFilters={() => {}} />);
    expectBlocks(container);
    expect(container.firstElementChild?.classList.contains('block')).toBe(true);
    expect(container.firstElementChild?.classList.contains('block-empty')).toBe(true);
    expect(screen.getByRole('button', { name: 'Quitar filtros' }).className).toBe('block action-secondary');

    rerender(<EmptyState kind="no-apices" canCreate onClearFilters={() => {}} />);
    expectBlocks(container);
    expect(container.firstElementChild?.classList.contains('block')).toBe(true);
    expect(container.firstElementChild?.classList.contains('block-empty')).toBe(true);
    expect(screen.getByRole('link', { name: 'Crear el primero' }).className).toBe('block action-secondary');
  });

  it('RF-3 (003) · 3.3: no contiene bloques anidados', () => {
    const { container } = render(<EmptyState kind="no-results" canCreate onClearFilters={() => {}} />);
    expectBlocks(container, { nesting: true });
  });
});
