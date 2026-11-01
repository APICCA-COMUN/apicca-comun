// T-1.36: formulario de registro por invitación (RF-2 (001)). RF-6 (017): inicia sesión por el servicio de `src/data/`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../data/api';
import { SessionProvider } from '../app/session';
import { AuthServiceContext, type AuthService } from '../data/authService';
import { RegisterPage as Page, realRegisterOps, type RegisterOps } from './RegisterPage';
import { expectBlocks } from '../testing/expectBlocks';

const pending = { state: 'pending' as const, email: 'ana@ejemplo.org', accountExists: false };

type TestOps = RegisterOps & Pick<AuthService, 'signIn'>;

const unusedAuth: AuthService = {
  signIn: () => Promise.reject(new Error('sin uso')),
  sendReset: () => Promise.reject(new Error('sin uso')),
  verifyResetCode: () => Promise.reject(new Error('sin uso')),
  confirmReset: () => Promise.reject(new Error('sin uso')),
};

/** La página con el `signIn` del doble inyectado por el contexto de autenticación, como en la app (RF-6 (017)). */
function RegisterPage({ token, ops: o }: { token: string; ops: TestOps }) {
  return (
    <AuthServiceContext.Provider value={{ ...unusedAuth, signIn: o.signIn }}>
      <Page token={token} ops={o} />
    </AuthServiceContext.Provider>
  );
}

