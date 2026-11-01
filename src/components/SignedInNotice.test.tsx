// RF-2 (001) · Pruebas del aviso de sesión iniciada al registrarse (RF-6 (002) · 6.1, 6.3).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionSource } from '../app/session';
import { expectBlocks } from '../testing/expectBlocks';
import { SignedInNotice } from './SignedInNotice';

function setup() {
  const signOut = vi.fn().mockResolvedValue(undefined);
  const source: SessionSource = {
    onAuth: (cb) => {
      cb('u1');
      return () => undefined;
    },
    onAccount: (u, cb) => {
      cb({ email: `${u}@ejemplo.org`, name: u, username: u, role: 'member', status: 'active' });
      return () => undefined;
    },
    signOut,
  };
  const result = render(
    <SessionProvider source={source}>
      <SignedInNotice />
    </SessionProvider>,
  );
  return { ...result, signOut };
}

describe('SignedInNotice', () => {
  it('RF-2 (001): muestra el aviso con el texto explicativo para cerrar sesión', () => {
    setup();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/Ya tienes una sesión iniciada/);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeDefined();
  });

  it('RF-2 (001): el botón cierra la sesión', async () => {
    const { signOut } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('RF-6 (002) · 6.1, 6.3: el aviso es un bloque role="alert" y su botón es acción secundaria', () => {
    const { container } = setup();
    const alert = screen.getByRole('alert');
    expect(alert.classList.contains('block')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' }).className).toBe('block action-secondary');
    expectBlocks(container);
  });
});
