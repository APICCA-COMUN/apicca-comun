// Pruebas de FacilitationShell (RF-7 (003) · 7.9, 7.4, RF-13 (019) · 13.1, 13.2, D-T7 (019), RF-18 (019) · 18.1, D-T12 (019)):
// RF-2 (024) · 2.1: sin el rol de facilitación, la página tiene un solo h1. RF-9 (024) · 9.1: sin sesión ofrece entrar.
// el menú interno marca su página vigente, el título es h1 y LinkBox muestra el enlace abreviado y copia el completo.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FACILITATION_MENU } from '../../shared/domain/navigation';
import { SessionProvider, type SessionState } from '../app/session';
import { AsFacilitator } from '../testing/facilitationDoubles';
import { FacilitationShell, LinkBox, shortenLink } from './FacilitationShell';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
});

function setup(path: string) {
  window.history.replaceState(null, '', path);
  render(
    <AsFacilitator>
      <FacilitationShell title="Cuentas">{() => <p>contenido</p>}</FacilitationShell>
    </AsFacilitator>,
  );
  return within(screen.getByRole('navigation', { name: 'Facilitación' }));
}

describe('FacilitationShell', () => {
  it('RF-7 (003) · 7.9: renderiza FACILITATION_MENU con sus href', () => {
    const nav = setup('/facilitacion/cuentas');
    expect(nav.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      FACILITATION_MENU.map((item) => [item.label, item.href]),
    );
  });

  it('RF-7 (003) · 7.9, 7.4: la página vigente lleva aria-current="page" y solo ella', () => {
    const nav = setup('/facilitacion/solicitudes');
    const current = nav.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Solicitudes']);
  });

  it('RF-18 (019) · 18.1, D-T12 (019): el título de la página es h1', () => {
    setup('/facilitacion/cuentas');
    expect(screen.getByRole('heading', { level: 1, name: 'Cuentas' })).toBeTruthy();
  });
});

describe('LinkBox · RF-13 (019) · 13.2, D-T7 (019)', () => {
  it('RF-13 (019) · 13.2: muestra el enlace abreviado sin el origen', () => {
    render(<LinkBox path="/registro/abc123" />);
    const code = document.querySelector('.link-box code')!;
    expect(code.textContent).toBe('/registro/abc123');
    expect(code.textContent).not.toContain(window.location.origin);
  });

  it('RF-13 (019) · 13.2: abrevia con «…» tokens de más de 12 caracteres', () => {
    expect(shortenLink('/registro/abcdef1234567890')).toBe('/registro/…567890');
    expect(shortenLink('/registro/corto')).toBe('/registro/corto');
  });

  it('RF-13 (019) · 13.2: copia el enlace completo y muestra «Enlace copiado.» en role="status"', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const clipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    try {
      render(<LinkBox path="/registro/tok-123" />);
      const copy = screen.getByRole('button', { name: 'Copiar enlace' });
      await user.click(copy);
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/registro/tok-123`);
      const status = screen.getByRole('status');
      expect(status.textContent?.trim()).toBe('Enlace copiado.');
      // RNF-1 (019): al copiar otra vez se monta un aviso nuevo, para que el lector lo anuncie de nuevo.
      await user.click(copy);
      const again = screen.getByRole('status');
      expect(again).not.toBe(status);
      expect(again.textContent?.trim()).toBe('Enlace copiado.');
    } finally {
      if (clipboard !== undefined) Object.defineProperty(Navigator.prototype, 'clipboard', clipboard);
    }
  });

  it('RF-13 (019) · 13.2: si clipboard falla, role="status" dice cómo copiar a mano y el enlace completo queda seleccionable', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('Permiso denegado'));
    const clipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    try {
      render(<LinkBox path="/registro/tok-error" />);
      const copy = screen.getByRole('button', { name: 'Copiar enlace' });
      await user.click(copy);
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('Copia el enlace a mano');
      const input = screen.getByRole('textbox', { name: 'Enlace completo de la invitación' }) as HTMLInputElement;
      expect(input.value).toBe(`${window.location.origin}/registro/tok-error`);
      expect(input.readOnly).toBe(true);
    } finally {
      if (clipboard !== undefined) Object.defineProperty(Navigator.prototype, 'clipboard', clipboard);
    }
  });
});

describe('FacilitationShell sin permiso · RF-2 (024), RF-9 (024)', () => {
  const NO_ROLE: Array<[string, SessionState]> = [
    ['visitante', { status: 'visitor' }],
    ['cuenta sin el rol', { status: 'person', uid: 'u1', role: 'member', username: 'ana' }],
    ['cuenta suspendida', { status: 'suspended', uid: 'u2' }],
  ];

  function setupWith(session: SessionState) {
    window.history.replaceState(null, '', '/facilitacion/cuentas');
    render(
      <SessionProvider initial={session}>
        <FacilitationShell title="Cuentas">{() => <p>contenido</p>}</FacilitationShell>
      </SessionProvider>,
    );
  }

  it.each(NO_ROLE)('RF-2 (024) · 2.1: %s ve un solo h1 con el título de la página y no el contenido', (_name, session) => {
    setupWith(session);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Cuentas' })).toBeTruthy();
    expect(screen.queryByText('contenido')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Facilitación' })).toBeNull();
    expect(screen.getByText(/Esta página es solo para quienes facilitan\./)).toBeTruthy();
  });

  it('RF-9 (024) · 9.1: sin sesión invita a entrar y ofrece «Entrar»', () => {
    setupWith({ status: 'visitor' });
    expect(screen.getByText('Esta página es solo para quienes facilitan. Entra con tu cuenta para verla.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/entrar');
  });

  it('RF-9 (024) · 9.2: «Entrar» guarda la ruta de Facilitación al hacer clic, y no antes', async () => {
    setupWith({ status: 'visitor' });
    expect(window.sessionStorage.getItem('apicca:returnTo')).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Entrar' }));
    expect(window.location.pathname).toBe('/entrar');
    expect(window.sessionStorage.getItem('apicca:returnTo')).toBe('/facilitacion/cuentas');
  });

  it.each(NO_ROLE.slice(1))('RF-9 (024) · 9.1: %s no ve «Entrar»', (_name, session) => {
    setupWith(session);
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });
});
