// T-43 y T-44 (021) · RF-21 (021), RF-22 (021), D-T37 (021), D-T38 (021): la invitación a jugar y el primer recorrido.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { tourSteps } from '../../shared/domain/tour';
import { WelcomeCard } from './WelcomeCard';

const show = (steps = tourSteps({ apices: 3, paths: 1, signedIn: true })) => {
  const onSeen = vi.fn();
  const onClose = vi.fn();
  render(<WelcomeCard steps={steps} onSeen={onSeen} onClose={onClose} />);
  return { onSeen, onClose };
};
const card = () => screen.getByRole('region', { name: 'Bienvenida' });

describe('WelcomeCard', () => {
  it('RF-21 (021) · 21.1, 21.2: dice qué es APICCA y ofrece «Jugar»; no es un diálogo modal', () => {
    show();
    expect(card().textContent).toMatch(/APICCA/);
    expect(screen.getByRole('button', { name: 'Jugar' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(card().closest('[aria-modal="true"]')).toBeNull();
  });

  it('RF-21 (021) · 21.3: «Cerrar» la marca como vista y la quita', () => {
    const { onSeen, onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onSeen).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('RF-22 (021) · 22.1: «Jugar» la marca como vista y empieza el recorrido de tres pasos, con «Siguiente» y «Listo»', () => {
    const { onSeen, onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Jugar' }));
    expect(onSeen).toHaveBeenCalledOnce();
    expect(card().textContent).toContain('Paso 1 de 3');
    expect(screen.getByRole('heading', { name: 'Mira un ápice' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Mira un camino' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(card().textContent).toContain('Paso 3 de 3');
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('RF-22 (021) · 22.2: se puede saltar en cualquier paso', () => {
    const { onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Jugar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('RF-22 (021) · 22.3: con menos pasos, la cuenta se ajusta; el paso se anuncia sin mover el foco', () => {
    show(tourSteps({ apices: 0, paths: 0, signedIn: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Jugar' }));
    expect(card().textContent).toContain('Paso 1 de 1');
    expect(card().querySelector('[aria-live="polite"]')?.textContent).toContain('Construye');
    expect(screen.getByRole('button', { name: 'Listo' })).toBeTruthy();
  });
});
