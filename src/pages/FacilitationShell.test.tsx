// Pruebas de FacilitationShell (RF-7 (003) · 7.9, 7.4): el menú interno marca su página vigente.
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FACILITATION_MENU } from '../../shared/domain/navigation';
import { AsFacilitator } from '../testing/facilitationDoubles';
import { FacilitationShell } from './FacilitationShell';

afterEach(() => window.history.replaceState(null, '', '/'));

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
});
