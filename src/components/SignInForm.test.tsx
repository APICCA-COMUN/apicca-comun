// RF-3 (001) · RF-6 (002) · Formulario de entrada: envío, error y forma de bloque.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthServiceContext } from '../data/authService';
import { authError, fakeAuth } from '../testing/fakeAuth';
import { expectBlocks } from '../testing/expectBlocks';
import { SignInForm } from './SignInForm';

function setup(auth = fakeAuth()) {
  render(
    <AuthServiceContext.Provider value={auth}>
      <SignInForm />
    </AuthServiceContext.Provider>,
  );
  return auth;
}

async function fillAndSend() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), ' ana@ejemplo.org ');
  await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('SignInForm', () => {
  it('RF-3 (001): entra con el correo sin espacios y la contraseña', async () => {
    const auth = setup();
    await fillAndSend();
    expect(auth.signIn).toHaveBeenCalledWith('ana@ejemplo.org', 'una-clave-larga');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RF-3 (001): un fallo se informa con un aviso', async () => {
    setup(fakeAuth({ signIn: () => Promise.reject(authError('auth/invalid-credential')) }));
    await fillAndSend();
    expect((await screen.findByRole('alert')).textContent).toMatch(/correo o la contraseña/);
  });

  it('RF-6 (002) · 6.1, 6.3: campos, aviso y botón son bloques; «Entrar» es la acción principal', async () => {
    setup(fakeAuth({ signIn: () => Promise.reject(authError('auth/invalid-credential')) }));
    await fillAndSend();
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Entrar' }).className).toBe('block action-primary');
    expectBlocks(document.body);
  });
});

describe('SignInForm · campos (003)', () => {
  it('RF-5 (003) · 5.2; RF-17 (003) · 17.1: cada campo tiene su etiqueta visible asociada encima del control', () => {
    setup();
    for (const name of ['Correo', 'Contraseña']) {
      const control = screen.getByLabelText(name) as HTMLInputElement;
      const label = control.closest('label') ?? document.querySelector(`label[for="${control.id}"]`);
      expect(label).not.toBeNull();
      expect(label?.textContent).toContain(name);
      expect(label?.hasAttribute('hidden')).toBe(false);
      expect(control.getAttribute('aria-label')).toBeNull();
      expect(label?.compareDocumentPosition(control) ?? 0).toBeGreaterThan(0);
    }
  });

  it('RF-5 (003) · 5.3: el error se dice con texto en un aviso, no solo con color', async () => {
    setup(fakeAuth({ signIn: () => Promise.reject(authError('auth/invalid-credential')) }));
    await fillAndSend();
    const alert = await screen.findByRole('alert');
    expect((alert.textContent ?? '').length).toBeGreaterThan(0);
  });
});

describe('SignInForm · ajuste al diseño (005)', () => {
  it('RF-5 (005) · 5.1, 5.2: «Mostrar contraseña» alterna el campo entre oculto y visible con aria-pressed', async () => {
    setup();
    const user = userEvent.setup();
    const field = screen.getByLabelText('Contraseña') as HTMLInputElement;
    const reveal = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(reveal.getAttribute('type')).toBe('button');
    expect(reveal.getAttribute('aria-pressed')).toBe('false');
    expect(field.type).toBe('password');
    await user.click(reveal);
    expect(reveal.getAttribute('aria-pressed')).toBe('true');
    expect(field.type).toBe('text');
    await user.click(reveal);
    expect(reveal.getAttribute('aria-pressed')).toBe('false');
    expect(field.type).toBe('password');
    expect(reveal.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('RF-5 (005) · 5.2: mostrar la contraseña no envía el formulario', async () => {
    const auth = setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('RF-5 (005) · 5.3: el formulario lleva la clase que pone «Entrar» a todo el ancho', () => {
    setup();
    const form = screen.getByRole('button', { name: 'Entrar' }).closest('form');
    expect(form?.classList.contains('sign-in-form')).toBe(true);
  });

  it('RF-5 (005) · 5.4: el error va precedido de un ícono decorativo y conserva su texto y su rol', async () => {
    setup(fakeAuth({ signIn: () => Promise.reject(authError('auth/invalid-credential')) }));
    await fillAndSend();
    const alert = await screen.findByRole('alert');
    const icon = alert.firstElementChild;
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(alert.textContent).toMatch(/correo o la contraseña/);
  });
});
