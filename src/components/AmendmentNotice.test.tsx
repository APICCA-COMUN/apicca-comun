// RF-15 (004) · 15.1: pruebas del aviso de propuestas abiertas para personas con cuenta activa.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { todayInColombia } from '../../shared/domain/dates';
import { SessionProvider, type SessionState } from '../app/session';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { AmendmentNotice } from './AmendmentNotice';

describe('AmendmentNotice', () => {
  const nextCloseMs = Date.parse('2026-10-24T12:00:00Z');
  const expectedDate = todayInColombia(new Date(nextCloseMs));

  const activeSession: SessionState = {
    status: 'person',
    uid: 'u1',
    role: 'member',
    username: 'ana',
  };

  it('RF-15 (004) · 15.1: no se renderiza con 0 propuestas abiertas', () => {
    const { container } = render(
      <SessionProvider initial={activeSession}>
        <AmendmentNotice openCount={0} nextClosesAt={nextCloseMs} />
      </SessionProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('RF-15 (004) · 15.1: muestra el aviso para 1 propuesta abierta con fecha más próxima y enlace', () => {
    const { container } = render(
      <SessionProvider initial={activeSession}>
        <AmendmentNotice openCount={1} nextClosesAt={nextCloseMs} />
      </SessionProvider>,
    );

    expect(container.textContent).toMatch(/1 propuesta abierta/i);
    expect(container.textContent).toContain(expectedDate);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/constitucion/propuestas');

    expectOnePrimary(container, null);
    expectBlocks(container);
  });

  it('RF-15 (004) · 15.1: muestra el aviso para 3 propuestas abiertas con fecha más próxima y enlace', () => {
    const { container } = render(
      <SessionProvider initial={activeSession}>
        <AmendmentNotice openCount={3} nextClosesAt={nextCloseMs} />
      </SessionProvider>,
    );

    expect(container.textContent).toMatch(/3 propuestas abiertas/i);
    expect(container.textContent).toContain(expectedDate);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/constitucion/propuestas');

    expectOnePrimary(container, null);
    expectBlocks(container);
  });

  it('RF-15 (004) · 15.1: no se renderiza sin cuenta activa (visitante o suspendida)', () => {
    // Visitante
    const { container: visitorContainer } = render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <AmendmentNotice openCount={3} nextClosesAt={nextCloseMs} />
      </SessionProvider>,
    );
    expect(visitorContainer.firstChild).toBeNull();

    // Suspendida
    const { container: suspendedContainer } = render(
      <SessionProvider initial={{ status: 'suspended', uid: 'u-sus' }}>
        <AmendmentNotice openCount={3} nextClosesAt={nextCloseMs} />
      </SessionProvider>,
    );
    expect(suspendedContainer.firstChild).toBeNull();

    // Con prop hasActiveAccount={false} explícita
    const { container: explicitFalseContainer } = render(
      <AmendmentNotice openCount={3} nextClosesAt={nextCloseMs} hasActiveAccount={false} />,
    );
    expect(explicitFalseContainer.firstChild).toBeNull();
  });
});
