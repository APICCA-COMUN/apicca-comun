import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { SessionProvider } from './app/session';

afterEach(() => window.history.replaceState(null, '', '/'));

function renderAt(path: string) {
  window.history.replaceState(null, '', path);
  render(
    <SessionProvider initial={{ status: 'visitor' }}>
      <App />
    </SessionProvider>,
  );
}

describe('rutas de registro y solicitud', () => {
  it('RF-2 (001): /registro/:token muestra el formulario de acceso, no el aviso de obra', () => {
    renderAt('/registro/un-token');
    expect(screen.getByRole('heading', { level: 1, name: 'Crear acceso' })).toBeTruthy();
    expect(screen.queryByText('Sitio en construcción.')).toBeNull();
  });

  it('RF-2 (001): /registro sin enlace explica que se entra por invitación', () => {
    renderAt('/registro');
    expect(screen.getByRole('heading', { level: 1, name: 'Registro' })).toBeTruthy();
    expect(screen.queryByText('Sitio en construcción.')).toBeNull();
  });

  it('RF-4 (001): /solicitar muestra el formulario de solicitud, no el aviso de obra', () => {
    renderAt('/solicitar');
    expect(screen.getByRole('heading', { level: 1, name: 'Solicitar inscripción' })).toBeTruthy();
    expect(screen.queryByText('Sitio en construcción.')).toBeNull();
  });
});
