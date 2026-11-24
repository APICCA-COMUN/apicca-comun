// T-43 y T-44 (021) · RF-21 (021), RF-22 (021), D-T37 (021), D-T38 (021): la invitación y el primer recorrido.
// T-13 (024) · RF-3 (024), D-T3 (024): la tarjeta avisa cada paso que muestra, para que el mapa se mueva a él.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { tourSteps } from '../../shared/domain/tour';
import { WelcomeCard } from './WelcomeCard';

const show = (steps = tourSteps({ apices: 3, paths: 1, signedIn: true })) => {
  const onSeen = vi.fn();
  const onClose = vi.fn();
  const onStep = vi.fn();
  render(<WelcomeCard steps={steps} onSeen={onSeen} onClose={onClose} onStep={onStep} />);
  return { onSeen, onClose, onStep };
};
const card = () => screen.getByRole('region', { name: 'Bienvenida' });

describe('WelcomeCard', () => {
  it('RF-21 (021) · 21.1, 21.2: dice qué es APICCA y ofrece «Ver el recorrido»; no es un diálogo modal', () => {
    show();
    expect(card().textContent).toMatch(/APICCA/);
    expect(screen.getByRole('button', { name: 'Ver el recorrido' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(card().closest('[aria-modal="true"]')).toBeNull();
  });

  it('RF-21 (021) · 21.3: «Cerrar» la marca como vista y la quita', () => {
    const { onSeen, onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onSeen).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('RF-22 (021) · 22.1: «Ver el recorrido» la marca como vista y empieza el recorrido de tres pasos, con «Siguiente» y «Listo»', () => {
    const { onSeen, onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Ver el recorrido' }));
    expect(onSeen).toHaveBeenCalledOnce();
    expect(card().textContent).toContain('Paso 1 de 3');
    expect(screen.getByRole('heading', { name: 'Mira un Ápice' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Mira una Acción Común' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(card().textContent).toContain('Paso 3 de 3');
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('RF-22 (021) · 22.2: se puede saltar en cualquier paso', () => {
    const { onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Ver el recorrido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('RF-22 (021) · 22.3: con menos pasos, la cuenta se ajusta; el paso se anuncia sin mover el foco', () => {
    show(tourSteps({ apices: 0, paths: 0, signedIn: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver el recorrido' }));
    expect(card().textContent).toContain('Paso 1 de 1');
    expect(card().querySelector('[aria-live="polite"]')?.textContent).toContain('Prototipa y conecta');
    expect(screen.getByRole('button', { name: 'Listo' })).toBeTruthy();
  });
});

describe('WelcomeCard · avisa cada paso', () => {
  it('RF-3 (024) · 3.1, 3.2: «Ver el recorrido» avisa el primer paso y «Siguiente» cada uno de los demás, en orden', () => {
    const steps = tourSteps({ apices: 3, paths: 1, signedIn: true });
    const { onStep } = show(steps);
    expect(onStep).not.toHaveBeenCalled(); // la invitación no mueve el mapa
    fireEvent.click(screen.getByRole('button', { name: 'Ver el recorrido' }));
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenLastCalledWith(steps[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onStep).toHaveBeenLastCalledWith(steps[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onStep.mock.calls.map(([step]) => step.key)).toEqual(['apice', 'camino', 'construir']);
  });

  it('RF-3 (024): «Saltar el recorrido», «Listo» y «Cerrar» no vuelven a avisar un paso', () => {
    const { onStep, onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Ver el recorrido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    const before = onStep.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onStep).toHaveBeenCalledTimes(before);
  });

  it('RF-3 (024): «Cerrar» en la invitación no avisa ningún paso', () => {
    const { onStep } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onStep).not.toHaveBeenCalled();
  });
});
