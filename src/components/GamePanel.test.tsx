// RF-14 (021) · 14.1, 14.8, 14.9, D-T23 (021): el panel de Inicio que reemplaza su contenido por defecto.
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

function setupDefaultSection(): string {
  const { container } = setup();
  return container.querySelector('.game-panel__bar .c-rot')!.textContent ?? '';
}

describe('GamePanel', () => {
  it('RF-14 (021) · 14.1: es una región complementaria con su nombre, su contenido y «Cerrar»', () => {
    const { container, onClose } = setup();
    const panel = screen.getByRole('complementary', { name: 'Ápice' });
    within(panel).getByRole('heading', { name: 'Huerta' });
    const close = within(panel).getByRole('button', { name: 'Cerrar' });
    expect(close.textContent).toBe('Cerrar');
    expect(close.querySelector('svg.icono--cerrar')).not.toBeNull();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expectBlocks(container);
  });

  it('«E3 · Celda»: la línea de sección dice el tipo (`section`) y la región conserva su nombre accesible (`label`)', () => {
    setup({ label: 'Editar ápice', section: 'Ápice' });
    const panel = screen.getByRole('complementary', { name: 'Editar ápice' });
    expect(panel.querySelector('.game-panel__bar .c-rot')!.textContent).toBe('Ápice');
    expect(setupDefaultSection()).toBe('Ápice');
  });

  it('«E3 · Celda»: abre con la línea de sección (rótulo a la izquierda, «Cerrar» a la derecha) y no es una caja', () => {
    const { container } = setup();
    const bar = container.querySelector('.game-panel__bar')!;
    expect(bar.classList.contains('c-seccion')).toBe(true);
    expect(bar.firstElementChild!.classList.contains('c-rot')).toBe(true);
    expect(bar.firstElementChild!.textContent).toBe('Ápice');
    expect(bar.lastElementChild).toBe(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('button', { name: 'Cerrar' }).classList.contains('block')).toBe(false);
    const panel = screen.getByRole('complementary', { name: 'Ápice' });
    expect(panel.classList.contains('block') || panel.classList.contains('lot')).toBe(false);
    expect(panel.querySelector('.icon-button')).toBeNull();
  });

  it('D-T23 (021): ya no se amplía: no hay «Ampliar» ni «Reducir»', () => {
    setup();
    expect(screen.queryByRole('button', { name: /ampliar|reducir/i })).toBeNull();
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
