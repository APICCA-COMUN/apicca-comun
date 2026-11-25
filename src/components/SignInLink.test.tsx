// RF-9 (024) · 9.2, D-T12 (024): «Entrar» guarda la página de origen al hacer clic, y solo entonces, para volver a ella tras entrar.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { takeReturnTo } from '../app/returnTo';
import { SignInLink } from './SignInLink';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
});

describe('SignInLink', () => {
  it('RF-9 (024) · 9.2: es un enlace «Entrar» a /entrar, sin clase de acción', () => {
    render(<SignInLink />);
    const link = screen.getByRole('link', { name: 'Entrar' });
    expect(link.getAttribute('href')).toBe('/entrar');
    expect(link.className).not.toMatch(/action-|\bblock\b/);
  });

  it('RF-9 (024) · 9.2: no guarda nada antes del clic', () => {
    window.history.replaceState(null, '', '/apices/a1/editar');
    render(<SignInLink />);
    expect(takeReturnTo()).toBeNull();
  });

  it('RF-9 (024) · 9.2: al hacer clic guarda la ruta de la página y lleva a /entrar', async () => {
    window.history.replaceState(null, '', '/apices/a1/editar');
    render(<SignInLink />);
    await userEvent.click(screen.getByRole('link', { name: 'Entrar' }));
    expect(window.location.pathname).toBe('/entrar');
    expect(takeReturnTo()).toBe('/apices/a1/editar');
  });

  it('RF-9 (024) · 9.2: una ruta de origen que no es interna se descarta', async () => {
    render(<SignInLink from="//otro.sitio/x" />);
    await userEvent.click(screen.getByRole('link', { name: 'Entrar' }));
    expect(takeReturnTo()).toBeNull();
  });
});
