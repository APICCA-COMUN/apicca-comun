import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { AuthServiceContext } from '../data/authService';
import { authError, fakeAuth } from '../testing/fakeAuth';

afterEach(() => window.history.replaceState(null, '', '/'));

async function ask(auth: ReturnType<typeof fakeAuth>, email: string): Promise<string> {
  window.history.replaceState(null, '', '/olvide');
  render(
    <AuthServiceContext.Provider value={auth}>
      <App />
    </AuthServiceContext.Provider>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo electrónico'), email);
  await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
  const status = await screen.findByRole('status');
  const text = status.textContent ?? '';
  document.body.innerHTML = '';
  return text;
}

describe('/olvide', () => {
  it('RF-3 (001): muestra el mismo texto con un correo con cuenta, sin cuenta y suspendido', async () => {
    const withAccount = fakeAuth();
    const noAccount = fakeAuth({ sendReset: () => Promise.reject(authError('auth/user-not-found')) });
    const suspended = fakeAuth();
    const texts = [
      await ask(withAccount, 'ana@ejemplo.org'),
      await ask(noAccount, 'nadie@ejemplo.org'),
      await ask(suspended, 'susi@ejemplo.org'),
    ];
    expect(new Set(texts).size).toBe(1);
    expect(withAccount.sendReset).toHaveBeenCalledWith('ana@ejemplo.org');
    expect(texts[0]).toMatch(/Si el correo tiene una cuenta/);
  });
});

describe('/olvide · bloques (002)', () => {
  it('RF-6 (002) · 6.1, 6.3: campo, avisos y envío son bloques y «Enviar enlace» es la acción principal', async () => {
    window.history.replaceState(null, '', '/olvide');
    const auth = fakeAuth({ sendReset: () => Promise.reject(authError('auth/network-request-failed')) });
    render(
      <AuthServiceContext.Provider value={auth}>
        <App />
      </AuthServiceContext.Provider>,
    );
    const user = userEvent.setup();
    const field = screen.getByLabelText('Correo electrónico');
    const button = screen.getByRole('button', { name: 'Enviar enlace' });
    expect(field.classList.contains('block')).toBe(true);
    expect(button.classList.contains('block')).toBe(true);
    expect(button.classList.contains('action-primary')).toBe(true);
    expect(button.classList.contains('action-secondary') || button.classList.contains('action-destructive')).toBe(false);
    await user.type(field, 'ana@ejemplo.org');
    await user.click(button);
    expect((await screen.findByRole('alert')).classList.contains('block')).toBe(true);
    // Sin falla de red la confirmación es el aviso de estado.
    document.body.innerHTML = '';
    render(
      <AuthServiceContext.Provider value={fakeAuth()}>
        <App />
      </AuthServiceContext.Provider>,
    );
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@ejemplo.org');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect((await screen.findByRole('status')).classList.contains('block')).toBe(true);
  });
});

describe('/olvide · lote (003)', () => {
  function open() {
    window.history.replaceState(null, '', '/olvide');
    render(
      <AuthServiceContext.Provider value={fakeAuth()}>
        <App />
      </AuthServiceContext.Provider>,
    );
  }

  it('RF-13 (003) · 13.1: el formulario va en un solo lote angosto', () => {
    open();
    const lots = screen.getByRole('main').querySelectorAll('.lot');
    expect(lots).toHaveLength(1);
    expect(lots[0]!.classList.contains('lot--access')).toBe(true);
    expect(lots[0]!.contains(screen.getByRole('button', { name: 'Enviar enlace' }))).toBe(true);
  });

  it('RF-13 (003) · 13.2: «Volver a entrar» es un enlace de texto, sin forma de botón', () => {
    open();
    const link = within(screen.getByRole('main')).getByRole('link', { name: 'Volver a entrar' });
    expect(link.tagName).toBe('A');
    expect(link.matches('.block, .action-primary, .action-secondary, .action-destructive, .icon-button')).toBe(false);
  });
});

describe('/olvide · título (017)', () => {
  it('RF-2 (017): la página fija su propio título de documento', async () => {
    window.history.replaceState(null, '', '/olvide');
    render(
      <AuthServiceContext.Provider value={fakeAuth()}>
        <App />
      </AuthServiceContext.Provider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Restablecer contraseña' });
    expect(document.title).toBe('Restablecer contraseña · APICCA COMÚN');
  });
});
