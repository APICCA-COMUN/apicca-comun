// T-1.37: /registro sin enlace (RF-2 (001)).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionProvider } from '../app/session';
import { RegisterInfoPage } from './RegisterInfoPage';

describe('RegisterInfoPage', () => {
  it('RF-2 (001): sin enlace explica que se entra por invitación y enlaza a la solicitud', () => {
    render(<RegisterInfoPage />);
    expect(screen.getByText(/por invitación/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /solicit/i }).getAttribute('href')).toBe('/solicitar');
  });

  it('RF-2 (001): con sesión iniciada pide cerrarla antes de continuar', () => {
    const session = { status: 'person' as const, uid: 'u', role: 'member' as const, username: 'beto' };
    render(
      <SessionProvider initial={session}>
        <RegisterInfoPage />
      </SessionProvider>,
    );
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });
});

describe('RegisterInfoPage · bloques (002)', () => {
  it('RF-6 (002) · 6.3: el enlace a la solicitud es un enlace normal, sin clase de acción', () => {
    render(<RegisterInfoPage />);
    expect(screen.getByRole('link', { name: /solicit/i }).className).toBe('');
  });
});

describe('RegisterInfoPage · lote (003)', () => {
  it('RF-13 (003) · 13.1: el contenido va en un solo lote angosto', () => {
    const { container } = render(<RegisterInfoPage />);
    const lots = container.querySelectorAll('.lot');
    expect(lots).toHaveLength(1);
    expect(lots[0]!.classList.contains('lot--access')).toBe(true);
  });

  it('RF-13 (003) · 13.2: «solicita tu inscripción» es un enlace de texto dentro del lote', () => {
    const { container } = render(<RegisterInfoPage />);
    const link = screen.getByRole('link', { name: 'solicita tu inscripción' });
    expect(link.tagName).toBe('A');
    expect(link.matches('.block, .action-primary, .action-secondary, .action-destructive, .icon-button')).toBe(false);
    expect(container.querySelector('.lot')!.contains(link)).toBe(true);
  });
});
