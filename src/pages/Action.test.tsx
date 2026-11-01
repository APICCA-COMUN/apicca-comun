import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { messageFor } from '../../shared/domain/messages';
import { App } from '../App';
import { AuthServiceContext } from '../data/authService';
import { authError, fakeAuth } from '../testing/fakeAuth';

afterEach(() => window.history.replaceState(null, '', '/'));

function open(auth: ReturnType<typeof fakeAuth>, search = '?mode=resetPassword&oobCode=abc') {
  window.history.replaceState(null, '', `/accion${search}`);
  render(
    <AuthServiceContext.Provider value={auth}>
      <App />
    </AuthServiceContext.Provider>,
  );
}

describe('/accion', () => {
  it('RF-3 (001): con un código válido fija la contraseña nueva', async () => {
    const auth = fakeAuth();
    open(auth);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Contraseña nueva'), 'otra-clave-larga');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(auth.verifyResetCode).toHaveBeenCalledWith('abc');
    expect(auth.confirmReset).toHaveBeenCalledWith('abc', 'otra-clave-larga');
    expect((await screen.findByRole('status')).textContent).toMatch(/cambió/);
    // La cabecera también ofrece «Entrar» (RF-7 (003)); el enlace que se afirma es el de la página (D-T21 (003)).
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/entrar');
  });

  it('RF-3 (001): un enlace vencido o ya usado se explica y ofrece pedir otro', async () => {
    for (const code of ['auth/expired-action-code', 'auth/invalid-action-code']) {
      open(fakeAuth({ verifyResetCode: () => Promise.reject(authError(code)) }));
      expect((await screen.findByRole('alert')).textContent).toMatch(/venció o ya se usó/);
      expect(screen.getByRole('link', { name: 'Pedir otro enlace' }).getAttribute('href')).toBe('/olvide');
      expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
      document.body.innerHTML = '';
    }
  });

  it('RF-3 (001): un enlace sin código se trata como inválido', async () => {
    const auth = fakeAuth();
    open(auth, '');
    expect((await screen.findByRole('alert')).textContent).toMatch(/venció o ya se usó/);
    expect(auth.verifyResetCode).not.toHaveBeenCalled();
  });

  it('RF-3 (001): si el código vence al enviar, también lo explica', async () => {
    open(fakeAuth({ confirmReset: () => Promise.reject(authError('auth/expired-action-code')) }));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Contraseña nueva'), 'otra-clave-larga');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/venció o ya se usó/);
  });

  it('RF-2 (001): la contraseña nueva respeta el mínimo de 8 caracteres', async () => {
    const auth = fakeAuth();
    open(auth);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Contraseña nueva'), '1234567');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect((await screen.findByRole('alert')).textContent).toBe(messageFor('password-too-short'));
    expect(auth.confirmReset).not.toHaveBeenCalled();
  });
});

describe('/accion · bloques (002)', () => {
  const kinds = (el: Element) => ['action-primary', 'action-secondary', 'action-destructive'].filter((c) => el.classList.contains(c));

  it('RF-6 (002) · 6.1, 6.3: campo, aviso y envío son bloques y «Cambiar contraseña» es la acción principal', async () => {
    open(fakeAuth());
    const user = userEvent.setup();
    const field = await screen.findByLabelText('Contraseña nueva');
    const button = screen.getByRole('button', { name: 'Cambiar contraseña' });
    expect(field.classList.contains('block')).toBe(true);
    expect(button.classList.contains('block')).toBe(true);
    expect(kinds(button)).toEqual(['action-primary']);
    await user.type(field, 'corta');
    await user.click(button);
    expect(screen.getByRole('alert').classList.contains('block')).toBe(true);
  });

  it('RF-6 (002) · 6.1: el aviso de enlace inválido y el de contraseña cambiada son bloques', async () => {
    open(fakeAuth(), '');
    expect((await screen.findByRole('alert')).classList.contains('block')).toBe(true);
    document.body.innerHTML = '';
    open(fakeAuth());
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Contraseña nueva'), 'otra-clave-larga');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect((await screen.findByRole('status')).classList.contains('block')).toBe(true);
  });
});

describe('/accion · lote (003)', () => {
  const plain = '.block, .action-primary, .action-secondary, .action-destructive, .icon-button';

  it('RF-13 (003) · 13.1: el formulario va en un solo lote angosto', async () => {
    open(fakeAuth());
    await screen.findByLabelText('Contraseña nueva');
    const lots = screen.getByRole('main').querySelectorAll('.lot');
    expect(lots).toHaveLength(1);
    expect(lots[0]!.classList.contains('lot--access')).toBe(true);
    expect(lots[0]!.contains(screen.getByRole('button', { name: 'Cambiar contraseña' }))).toBe(true);
  });

  it('RF-13 (003) · 13.2: «Pedir otro enlace» es un enlace de texto dentro del lote', async () => {
    open(fakeAuth({ verifyResetCode: () => Promise.reject(authError('auth/invalid-action-code')) }));
    await screen.findByRole('alert');
    const link = screen.getByRole('link', { name: 'Pedir otro enlace' });
    expect(link.tagName).toBe('A');
    expect(link.matches(plain)).toBe(false);
    expect(link.closest('.lot')).not.toBeNull();
  });

  it('RF-13 (003) · 13.2: «Entrar» es un enlace de texto dentro del lote', async () => {
    open(fakeAuth());
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Contraseña nueva'), 'otra-clave-larga');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await screen.findByRole('status');
    const link = within(screen.getByRole('main')).getByRole('link', { name: 'Entrar' });
    expect(link.matches(plain)).toBe(false);
    expect(link.closest('.lot')).not.toBeNull();
  });

  it('RF-2 (017): la página fija su propio título de documento', async () => {
    open(fakeAuth());
    await screen.findByRole('heading', { level: 1, name: 'Elegir contraseña nueva' });
    expect(document.title).toBe('Elegir contraseña nueva · APICCA COMÚN');
  });
});
