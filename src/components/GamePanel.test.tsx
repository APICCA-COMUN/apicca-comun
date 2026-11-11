// RF-14 (021) · 14.1, 14.7, 14.8, 14.9, D-T23 (021): el panel que va sobre el mapa.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { GamePanel } from './GamePanel';

function setup(props: Partial<Parameters<typeof GamePanel>[0]> = {}) {
  const onClose = vi.fn();
  const result = render(
    <GamePanel label="Ápice" onClose={onClose} {...props}>
      <h1>Huerta</h1>
      <p>Contenido</p>
    </GamePanel>,
  );
  return { ...result, onClose };
}

describe('GamePanel', () => {
  it('RF-14 (021) · 14.1: es una región complementaria con su nombre, su contenido y «Cerrar»', () => {
    const { container, onClose } = setup();
    const panel = screen.getByRole('complementary', { name: 'Ápice' });
    within(panel).getByRole('heading', { name: 'Huerta' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expectBlocks(container);
  });

  it('RF-14 (021) · 14.7: «Ampliar» lleva el panel a toda la ventana y «Reducir» lo devuelve', () => {
    setup();
    const panel = screen.getByRole('complementary', { name: 'Ápice' });
    expect(panel.getAttribute('data-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar' }));
    expect(panel.getAttribute('data-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Reducir' }));
    expect(panel.getAttribute('data-expanded')).toBe('false');
  });

  it('RNF-1 (021), D-T23 (021): Escape cierra el panel; si otro control ya lo atendió, no', () => {
    const { onClose } = setup();
    const panel = screen.getByRole('complementary', { name: 'Ápice' });
    fireEvent.keyDown(within(panel).getByRole('heading', { name: 'Huerta' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    within(panel).getByRole('heading', { name: 'Huerta' }).dispatchEvent(handled);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('RF-14 (021) · 14.7, RNF-1 (021): avisa con onExpand cuando cubre todo el mapa y cuando deja de hacerlo', () => {
    const onExpand = vi.fn();
    const { unmount } = setup({ onExpand });
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar' }));
    expect(onExpand).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reducir' }));
    expect(onExpand).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar' }));
    unmount();
    expect(onExpand).toHaveBeenLastCalledWith(false);
  });

  it('RF-14 (021) · 14.8: con autoFocus, al abrirse lleva el foco a su título; sin él, no lo mueve', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const { unmount } = setup();
    expect(document.activeElement).toBe(outside);
    unmount();
    setup({ autoFocus: true });
    const heading = screen.getByRole('heading', { name: 'Huerta' });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    outside.remove();
  });

  it('RF-14 (021) · 14.9: con un aviso de cambios sin guardar, lo muestra arriba del contenido', () => {
    setup({ notice: <p role="alert">Tienes cambios sin guardar.</p> });
    const panel = screen.getByRole('complementary', { name: 'Ápice' });
    const alert = within(panel).getByRole('alert');
    expect(alert.compareDocumentPosition(within(panel).getByRole('heading')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
