// RF-1 (002) · 1.1, 1.3 y RF-10 (002) · 10.1: la cabecera con el logo y el conmutador está en toda
// página de texto, fuera de `<main>`, y el logo no es el `h1` (D-T16 (002)). RF-11 (021) · 11.2, RF-16 (021), D-T21 (021):
// las rutas del mapa no llevan cabecera ni pie; sus controles los pone el mapa. RF-17 (021): las direcciones de
// Prototipado y Mi tablero llevan al mapa. Las páginas se reemplazan por dobles que solo pintan su `h1`: aquí importa la
// cabecera, no lo que cada página consulta.
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { SessionProvider } from './app/session';
import { ROUTES, isMapPage, matchRoute } from './app/router';

vi.mock('./pages/Action', () => ({ ActionPage: () => <h1>ActionPage</h1> }));
vi.mock('./pages/ApiceEdit', () => ({ ApiceEdit: () => <h1>ApiceEdit</h1> }));
vi.mock('./pages/ApiceHistory', () => ({ ApiceHistory: () => <h1>ApiceHistory</h1> }));
vi.mock('./pages/ApiceNew', () => ({ ApiceNew: () => <h1>ApiceNew</h1> }));
vi.mock('./pages/ArchivedApices', () => ({ ArchivedApices: () => <h1>ArchivedApices</h1> }));
vi.mock('./pages/ApiceView', () => ({ ApiceView: () => <h1>ApiceView</h1> }));
vi.mock('./pages/ConstitutionPage', () => ({ ConstitutionPage: () => <h1>ConstitutionPage</h1> }));
vi.mock('./pages/ConstitutionHistory', () => ({ ConstitutionHistory: () => <h1>ConstitutionHistory</h1> }));
vi.mock('./pages/ConstitutionSection', () => ({ ConstitutionSection: () => <h1>ConstitutionSection</h1> }));
vi.mock('./pages/ConstitutionDocument', () => ({ ConstitutionDocument: () => <h1>ConstitutionDocument</h1> }));
vi.mock('./pages/Amendments', () => ({ Amendments: () => <h1>Amendments</h1> }));
vi.mock('./pages/AmendmentView', () => ({ AmendmentView: () => <h1>AmendmentView</h1> }));
vi.mock('./pages/Documentation', () => ({ default: () => <h1>Documentation</h1> }));
vi.mock('./pages/FacilitationAccounts', () => ({ FacilitationAccounts: () => <h1>FacilitationAccounts</h1> }));
vi.mock('./pages/FacilitationEnrollments', () => ({ FacilitationEnrollments: () => <h1>FacilitationEnrollments</h1> }));
vi.mock('./pages/FacilitationInvitations', () => ({ FacilitationInvitations: () => <h1>FacilitationInvitations</h1> }));
vi.mock('./pages/Forum', () => ({ Forum: () => <h1>Forum</h1> }));
vi.mock('./pages/ForumThread', () => ({ ForumThread: () => <h1>ForumThread</h1> }));
vi.mock('./pages/Forgot', () => ({ ForgotPage: () => <h1>ForgotPage</h1> }));
vi.mock('./pages/Login', () => ({ LoginPage: () => <h1>LoginPage</h1> }));
vi.mock('./pages/Play', () => ({ Play: () => <h1>Play</h1> }));

const PERSON = { status: 'person', uid: 'u1', role: 'member', username: 'ana' } as const;

/** Cada patrón con parámetros de ejemplo, más la ruta desconocida. */
const ALL = [...ROUTES.map((route) => route.pattern.replace(/:[a-z]+/gi, 'ejemplo')), '/ruta-que-no-existe'];
/** Las que llevan a otra parte (RF-17 (021)). */
const REDIRECTS = ['/prototipado', '/tablero'];
/** Las páginas de texto (RF-16 (021)). */
const PATHS = ALL.filter((path) => !isMapPage(matchRoute(path).page) && !REDIRECTS.includes(path));
/** Las rutas del mapa (RF-11 (021), RF-14 (021) · 14.5). */
const MAP_PATHS = ALL.filter((path) => isMapPage(matchRoute(path).page));

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe.each(PATHS)('cabecera en %s', (path) => {
  it('RF-1 (002) · 1.1: hay un banner fuera de <main> con el logo y el conmutador (RF-10 (002) · 10.1)', () => {
    window.history.replaceState(null, '', path);
    render(<App />);
    const banner = screen.getByRole('banner');
    expect(banner.closest('main')).toBeNull();
    within(banner).getByRole('link', { name: 'APICCA COMÚN, ir al inicio' });
    within(banner).getByRole('button', { name: /^Cambiar a tema (claro|oscuro)$/ });
  });

  it('RF-1 (002) · 1.3: el logo no es el h1; la página conserva el suyo', () => {
    window.history.replaceState(null, '', path);
    render(<App />);
    const banner = screen.getByRole('banner');
    expect(within(banner).queryByRole('heading')).toBeNull();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]!.closest('main')).not.toBeNull();
  });
});

