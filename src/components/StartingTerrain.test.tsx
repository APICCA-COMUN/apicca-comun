import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { expectBlocks } from '../testing/expectBlocks';
import { StartingTerrain } from './StartingTerrain';

const props = { phrase: 'Aún no hay ápices en el terreno.', action: { label: 'Propón el primer ápice', href: '/apices/nuevo' } };

describe('StartingTerrain', () => {
  it('RF-19 (019) · 19.1, D-T22 (019): es una sección «Terreno de partida» con cinco bases, una por eje en orden canónico', () => {
    const { container } = render(<StartingTerrain {...props} />);
    const section = screen.getByRole('region', { name: 'Terreno de partida' });
    expect(section.classList.contains('starting-terrain')).toBe(true);
    const bases = container.querySelectorAll('.starting-terrain__base');
    expect(bases.length).toBe(5);
    AXES.forEach((axis, i) => {
      expect(within(bases[i] as HTMLElement).getByRole('img', { name: axis[0]!.toUpperCase() + axis.slice(1) })).toBeTruthy();
    });
  });

  it('RF-19 (019) · 19.3, D-T22 (019): dice la frase una sola vez', () => {
    render(<StartingTerrain {...props} />);
    expect(screen.getAllByText('Aún no hay ápices en el terreno.').length).toBe(1);
  });

  it('RF-19 (019) · 19.2, D-T22 (019): la acción es un único enlace primario con su texto y destino', () => {
    render(<StartingTerrain phrase="Todavía no tienes ápices en el terreno." action={{ label: 'Pide tu inscripción', href: '/solicitar' }} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(1);
    expect(links[0]!.textContent).toBe('Pide tu inscripción');
    expect(links[0]!.getAttribute('href')).toBe('/solicitar');
    expect(links[0]!.className).toBe('block action-primary');
  });

  it('RF-19 (019) · 19.5, RF-3 (003) · 3.3: sin bloques anidados ni controles que no sean la acción', () => {
    const { container } = render(<StartingTerrain {...props} />);
    expectBlocks(container, { nesting: true });
    expect(screen.queryAllByRole('button').length).toBe(0);
  });
});
