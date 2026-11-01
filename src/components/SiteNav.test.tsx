// Pruebas de SiteNav (RF-7 (003) · 7.2, 7.3, 7.4; D-T10 (003)): menú principal con la sección vigente marcada.
// No navegan: fijan la ubicación con `replaceState`; las rutas las registra el enrutador.
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MAIN_MENU } from '../../shared/domain/navigation';
import { SessionProvider, type SessionState } from '../app/session';
import { SiteNav } from './SiteNav';

const VISITOR: SessionState = { status: 'visitor' };
const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const FACILITATOR: SessionState = { status: 'person', uid: 'f1', role: 'facilitator', username: 'fabi' };
const SUSPENDED: SessionState = { status: 'suspended', uid: 'u2' };

function setup(session: SessionState, path = '/') {
  window.history.replaceState(null, '', path);
  return render(
    <SessionProvider initial={session}>
      <SiteNav />
    </SessionProvider>,
  );
}

const names = () => within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link').map((link) => link.textContent);

afterEach(() => window.history.replaceState(null, '', '/'));

describe('SiteNav', () => {
  it('RF-7 (003) · 7.2: un nav «Principal» con Prototipado, Foro, Documentación y Constitución y los href de MAIN_MENU', () => {
    setup(VISITOR);
    expect(names()).toEqual(['Prototipado', 'Foro', 'Documentación', 'Constitución']);
    for (const item of MAIN_MENU.filter((entry) => !entry.requiresSession)) {
      expect(screen.getByRole('link', { name: item.label }).getAttribute('href')).toBe(item.href);
    }
    expect(screen.getByRole('link', { name: 'Constitución' }).getAttribute('href')).toBe('/constitucion');
  });

  it.each([
    ['persona inscrita', PERSON],
    ['facilitador', FACILITATOR],
  ])('RF-7 (003) · 7.3: con sesión de %s «Mi tablero» va primero y lleva a /tablero', (_name, session) => {
    setup(session);
    expect(names()).toEqual(['Mi tablero', 'Prototipado', 'Foro', 'Documentación', 'Constitución']);
    expect(screen.getByRole('link', { name: 'Mi tablero' }).getAttribute('href')).toBe('/tablero');
  });

  it.each([
    ['visitante', VISITOR],
    ['cuenta suspendida', SUSPENDED],
  ])('RF-7 (003) · 7.3: sin sesión de persona (%s) no aparece «Mi tablero»', (_name, session) => {
    setup(session);
    expect(screen.queryByRole('link', { name: 'Mi tablero' })).toBeNull();
  });

  it('RF-7 (003) · 7.4: el enlace de la sección vigente lleva aria-current="page" y solo él', () => {
    setup(PERSON, '/documentacion/etica');
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Documentación']);
  });

  it('RF-7 (003) · 7.4: en una ruta fuera del menú ningún enlace está marcado', () => {
    setup(PERSON, '/apices/uno');
    expect(screen.getAllByRole('link').some((link) => link.hasAttribute('aria-current'))).toBe(false);
  });
});
