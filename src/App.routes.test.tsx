// RF-3 (004) · 3.1, 3.2; RF-5 (004) · 5.2; RF-7 (004) · 7.3, 7.4; D-T13 (004): las seis rutas de la constitución
// común montan su página en la `App` real (con dobles en memoria), sin caer en la ruta desconocida.
import './testing/appDoubles';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { SessionProvider, type SessionState } from './app/session';

const MEMBER: SessionState = { status: 'person', uid: 'ana', role: 'member', username: 'ana' };

afterEach(() => window.history.replaceState(null, '', '/'));

function renderAt(path: string) {
  window.history.replaceState(null, '', path);
  render(
    <SessionProvider initial={MEMBER}>
      <App />
    </SessionProvider>,
  );
}

const CASES: Array<[string, RegExp]> = [
  ['/constitucion', /Cuidado mutuo/],
  ['/constitucion/historial', /Historial de la constitución/],
  ['/constitucion/secciones/ejemplo', /Cuidado mutuo|No se encontró/],
  ['/constitucion/documentos/ejemplo', /No se encontró el documento/],
  ['/constitucion/propuestas', /Propuestas de cambio/],
  ['/constitucion/propuestas/ejemplo', /No se encontró la propuesta/],
];

describe('rutas de la constitución común', () => {
  it.each(CASES)('RF-7 (004) · 7.3: %s monta su página, no la de ruta desconocida', async (path, marker) => {
    renderAt(path);
    expect(await screen.findAllByText(marker)).not.toHaveLength(0);
    expect(screen.queryByText('Sitio en construcción.')).toBeNull();
  });
});
