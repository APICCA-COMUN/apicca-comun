import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

// El inicio (`/`) consulta Firestore; estas pruebas miran la página de respaldo, que no consulta nada.
beforeEach(() => {
  window.history.replaceState(null, '', '/no-existe');
});

describe('App', () => {
  it('RF-7 (017): una ruta desconocida dice que no encontró la página, con enlace a la portada (D-1 (017))', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeTruthy();
  });

  it('RF-7 (017): una ruta desconocida lleva su propio título de documento', () => {
    render(<App />);
    expect(document.title).toBe('No encontramos esta página · APICCA COMÚN');
  });
});
