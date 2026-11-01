// RF-1 (002) · 1.1, 1.3 y RF-10 (002) · 10.1: la cabecera con el logo y el conmutador está en toda
// ruta, fuera de `<main>`, y el logo no es el `h1` (D-T16 (002)). Las páginas se reemplazan por
// dobles que solo pintan su `h1`: aquí importa la cabecera, no lo que cada página consulta.
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { SessionProvider } from './app/session';
import { ROUTES } from './app/router';

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
vi.mock('./pages/Dashboard', () => ({ Dashboard: () => <h1>Dashboard</h1> }));
vi.mock('./pages/FacilitationAccounts', () => ({ FacilitationAccounts: () => <h1>FacilitationAccounts</h1> }));
vi.mock('./pages/FacilitationEnrollments', () => ({ FacilitationEnrollments: () => <h1>FacilitationEnrollments</h1> }));
vi.mock('./pages/FacilitationInvitations', () => ({ FacilitationInvitations: () => <h1>FacilitationInvitations</h1> }));
vi.mock('./pages/Forum', () => ({ Forum: () => <h1>Forum</h1> }));
vi.mock('./pages/ForumThread', () => ({ ForumThread: () => <h1>ForumThread</h1> }));
vi.mock('./pages/Forgot', () => ({ ForgotPage: () => <h1>ForgotPage</h1> }));
vi.mock('./pages/Home', () => ({ Home: () => <h1>Home</h1> }));
vi.mock('./pages/Login', () => ({ LoginPage: () => <h1>LoginPage</h1> }));
vi.mock('./pages/Prototyping', () => ({ Prototyping: () => <h1>Prototyping</h1> }));

/** Cada patrón con parámetros de ejemplo, más la ruta desconocida. */
const PATHS = [...ROUTES.map((route) => route.pattern.replace(/:[a-z]+/gi, 'ejemplo')), '/ruta-que-no-existe'];

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
  it('RF-7 (003) · 7.2, 7.6: el banner trae el nav «Principal» con Constitución y, sin sesión, «Entrar»', () => {
    window.history.replaceState(null, '', path);
    render(<App />);
    const banner = screen.getByRole('banner');
    const nav = within(banner).getByRole('navigation', { name: 'Principal' });
    within(nav).getByRole('link', { name: 'Constitución' });
    within(banner).getByRole('link', { name: 'Entrar' });
  });

  it('RF-7 (003) · 7.7, 7.3: con sesión el banner trae «Mi tablero, @ana» y «Mi tablero» en el menú', () => {
    window.history.replaceState(null, '', path);
    render(
      <SessionProvider initial={{ status: 'person', uid: 'u1', role: 'member', username: 'ana' }}>
        <App />
      </SessionProvider>,
    );
    const banner = screen.getByRole('banner');
    within(banner).getByRole('link', { name: 'Mi tablero, @ana' });
    within(within(banner).getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Mi tablero' });
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
