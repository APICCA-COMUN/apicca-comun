import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('RF-21 (001), RF-19 (019) · 19.2: sin ápices, una persona inscrita ve el terreno de partida con «Propón el primer ápice»', () => {
    render(<EmptyState kind="no-apices" canCreate onClearFilters={() => {}} />);
    expect(screen.getByRole('region', { name: 'Terreno de partida' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Propón el primer ápice' }).getAttribute('href')).toBe('/apices/nuevo');
  });

  it('RF-21 (001), RF-19 (019) · 19.2, 19.3: sin ápices, un visitante ve «Pide tu inscripción» y ya no «Todavía no hay ápices para mostrar.»', () => {
    render(<EmptyState kind="no-apices" canCreate={false} onClearFilters={() => {}} />);
    expect(screen.queryByText(/Todavía no hay ápices/)).toBeNull();
    expect(screen.getByText('Aún no hay ápices en el terreno.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pide tu inscripción' }).getAttribute('href')).toBe('/solicitar');
    expect(screen.queryByRole('link', { name: 'Crear el primero' })).toBeNull();
  });

  it('RF-21 (001): sin resultados ofrece quitar los filtros', async () => {
    const onClear = vi.fn();
    render(<EmptyState kind="no-results" canCreate onClearFilters={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('RF-4 (003) · 4.9: el estado vacío sin resultados es un bloque con «block block-empty»; sin ápices, el terreno de partida', () => {
    const { container, rerender } = render(<EmptyState kind="no-results" canCreate onClearFilters={() => {}} />);
    expectBlocks(container);
    expect(container.firstElementChild?.classList.contains('block')).toBe(true);
    expect(container.firstElementChild?.classList.contains('block-empty')).toBe(true);
    expect(screen.getByRole('button', { name: 'Quitar filtros' }).className).toBe('block action-secondary');

    rerender(<EmptyState kind="no-apices" canCreate onClearFilters={() => {}} />);
    expectBlocks(container);
    expect(screen.getByRole('link', { name: 'Propón el primer ápice' }).className).toBe('block action-primary'); // RF-19 (019)
  });

  it('RF-3 (003) · 3.3: no contiene bloques anidados', () => {
    const { container } = render(<EmptyState kind="no-results" canCreate onClearFilters={() => {}} />);
    expectBlocks(container, { nesting: true });
  });
});
