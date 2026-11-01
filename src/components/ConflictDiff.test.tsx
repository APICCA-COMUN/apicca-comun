import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EditableFields } from '../../shared/domain/versions';
import { ConflictDiff } from './ConflictDiff';
import { blockProblems, expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';

const current: EditableFields = { name: 'Huerta', description: 'Vigente', axes: ['agua'], needs: '', offers: '', status: 'idea' };
const mine: EditableFields = { ...current, description: 'Mía', axes: ['agua', 'energía'], status: 'prototipo' };

describe('ConflictDiff', () => {
  it('RF-11 (001): explica el conflicto y muestra campo por campo lo vigente y lo propio', () => {
    render(<ConflictDiff mine={mine} current={current} onKeepMine={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/alguien más guardó cambios/i);
    const description = screen.getByRole('group', { name: 'Descripción' });
    expect(description.textContent).toContain('Vigente');
    expect(description.textContent).toContain('Mía');
    expect(screen.getByRole('group', { name: 'Ejes' }).textContent).toMatch(/Agregas.*Energía/);
    expect(screen.getByRole('group', { name: 'Estado' }).textContent).toMatch(/idea.*prototipo/);
    expect(screen.queryByRole('group', { name: 'Nombre' })).toBeNull();
  });

  it('RF-11 (001): «Conservar los míos» y «Descartar» llaman a su acción', async () => {
    const onKeepMine = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(<ConflictDiff mine={mine} current={current} onKeepMine={onKeepMine} onDiscard={onDiscard} />);
    await user.click(screen.getByRole('button', { name: 'Conservar los míos' }));
    expect(onKeepMine).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('RF-11 (001): si ya no hay diferencias lo dice', () => {
    render(<ConflictDiff mine={current} current={current} onKeepMine={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('Tus cambios coinciden con lo guardado.')).toBeTruthy();
  });

  it('RF-11 (001): un texto con marcas se muestra como texto plano', () => {
    render(<ConflictDiff mine={{ ...mine, description: '<i>x</i>' }} current={current} onKeepMine={vi.fn()} onDiscard={vi.fn()} />);
    expect(document.querySelector('i')).toBeNull();
    expect(screen.getByText('<i>x</i>')).toBeTruthy();
  });
});

/** Estilos en línea con un tamaño escrito a mano (RF-2 (002) · 2.1, D-T20 (002)). */
const fixedSizes = (container: ParentNode): string[] =>
  [...container.querySelectorAll<HTMLElement>('[style]')]
    .filter((el) =>
      ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'font-size', 'padding', 'margin', 'top', 'left'].some(
        (property) => el.style.getPropertyValue(property) !== '',
      ),
    )
    .map((el) => el.outerHTML.slice(0, 80));

describe('ConflictDiff · bloques (002)', () => {
  it('RF-4 (003) · 4.2: el aviso y los botones son bloques; «Conservar los míos» es la única azul y «Descartar» secundaria', () => {
    const { container } = render(<ConflictDiff mine={mine} current={current} onKeepMine={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Conservar los míos' }).classList.contains('action-primary')).toBe(true);
    expect(screen.getByRole('button', { name: 'Descartar' }).classList.contains('action-secondary')).toBe(true);
    expectOnePrimary(container, 'Conservar los míos');
    expectBlocks(container);
  });

  it('RF-3 (003) · 3.3: no contiene bloques anidados', () => {
    const { container } = render(<ConflictDiff mine={mine} current={current} onKeepMine={vi.fn()} onDiscard={vi.fn()} />);
    expectBlocks(container, { nesting: true });
  });

  it('RF-2 (002) · 2.1: sin estilos en línea con color ni con tamaño, y la diferencia sigue siendo texto', () => {
    const { container } = render(<ConflictDiff mine={mine} current={current} onKeepMine={vi.fn()} onDiscard={vi.fn()} />);
    expect(blockProblems(container).filter((p) => p.startsWith('color'))).toEqual([]);
    expect(fixedSizes(container)).toEqual([]);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(screen.getByRole('group', { name: 'Descripción' }).textContent).toMatch(/Vigente: Vigente.*Tuyo: Mía/);
  });
});
