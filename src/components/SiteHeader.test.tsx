// Pruebas de SiteHeader (RF-7 (003) · 7.1, 7.2, 7.5–7.7, 7.10; D-27 (003); RF-1 (002) · 1.1, 1.3): menú, conmutador y sesión.
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import { expectBlocks } from '../testing/expectBlocks';
import { SiteHeader } from './SiteHeader';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
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
  it('RF-7 (003) · 7.2, 7.5: el banner trae el logo, el nav «Principal» y el conmutador de tema', () => {
    setup({ status: 'visitor' });
    const banner = screen.getByRole('banner');
    within(banner).getByRole('link', { name: 'APICCA COMÚN, ir al inicio' });
    within(banner).getByRole('navigation', { name: 'Principal' });
    within(banner).getByRole('button', { name: /^Cambiar a tema (claro|oscuro)$/ });
    expect(within(banner).queryByRole('heading')).toBeNull();
  });

  it('RF-7 (003) · 7.6: sin sesión «Entrar» es un enlace action-secondary a /entrar', () => {
    const { container } = setup({ status: 'visitor' });
    const link = screen.getByRole('link', { name: 'Entrar' });
    expect(link.getAttribute('href')).toBe('/entrar');
    expect(link.className).toBe('block action-secondary');
    expectBlocks(container);
  });

  it('RF-7 (003) · 7.7, RF-4 (008) · 4.5: con sesión hay un enlace «account-initial» con la inicial y nombre «Mi tablero, @usuario»', () => {
    setup(PERSON);
    const link = screen.getByRole('link', { name: 'Mi tablero, @ana' });
    expect(link.getAttribute('href')).toBe('/tablero');
    expect(link.classList.contains('account-initial')).toBe(true);
    expect(link.classList.contains('icon-button')).toBe(false);
    expect(link.textContent).toBe('A');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });

  it('RF-7 (003) · 7.10, D-27 (003), RF-4 (008) · 4.6: con la cuenta suspendida hay un icon-button sin inicial «Mi tablero, cuenta suspendida»', () => {
    setup(SUSPENDED);
    const link = screen.getByRole('link', { name: 'Mi tablero, cuenta suspendida' });
    expect(link.getAttribute('href')).toBe('/tablero');
    expect(link.classList.contains('icon-button')).toBe(true);
    expect(link.textContent).toBe('');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    within(screen.getByRole('banner')).getByRole('navigation', { name: 'Principal' });
    within(screen.getByRole('banner')).getByRole('button', { name: /^Cambiar a tema/ });
  });

  it.each([{ status: 'visitor' } as SessionState, PERSON, SUSPENDED])(
    'RF-3 (005) · 3.1: el conmutador de tema va antes del acceso a la cuenta (%o)',
    (session) => {
      setup(session);
      const toggle = within(screen.getByRole('banner')).getByRole('button', { name: /^Cambiar a tema/ });
      const account = within(screen.getByRole('banner')).getByRole('link', { name: /^(Entrar$|Mi tablero,)/ });
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
    expect(inner!.querySelector('nav[aria-label="Principal"]')).not.toBeNull();
  });
});
