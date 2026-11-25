// RF-13 (021), RF-1 (015), RF-2 (015), D-T24 (021): el menú plegado de la cabecera. Un botón «Menú» abre un diálogo con las
// cinco entradas de la navegación principal, lo que toca a la sesión y el apoyo. No navega de verdad: fija la ubicación con `replaceState`.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate, setNavigationGuard, useRoute, type NavigateOptions } from '../app/router';
import { SessionProvider, type SessionSource, type SessionState } from '../app/session';
import { expectBlocks } from '../testing/expectBlocks';
import { GameMenu } from './GameMenu';

const VISITOR: SessionState = { status: 'visitor' };
const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const FACILITATOR: SessionState = { status: 'person', uid: 'f1', role: 'facilitator', username: 'fabi' };
const SUSPENDED: SessionState = { status: 'suspended', uid: 'u2' };

function setup(session: SessionState, path = '/') {
  window.history.replaceState(null, '', path);
  return render(
    <SessionProvider initial={session}>
      <GameMenu />
    </SessionProvider>,
  );
}

/** Una fuente de sesión con una persona inscrita; `signOut` es el espía que dice si la sesión se cerró. */
function personSource(signOut: () => Promise<void>): SessionSource {
  return {
    onAuth: (cb) => {
      cb('u1');
      return () => undefined;
    },
    onAccount: (uid, cb) => {
      cb({ email: `${uid}@ejemplo.org`, name: uid, username: uid, role: 'member', status: 'active' });
      return () => undefined;
    },
    signOut,
  };
}

