// RF-9 (004) · 9.4: pruebas del aviso de deliberación para personas sin cuenta activa.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { JoinNotice } from './JoinNotice';

describe('JoinNotice', () => {
  it('RF-9 (004) · 9.4: muestra que la deliberación es de personas inscritas con enlaces a entrar y registro, sin botón azul', () => {
    const { container } = render(<JoinNotice />);

    // 1. Mensaje con el texto exigido
    expect(container.textContent).toMatch(/la deliberación es de las personas inscritas/i);

    // 2. Enlace para entrar
    const loginLink = screen.getByRole('link', { name: /entrar|inicia/i });
    expect(loginLink.getAttribute('href')).toBe('/entrar');

    // 3. Enlace a la información de registro o solicitud de inscripción
    const registerLinks = screen.getAllByRole('link');
    const hasRegisterRoute = registerLinks.some((link) => {
      const href = link.getAttribute('href');
      return href === '/registro' || href === '/solicitar';
    });
    expect(hasRegisterRoute).toBe(true);

    // 4. Sin ningún botón azul (.action-primary)
    expectOnePrimary(container, null);

    // 5. Estilo con bloque .block
    expect(container.querySelector('.block')).not.toBeNull();
    expectBlocks(container);
  });
});
