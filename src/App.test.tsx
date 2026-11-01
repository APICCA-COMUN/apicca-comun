import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

// El inicio (`/`) consulta Firestore; estas pruebas miran la página de respaldo, que no consulta nada.
beforeEach(() => {
  window.history.replaceState(null, '', '/no-existe');
});

describe('App', () => {
  it('muestra el título del sitio y el aviso de obra', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'APICCA COMÚN' })).toBeTruthy();
    expect(screen.getByText('Sitio en construcción.')).toBeTruthy();
  });

  it('pone el nombre del sitio como título del documento', () => {
    render(<App />);
    expect(document.title).toBe('APICCA COMÚN');
  });
});
