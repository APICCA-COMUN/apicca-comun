import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { messageFor } from '../../shared/domain/messages';
import { App } from '../App';
import { SessionProvider, type SessionState } from '../app/session';
import { AuthServiceContext } from '../data/authService';
import { authError, fakeAuth } from '../testing/fakeAuth';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
});

function renderLogin(auth = fakeAuth(), session?: SessionState) {
  window.history.replaceState(null, '', '/entrar');
  render(
    <AuthServiceContext.Provider value={auth}>
      <SessionProvider {...(session ? { initial: session } : {})}>
        <App />
      </SessionProvider>
    </AuthServiceContext.Provider>,
  );
  return auth;
}

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('/entrar', () => {
  it('RF-3 (001): con correo y contraseña correctos pide entrar a Auth', async () => {
    const auth = renderLogin();
    await fill(' ana@ejemplo.org ', 'una-clave-larga');
    expect(auth.signIn).toHaveBeenCalledWith('ana@ejemplo.org', 'una-clave-larga');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RF-3 (001): correo mal o contraseña mal dan el mismo mensaje, sin revelar cuál falló', async () => {
    const messages: string[] = [];
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
      const auth = fakeAuth({ signIn: () => Promise.reject(authError(code)) });
      renderLogin(auth);
      await fill('ana@ejemplo.org', 'incorrecta');
      messages.push((await screen.findByRole('alert')).textContent ?? '');
      document.body.innerHTML = '';
    }
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toMatch(/correo o la contraseña/);
  });

  it('RF-3 (001): ante auth/too-many-requests avisa del límite de intentos', async () => {
    renderLogin(fakeAuth({ signIn: () => Promise.reject(authError('auth/too-many-requests')) }));
    await fill('ana@ejemplo.org', 'x');
    expect((await screen.findByRole('alert')).textContent).toBe(messageFor('rate-limited'));
  });

  it('RF-5 (001): con la cuenta suspendida muestra el acceso suspendido y no el formulario', () => {
    renderLogin(fakeAuth(), { status: 'suspended', uid: 'u1' });
    expect(screen.getByRole('alert').textContent).toContain(messageFor('account-suspended'));
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
  });

  it('RF-3 (004) · 3.4, D-T19 (004): quien ya tiene sesión y no trae ruta guardada ni ?volver= va a Mi tablero', () => {
    renderLogin(fakeAuth(), { status: 'person', uid: 'u1', role: 'member', username: 'ana' });
    expect(window.location.pathname).toBe('/tablero');
  });

  it('RF-11 (003) · 11.8: quien ya tiene sesión y llegó con ?volver=/tablero va a /tablero', () => {
    window.history.replaceState(null, '', '/entrar?volver=%2Ftablero');
    render(
      <AuthServiceContext.Provider value={fakeAuth()}>
        <SessionProvider initial={{ status: 'person', uid: 'u1', role: 'member', username: 'ana' }}>
          <App />
        </SessionProvider>
      </AuthServiceContext.Provider>,
    );
    expect(window.location.pathname).toBe('/tablero');
  });

  it('RF-11 (003) · 11.8, RF-17 (003) · 17.1, D-T19 (004): un destino no permitido en ?volver= se ignora y va a Mi tablero', () => {
    window.history.replaceState(null, '', '/entrar?volver=https%3A%2F%2Fotro.sitio');
    render(
      <AuthServiceContext.Provider value={fakeAuth()}>
        <SessionProvider initial={{ status: 'person', uid: 'u1', role: 'member', username: 'ana' }}>
          <App />
        </SessionProvider>
      </AuthServiceContext.Provider>,
    );
    expect(window.location.pathname).toBe('/tablero');
  });

  it('RF-3 (001): enlaza a restablecer la contraseña', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /olvidé/i }).getAttribute('href')).toBe('/olvide');
  });
});

describe('/entrar · bloques (002)', () => {
  // El formulario es SignInForm (bloques propios); la página solo añade el título y el enlace de recuperación.
  it('RF-6 (002) · 6.1, 6.3: «Entrar» es la acción principal y el enlace de recuperación es un enlace normal', () => {
    renderLogin();
    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button.classList.contains('block')).toBe(true);
    expect(button.classList.contains('action-primary')).toBe(true);
    expect(screen.getByRole('link', { name: 'Olvidé mi contraseña' }).className).toBe('');
  });
});

describe('/entrar · lote (003)', () => {
  it('RF-13 (003) · 13.1: el formulario va en un solo lote angosto', () => {
    renderLogin();
    const lots = screen.getByRole('main').querySelectorAll('.lot');
    expect(lots).toHaveLength(1);
    expect(lots[0]!.classList.contains('lot--access')).toBe(true);
    expect(lots[0]!.contains(screen.getByRole('button', { name: 'Entrar' }))).toBe(true);
  });

  it('RF-13 (003) · 13.2: «Olvidé mi contraseña» es un enlace de texto, sin forma de botón', () => {
    renderLogin();
    const link = screen.getByRole('link', { name: 'Olvidé mi contraseña' });
    expect(link.tagName).toBe('A');
    expect(link.matches('.block, .action-primary, .action-secondary, .action-destructive, .icon-button')).toBe(false);
  });

  it('RF-13 (003) · 13.3: sin sesión ofrece un enlace de texto a «Pide tu inscripción»', () => {
    renderLogin();
    const link = within(screen.getByRole('main')).getByRole('link', { name: 'Pide tu inscripción' });
    expect(link.getAttribute('href')).toBe('/solicitar');
    expect(link.matches('.block, .action-primary, .action-secondary, .action-destructive, .icon-button')).toBe(false);
  });

  it('RF-13 (003) · 13.3: con la cuenta suspendida no ofrece el enlace a «Pide tu inscripción»', () => {
    renderLogin(fakeAuth(), { status: 'suspended', uid: 'u1' });
    expect(within(screen.getByRole('main')).queryByRole('link', { name: 'Pide tu inscripción' })).toBeNull();
  });
});

describe('/entrar · regreso tras entrar (004)', () => {
  const member: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };

  it('RF-3 (004) · 3.4: con una ruta interna guardada, al entrar vuelve a ella y la borra', () => {
    window.sessionStorage.setItem('apicca:returnTo', '/constitucion/historial');
    renderLogin(fakeAuth(), member);
    expect(window.location.pathname).toBe('/constitucion/historial');
    expect(window.sessionStorage.getItem('apicca:returnTo')).toBeNull();
  });

  it('RF-3 (004) · 3.4: una ruta guardada que empieza por «//» lleva a Mi tablero', () => {
    window.sessionStorage.setItem('apicca:returnTo', '//otro.sitio/x');
    renderLogin(fakeAuth(), member);
    expect(window.location.pathname).toBe('/tablero');
  });

  it('RF-3 (004) · 3.4: una ruta guardada que no es interna lleva a Mi tablero', () => {
    window.sessionStorage.setItem('apicca:returnTo', 'https://otro.sitio');
    renderLogin(fakeAuth(), member);
    expect(window.location.pathname).toBe('/tablero');
  });

  it('RF-2 (017): la página fija su propio título de documento, también al cargarla directamente', async () => {
    renderLogin();
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });
    expect(document.title).toBe('Entrar · APICCA COMÚN');
  });
});