describe.each(PATHS)('menú y sesión de la cabecera en %s', (path) => {
  it('RF-16 (021) · 16.2, RF-7 (003) · 7.6: el banner trae la navegación principal, «Menú» y, sin sesión, «Entrar»', () => {
    window.history.replaceState(null, '', path);
    render(<App />);
    const banner = screen.getByRole('banner');
    const nav = within(banner).getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Ápices', 'Acciones Comunes', 'Documentación', 'Constitución', 'Foro']);
    within(banner).getByRole('button', { name: 'Menú' });
    within(banner).getByRole('link', { name: 'Entrar' });
  });

  it('RF-15 (021) · 15.3, RF-7 (003) · 7.7: con sesión el banner trae la cuenta, que lleva a Lo mío', () => {
    window.history.replaceState(null, '', path);
    render(
      <SessionProvider initial={PERSON}>
        <App />
      </SessionProvider>,
    );
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'Lo mío, @ana, Persona inscrita' }).getAttribute('href')).toBe('/?mio=1');
  });
});

describe.each(MAP_PATHS)('el mapa en %s', (path) => {
  it('RF-11 (021) · 11.2, RF-14 (021) · 14.5, D-T21 (021): la ruta pinta el mapa, sin cabecera ni pie de sitio', () => {
    window.history.replaceState(null, '', path);
    render(<App />);
    screen.getByRole('heading', { level: 1, name: 'Play' });
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(screen.getByRole('main').querySelector('h1')?.textContent).toBe('Play');
  });
});

describe('direcciones anteriores (RF-17 (021))', () => {
  it('RF-17 (021) · 17.1: /prototipado lleva al mapa con la misma consulta, sin quedar en el historial', async () => {
    window.history.replaceState(null, '', '/prototipado?ejes=agua&vista=lista');
    const before = window.history.length;
    render(<App />);
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/?ejes=agua&vista=lista'));
    expect(window.history.length).toBe(before);
    screen.getByRole('heading', { level: 1, name: 'Play' });
  });

  it('RF-17 (021) · 17.2: con sesión, /tablero lleva al mapa con el filtro de lo propio', async () => {
    window.history.replaceState(null, '', '/tablero');
    render(
      <SessionProvider initial={PERSON}>
        <App />
      </SessionProvider>,
    );
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/?mio=1'));
  });

  it('RF-17 (021) · 17.3, RF-11 (003) · 11.7: sin sesión, /tablero lleva a entrar y, al volver, de nuevo a /tablero', async () => {
    window.history.replaceState(null, '', '/tablero');
    render(<App />);
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/entrar?volver=%2Ftablero'));
  });

  it('RF-17 (021) · 17.2, D-T21 (021): con la cuenta suspendida, /tablero lleva al mapa', async () => {
    window.history.replaceState(null, '', '/tablero');
    render(
      <SessionProvider initial={{ status: 'suspended', uid: 'u2' }}>
        <App />
      </SessionProvider>,
    );
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('RF-17 (021) · 17.1: con la sesión cargando, /tablero espera', () => {
    window.history.replaceState(null, '', '/tablero');
    render(
      <SessionProvider initial={{ status: 'loading' }}>
        <App />
      </SessionProvider>,
    );
    expect(window.location.pathname).toBe('/tablero');
    screen.getByText('Cargando…');
  });
});

describe.each(PATHS)('pie en %s', (path) => {
  it('RF-8 (003) · 8.1, RF-1 (015): hay un único contentinfo fuera de <main>, con el apoyo de MangleRojo', () => {
    window.history.replaceState(null, '', path);
    render(<App />);
    const footers = screen.getAllByRole('contentinfo');
    expect(footers).toHaveLength(1);
    expect(footers[0]!.closest('main')).toBeNull();
    within(footers[0]!).getByText('Apoyado por');
  });
});