/** Un guardián que frena todo y guarda el último intento; `confirm` repite ese `navigate` como lo hace «Descartar cambios». */
function blockingGuard() {
  let last: { to: string; options: NavigateOptions } | null = null;
  const release = setNavigationGuard((to, options) => {
    last = { to, options };
    return false;
  });
  const confirm = () => {
    if (last === null) throw new Error('el guardián no frenó nada');
    navigate(last.to, { ...last.options, unguarded: true });
  };
  return { release, confirm, attempts: () => last };
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Menú' }));
const menu = () => screen.getByRole('dialog', { name: 'Menú' });
const destinations = () => within(within(menu()).getByRole('navigation', { name: 'Secciones' })).getAllByRole('link');

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

describe('GameMenu', () => {
  it('RF-21 (021) · 21.4: el menú ofrece volver a ver la invitación y borra la marca de vista', () => {
    setup(VISITOR, '/foro');
    open();
    const link = screen.getByRole('link', { name: 'Ver la bienvenida' });
    expect(link.getAttribute('href')).toBe('/?bienvenida=1');
    fireEvent.click(link);
    expect(window.localStorage.getItem('apicca:bienvenida')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('RF-13 (021) · 13.1, 13.7: «Menú» abre un diálogo con Ápices, Acciones Comunes, Documentación, Constitución y Foro', () => {
    const { container } = setup(VISITOR, '/foro');
    const button = screen.getByRole('button', { name: 'Menú' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    expect(destinations().map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Ápices', '/'],
      ['Acciones Comunes', '/acciones'],
      ['Documentación', '/documentacion'],
      ['Constitución', '/constitucion'],
      ['Foro', '/foro'],
    ]);
    expectBlocks(container);
  });

  it('RF-13 (021) · 13.1, D-T24 (021): marca la sección vigente; «Ápices» lo está en el mapa y en sus paneles', () => {
    for (const path of ['/', '/apices/a', '/apices/nuevo', '/apices/a/editar']) {
      const { unmount } = setup(VISITOR, path);
      open();
      const current = destinations().filter((link) => link.getAttribute('aria-current') === 'page');
      expect(current.map((link) => link.textContent), path).toEqual(['Ápices']);
      unmount();
    }
    setup(VISITOR, '/documentacion/como-empezar');
    open();
    expect(destinations().filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual(['Documentación']);
  });

  it('RF-13 (021) · 13.4: sin sesión ofrece «Entrar» y «Unirme», y no lo que pide sesión', () => {
    setup(VISITOR);
    open();
    expect(within(menu()).getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/entrar');
    expect(within(menu()).getByRole('link', { name: 'Unirme' }).getAttribute('href')).toBe('/solicitar');
    expect(within(menu()).queryByRole('link', { name: 'Archivados' })).toBeNull();
    expect(within(menu()).queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    expect(within(menu()).queryByRole('link', { name: 'Facilitación' })).toBeNull();
  });

  it('RF-13 (021) · 13.3, RF-15 (021) · 15.3: con sesión muestra el nombre de usuario y el rol, «Archivados» y «Cerrar sesión»', () => {
    setup(PERSON);
    open();
    expect(within(menu()).getByText('@ana')).toBeTruthy();
    expect(within(menu()).getByText('Persona inscrita')).toBeTruthy();
    expect(within(menu()).getByRole('link', { name: 'Archivados' }).getAttribute('href')).toBe('/archivados');
    within(menu()).getByRole('button', { name: 'Cerrar sesión' });
    expect(within(menu()).queryByRole('link', { name: 'Entrar' })).toBeNull();
    expect(within(menu()).queryByRole('link', { name: 'Facilitación' })).toBeNull();
  });

  it('RF-13 (021) · 13.2: quien facilita ve además «Facilitación»', () => {
    setup(FACILITATOR);
    open();
    expect(within(menu()).getByRole('link', { name: 'Facilitación' }).getAttribute('href')).toBe('/facilitacion/invitaciones');
    expect(within(menu()).getByText('Facilitador')).toBeTruthy();
  });

  it('RF-13 (021) · 13.3: con la cuenta suspendida también ofrece «Cerrar sesión»', () => {
    setup(SUSPENDED);
    open();
    within(menu()).getByRole('button', { name: 'Cerrar sesión' });
  });

  it('RF-13 (021) · 13.3: «Cerrar sesión» lleva al mapa y cierra la sesión', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const source: SessionSource = {
      onAuth: (cb) => {
        cb('u1');
        return () => undefined;
      },
      onAccount: (uid, cb) => {
        cb({ email: `${uid}@ejemplo.org`, name: uid, username: uid, role: 'member', status: 'active' });
        return () => undefined;
      },
      signOut,
    };
    window.history.replaceState(null, '', '/foro');
    render(
      <SessionProvider source={source}>
        <GameMenu />
      </SessionProvider>,
    );
    open();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/');
  });

  it('RF-13 (021) · 13.3, D-T13 (003): con un borrador que frena la navegación, «Cerrar sesión» no cierra la sesión; al confirmar, navega al mapa y luego la cierra', async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => {
      order.push(`signOut@${window.location.pathname}`);
    });
    window.history.replaceState(null, '', '/foro');
    render(
      <SessionProvider source={personSource(signOut)}>
        <GameMenu />
      </SessionProvider>,
    );
    const guard = blockingGuard();
    open();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Cerrar sesión' }));
    expect(guard.attempts()?.to).toBe('/');
    expect(signOut).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/foro');
    // «Seguir editando»: no pasa nada más, y un segundo intento sigue sin cerrar la sesión.
    open();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).not.toHaveBeenCalled();
    guard.confirm();
    expect(order).toEqual(['signOut@/']);
    expect(window.location.pathname).toBe('/');
    guard.release();
  });

  it('RF-13 (021) · 13.3: «Ver la bienvenida» con un borrador que frena la navegación conserva la marca; al confirmar, la borra y llega a /?bienvenida=1', () => {
    window.localStorage.setItem('apicca:bienvenida', '1');
    setup(VISITOR, '/foro');
    const guard = blockingGuard();
    open();
    fireEvent.click(screen.getByRole('link', { name: 'Ver la bienvenida' }));
    expect(window.localStorage.getItem('apicca:bienvenida')).toBe('1');
    expect(window.location.pathname).toBe('/foro');
    guard.confirm();
    expect(window.localStorage.getItem('apicca:bienvenida')).toBeNull();
    expect(window.location.pathname + window.location.search).toBe('/?bienvenida=1');
    guard.release();
  });

  it('RF-21 (021) · 21.4: sin guardián, «Ver la bienvenida» borra la marca antes de que la ruta nueva se pinte', () => {
    window.localStorage.setItem('apicca:bienvenida', '1');
    const seen: Array<string | null> = [];
    const Probe = () => {
      useRoute();
      seen.push(window.localStorage.getItem('apicca:bienvenida'));
      return null;
    };
    window.history.replaceState(null, '', '/foro');
    render(
      <SessionProvider initial={VISITOR}>
        <GameMenu />
        <Probe />
      </SessionProvider>,
    );
    open();
    seen.length = 0;
    fireEvent.click(screen.getByRole('link', { name: 'Ver la bienvenida' }));
    expect(window.location.search).toBe('?bienvenida=1');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((mark) => mark === null)).toBe(true);
  });

  it('RF-13 (021) · 13.5, RF-1 (015), RF-2 (015): el menú muestra el apoyo, con el logo de MangleRojo enlazado a su sitio', () => {
    setup(VISITOR);
    open();
    expect(within(menu()).getByText('Apoyado por')).toBeTruthy();
    const logo = within(menu()).getByRole('img', { name: 'MangleRojo ORG' });
    const link = logo.closest('a')!;
    expect(link.getAttribute('href')).toBe('https://manglerojo.org');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('RF-13 (021) · 13.6, 13.7: elegir un destino cierra el menú; Esc también, y el foco vuelve al botón', () => {
    setup(PERSON);
    open();
    fireEvent.click(within(menu()).getByRole('link', { name: 'Foro' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.pathname).toBe('/foro');
    const button = screen.getByRole('button', { name: 'Menú' });
    button.focus();
    open();
    fireEvent(document.querySelector('dialog')!, new Event('close'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('RF-13 (021) · 13.7: el menú tiene un botón para cerrarlo', () => {
    setup(VISITOR);
    open();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