function ops(overrides: Partial<TestOps> = {}): TestOps {
  return {
    inspect: vi.fn().mockResolvedValue(pending),
    register: vi.fn().mockResolvedValue({ uid: 'u1' }),
    signIn: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function fill(user: ReturnType<typeof userEvent.setup>, username = 'ana_p') {
  await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga');
  await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Nombre de usuario'), username);
}

describe('RegisterPage', () => {
  it('RF-2 (001): muestra el correo de la invitación sin poder editarlo', async () => {
    render(<RegisterPage token="tok" ops={ops()} />);
    const email = await screen.findByLabelText('Correo');
    expect((email as HTMLInputElement).value).toBe('ana@ejemplo.org');
    expect((email as HTMLInputElement).readOnly).toBe(true);
  });

  it('RF-2 (001): al registrar envía solo token, contraseña, nombre y usuario, y luego inicia sesión', async () => {
    const o = ops();
    const user = userEvent.setup();
    render(<RegisterPage token="tok" ops={o} />);
    await screen.findByLabelText('Correo');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Crear mi acceso' }));
    await waitFor(() => expect(o.signIn).toHaveBeenCalledWith('ana@ejemplo.org', 'una-clave-larga'));
    expect(o.register).toHaveBeenCalledWith({
      token: 'tok',
      password: 'una-clave-larga',
      name: 'Ana Pérez',
      username: 'ana_p',
    });
  });

  it('RF-2 (001): un usuario en uso se explica y conserva el resto de lo escrito', async () => {
    const o = ops({ register: vi.fn().mockRejectedValue(new ApiClientError('username-taken')) });
    const user = userEvent.setup();
    render(<RegisterPage token="tok" ops={o} />);
    await screen.findByLabelText('Correo');
    await fill(user, 'ana');
    await user.click(screen.getByRole('button', { name: 'Crear mi acceso' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/usuario/i);
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana Pérez');
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('una-clave-larga');
    expect(o.signIn).not.toHaveBeenCalled();
  });

  it('RF-2 (001): un enlace vencido durante el registro se explica, pide invitación nueva y conserva lo escrito', async () => {
    const o = ops({ register: vi.fn().mockRejectedValue(new ApiClientError('invitation-expired')) });
    const user = userEvent.setup();
    render(<RegisterPage token="tok" ops={o} />);
    await screen.findByLabelText('Correo');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Crear mi acceso' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/facilitador/i);
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana Pérez');
  });

  it('RF-2 (001): un error inesperado conserva lo escrito y no filtra su detalle', async () => {
    const o = ops({ register: vi.fn().mockRejectedValue(new Error('detalle interno')) });
    const user = userEvent.setup();
    render(<RegisterPage token="tok" ops={o} />);
    await screen.findByLabelText('Correo');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Crear mi acceso' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('detalle interno');
    expect((screen.getByLabelText('Nombre de usuario') as HTMLInputElement).value).toBe('ana_p');
  });

  it('RF-2 (001): un correo que ya tiene cuenta lo explica y ofrece entrar', async () => {
    render(<RegisterPage token="tok" ops={ops({ inspect: vi.fn().mockResolvedValue({ ...pending, accountExists: true }) })} />);
    const link = await screen.findByRole('link', { name: /entrar/i });
    expect(link.getAttribute('href')).toBe('/entrar');
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
  });

  it.each([
    ['vencido', { state: 'expired' as const, email: 'ana@ejemplo.org', accountExists: false }, null],
    ['usado', { state: 'accepted' as const, email: 'ana@ejemplo.org', accountExists: false }, null],
    ['inexistente', null, new ApiClientError('invitation-not-found')],
  ])('RF-2 (001): un enlace %s explica que se pida una invitación nueva', async (_label, value, error) => {
    const inspect = error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(value);
    render(<RegisterPage token="tok" ops={ops({ inspect })} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/facilitador/i);
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
  });

  it('RF-2 (001): con sesión iniciada pide cerrarla antes de continuar', async () => {
    const session = { status: 'person' as const, uid: 'u', role: 'member' as const, username: 'beto' };
    render(
      <SessionProvider initial={session}>
        <RegisterPage token="tok" ops={ops()} />
      </SessionProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
  });
});

describe('RegisterPage · bloques (002)', () => {
  it('RF-6 (002) · 6.1, 6.3: campos, avisos y envío son bloques y «Crear mi acceso» es la acción principal', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RegisterPage token="tok" ops={ops({ register: vi.fn().mockRejectedValue(new ApiClientError('username-taken')) })} />,
    );
    expect(container.querySelector('[role="status"]')?.classList.contains('block')).toBe(true);
    await screen.findByLabelText('Correo');
    const button = screen.getByRole('button', { name: 'Crear mi acceso' });
    expect(button.classList.contains('block')).toBe(true);
    expect(button.classList.contains('action-primary')).toBe(true);
    expect(button.classList.contains('action-secondary') || button.classList.contains('action-destructive')).toBe(false);
    await fill(user);
    await user.click(button);
    expect((await screen.findByRole('alert')).classList.contains('block')).toBe(true);
    expectBlocks(container);
  });

  it('RF-6 (002) · 6.1: el aviso de invitación rechazada es un bloque', async () => {
    const { container } = render(<RegisterPage token="tok" ops={ops({ inspect: vi.fn().mockResolvedValue({ state: 'expired', email: 'a@b.c', accountExists: false }) })} />);
    expect((await screen.findByRole('alert')).classList.contains('block')).toBe(true);
    expectBlocks(container);
  });
});

describe('RegisterPage · lote (003)', () => {
  it('RF-13 (003) · 13.1: el formulario va en un solo lote angosto', async () => {
    const { container } = render(<RegisterPage token="tok" ops={ops()} />);
    await screen.findByLabelText('Correo');
    const lots = container.querySelectorAll('.lot');
    expect(lots).toHaveLength(1);
    expect(lots[0]!.classList.contains('lot--access')).toBe(true);
    expect(lots[0]!.contains(screen.getByRole('button', { name: 'Crear mi acceso' }))).toBe(true);
  });

  it('RF-13 (003) · 13.2: «Entrar» es un enlace de texto dentro del lote', async () => {
    const view = { state: 'pending' as const, email: 'ana@ejemplo.org', accountExists: true };
    const { container } = render(<RegisterPage token="tok" ops={ops({ inspect: vi.fn().mockResolvedValue(view) })} />);
    const link = await screen.findByRole('link', { name: 'Entrar' });
    expect(link.tagName).toBe('A');
    expect(link.matches('.block, .action-primary, .action-secondary, .action-destructive, .icon-button')).toBe(false);
    expect(container.querySelector('.lot')!.contains(link)).toBe(true);
  });
});

describe('RegisterPage · acceso a Auth', () => {
  it('RF-6 (017): inicia sesión con el servicio de autenticación del contexto, no con Firebase Auth directo', async () => {
    const o = ops();
    const user = userEvent.setup();
    render(<RegisterPage token="tok" ops={o} />);
    await screen.findByLabelText('Correo');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Crear mi acceso' }));
    await waitFor(() => expect(o.signIn).toHaveBeenCalledWith('ana@ejemplo.org', 'una-clave-larga'));
    expect('signIn' in realRegisterOps).toBe(false);
    const source = readFileSync(resolve(import.meta.dirname, 'RegisterPage.tsx'), 'utf8');
    expect(source).not.toMatch(/from 'firebase\/auth'/);
  });
});
