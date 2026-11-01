// RF-5 (001) · Pruebas del aviso de acceso suspendido (RF-6 (002) · 6.1, 6.3, 6.5).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionSource } from '../app/session';
import { expectBlocks } from '../testing/expectBlocks';
import { SuspendedNotice } from './SuspendedNotice';

function setup(status: 'suspended' | 'person' | 'visitor') {
  const signOut = vi.fn().mockResolvedValue(undefined);
  const source: SessionSource = {
    onAuth: (cb) => {
      cb(status === 'visitor' ? null : 'u1');
      return () => undefined;
    },
    onAccount: (u, cb) => {
      cb({
        email: `${u}@ejemplo.org`,
        name: u,
        username: u,
        role: 'member',
        status: status === 'suspended' ? 'suspended' : 'active',
      });
      return () => undefined;
    },
    signOut,
  };
  const result = render(
    <SessionProvider source={source}>
      <SuspendedNotice />
    </SessionProvider>,
  );
  return { ...result, signOut };
}

describe('SuspendedNotice', () => {
  it('RF-5 (001): se muestra solo a quien tiene sesión con cuenta suspendida y conserva su texto explicativo', () => {
    const { unmount } = setup('suspended');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/cuenta está suspendida/);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeDefined();

    unmount();
    setup('person');
    expect(screen.queryByRole('alert')).toBeNull();

    setup('visitor');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RF-5 (001): el botón cierra la sesión', async () => {
    const { signOut } = setup('suspended');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('RF-6 (002) · 6.1, 6.3: el aviso es un bloque role="alert" y su botón es acción secundaria', () => {
    const { container } = setup('suspended');
    const alert = screen.getByRole('alert');
    expect(alert.classList.contains('block')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' }).className).toBe('block action-secondary');
    expectBlocks(container);
  });
});
