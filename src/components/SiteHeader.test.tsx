// Pruebas de SiteHeader (RF-7 (003) · 7.1, 7.5–7.7, 7.10; D-27 (003); RF-1 (002) · 1.1, 1.3; RF-16 (021) · 16.2;
// RF-15 (021) · 15.3; D-T24 (021)): la cabecera de todo el sitio, con el logo, la navegación principal, el tema, los
// avisos, la cuenta y «Menú».
import { render, screen, within } from '@testing-library/react';
import { MAIN_MENU } from '../../shared/domain/navigation';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import { expectBlocks } from '../testing/expectBlocks';
import { SiteHeader } from './SiteHeader';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const FACILITATOR: SessionState = { status: 'person', uid: 'u3', role: 'facilitator', username: 'flor' };
const SUSPENDED: SessionState = { status: 'suspended', uid: 'u2' };

function setup(session: SessionState) {
  return render(
    <SessionProvider initial={session}>
      <SiteHeader />
    </SessionProvider>,
  );
}

afterEach(() => window.history.replaceState(null, '', '/'));

describe('SiteHeader', () => {
  it('RF-16 (021) · 16.2, RF-7 (003) · 7.5: el banner trae el logo, la navegación principal, el conmutador de tema y «Menú», en ese orden', () => {
    setup({ status: 'visitor' });
    const banner = screen.getByRole('banner');
    const logo = within(banner).getByRole('link', { name: 'APICCA COMÚN, ir al inicio' });
    const nav = within(banner).getByRole('navigation', { name: 'Principal' });
    const theme = within(banner).getByRole('button', { name: /^Cambiar a tema (claro|oscuro)$/ });
    const menu = within(banner).getByRole('button', { name: 'Menú' });
    const order = [logo, nav, theme, menu];
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(banner).queryByRole('heading')).toBeNull();
    expect(within(banner).queryByText(/Volver al mapa/)).toBeNull();
  });

  it('sistema «APICCA · Mapa»: la navegación trae Ápices, Acciones Comunes, Documentación, Constitución y Foro', () => {
    setup(PERSON);
    const nav = within(screen.getByRole('banner')).getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      MAIN_MENU.map((item) => [item.label, item.href]),
    );
  });

  it.each([
    ['/', 'Ápices'],
    ['/apices/a', 'Ápices'],
    ['/apices/nuevo', 'Ápices'],
    ['/apices/a/historial', 'Ápices'],
    ['/acciones', 'Acciones Comunes'],
    ['/acciones/nueva', 'Acciones Comunes'],
    ['/documentacion/como-empezar', 'Documentación'],
    ['/constitucion/propuestas', 'Constitución'],
    ['/foro/h1', 'Foro'],
  ])('sistema «APICCA · Mapa»: en %s la entrada vigente es «%s» y solo ella', (path, current) => {
    window.history.replaceState(null, '', path);
    setup(PERSON);
    const nav = within(screen.getByRole('banner')).getByRole('navigation', { name: 'Principal' });
    const marked = within(nav).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(marked.map((link) => link.textContent)).toEqual([current]);
  });

  it('sistema «APICCA · Mapa»: en una página que no es de la navegación ninguna entrada es la vigente', () => {
    window.history.replaceState(null, '', '/entrar');
    setup({ status: 'visitor' });
    const nav = within(screen.getByRole('banner')).getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(0);
  });

  it('RF-4 (012): con sesión la cabecera trae la campana de avisos, antes de la cuenta; sin sesión no', async () => {
    const source = { fetchNotices: async () => ({ notices: [], seenAt: null }) };
    const { unmount } = render(
      <SessionProvider initial={PERSON}>
        <SiteHeader noticesSource={source} />
      </SessionProvider>,
    );
    const banner = screen.getByRole('banner');
    const bell = within(banner).getByRole('button', { name: /^Avisos/ });
    const account = within(banner).getByRole('link', { name: /^Lo mío,/ });
    expect(bell.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
    setup({ status: 'visitor' });
    expect(screen.queryByRole('button', { name: /^Avisos/ })).toBeNull();
  });

  it('RF-7 (003) · 7.6: sin sesión «Entrar» es un enlace action-secondary a /entrar', () => {
    const { container } = setup({ status: 'visitor' });
    const link = screen.getByRole('link', { name: 'Entrar' });
    expect(link.getAttribute('href')).toBe('/entrar');
    expect(link.className).toBe('block action-secondary');
    expectBlocks(container);
  });

  it('RF-15 (021) · 15.3, RF-7 (003) · 7.7, D-T24 (021): con sesión, la cuenta lleva a Lo mío y muestra la inicial, el nombre de usuario y el rol', () => {
    setup(PERSON);
    const link = screen.getByRole('link', { name: 'Lo mío, @ana, Persona inscrita' });
    expect(link.getAttribute('href')).toBe('/?mio=1');
    expect(link.querySelector('.account-initial')?.textContent).toBe('A');
    expect(link.querySelector('.account-entry__name')?.textContent).toBe('@ana');
    expect(link.querySelector('.account-entry__role')?.textContent).toBe('Persona inscrita');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });

  it('RF-15 (021) · 15.3: el rol de quien facilita es «Facilitador»', () => {
    setup(FACILITATOR);
    screen.getByRole('link', { name: 'Lo mío, @flor, Facilitador' });
  });

  it('RF-7 (003) · 7.10, D-27 (003), RF-4 (008) · 4.6, D-T24 (021): con la cuenta suspendida hay un icon-button sin inicial «Cuenta suspendida» que lleva al mapa', () => {
    setup(SUSPENDED);
    const link = screen.getByRole('link', { name: 'Cuenta suspendida' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.classList.contains('icon-button')).toBe(true);
    expect(link.textContent).toBe('');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    within(screen.getByRole('banner')).getByRole('button', { name: 'Menú' });
  });

  it.each([{ status: 'visitor' } as SessionState, PERSON, SUSPENDED])(
    'RF-3 (005) · 3.1: el conmutador de tema va antes del acceso a la cuenta (%o)',
    (session) => {
      setup(session);
      const toggle = within(screen.getByRole('banner')).getByRole('button', { name: /^Cambiar a tema/ });
      const account = within(screen.getByRole('banner')).getByRole('link', { name: /^(Entrar$|Lo mío,|Cuenta suspendida$)/ });
      expect(toggle.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

  it('RF-7 (003) · 7.1: la cabecera no lleva clases de sombra ni de recuadro propias', () => {
    setup(PERSON);
    const banner = screen.getByRole('banner');
    expect(banner.className).toBe('site-header');
    expect(banner.className).not.toMatch(/block|lot|shadow/);
  });

  it('RF-4 (008) · 4.1: el contenido va dentro de una columna propia, `site-header__inner`', () => {
    const { container } = setup(PERSON);
    const inner = container.querySelector('header > .site-header__inner');
    expect(inner).not.toBeNull();
    expect(inner!.querySelector('button[aria-haspopup="dialog"]')?.textContent).toBe('Menú');
  });
});
