import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NO_FILTERS, type ListFilters } from '../../shared/domain/discovery';
import { expectBlocks } from '../testing/expectBlocks';
import { Filters } from './Filters';

function setup(filters: ListFilters = NO_FILTERS) {
  const onChange = vi.fn();
  render(<Filters filters={filters} onChange={onChange} />);
  return onChange;
}

describe('Filters', () => {
  it('RF-21 (001): elegir un eje lo agrega a los filtros', async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Agua' }));
    expect(onChange).toHaveBeenCalledWith({ axes: ['agua'], status: null });
  });

  it('RF-21 (001): se pueden elegir varios ejes y desmarcar uno', async () => {
    const onChange = setup({ axes: ['agua'], status: null });
    await userEvent.click(screen.getByRole('button', { name: 'Energía' }));
    expect(onChange).toHaveBeenLastCalledWith({ axes: ['agua', 'energía'], status: null });
    await userEvent.click(screen.getByRole('button', { name: 'Agua' }));
    expect(onChange).toHaveBeenLastCalledWith({ axes: [], status: null });
  });

  it('RF-21 (001): elegir un estado lo aplica y «Todos» lo quita', async () => {
    const onChange = setup({ axes: [], status: 'idea' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'prototipo');
    expect(onChange).toHaveBeenLastCalledWith({ axes: [], status: 'prototipo' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), '');
    expect(onChange).toHaveBeenLastCalledWith({ axes: [], status: null });
  });

  it('RF-21 (001): combinar filtros conserva los dos', async () => {
    const onChange = setup({ axes: ['agua'], status: null });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'en marcha');
    expect(onChange).toHaveBeenLastCalledWith({ axes: ['agua'], status: 'en marcha' });
  });

  it('RF-21 (001): «Quitar filtros» solo aparece con filtros y los limpia', async () => {
    const sin = setup();
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
    expect(sin).not.toHaveBeenCalled();
  });

  it('RF-21 (001): con filtros activos «Quitar filtros» los limpia', async () => {
    const onChange = setup({ axes: ['agua'], status: 'idea' });
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(onChange).toHaveBeenCalledWith(NO_FILTERS);
  });

  it('RF-12 (003) · 12.3, RF-6 (002) · 6.1, 6.3, D-T18 (003): filtros de eje como botones de ícono con «icon-button» y «block», select como bloque y «Quitar filtros» como acción secundaria', () => {
    const { container } = render(<Filters filters={{ axes: ['agua'], status: 'idea' }} onChange={() => {}} />);
    expectBlocks(container);
    const axisButtons = container.querySelectorAll('fieldset button');
    expect(axisButtons).toHaveLength(5);
    for (const button of axisButtons) {
      expect(button.classList.contains('icon-button')).toBe(true);
      expect(button.classList.contains('block')).toBe(true);
      expect(button.getAttribute('type')).toBe('button');
    }
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('combobox').className).toBe('block');
    expect(screen.getByRole('button', { name: 'Quitar filtros' }).className).toBe('block action-secondary');
  });
});


describe('Filters · botones con aria-pressed (003)', () => {
  it('RF-12 (003) · 12.3, D-23 (003): cada eje es un botón con aria-pressed según filters.axes', () => {
    setup({ axes: ['agua', 'energía'], status: null });
    const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Agua')).toBe('true');
    expect(pressed('Energía')).toBe('true');
    expect(pressed('Alimento')).toBe('false');
    expect(pressed('Cobijo')).toBe('false');
    expect(pressed('Comunicación')).toBe('false');
  });

  it('RF-12 (003) · 12.3, D-T18 (003): se conservan el fieldset y la leyenda «Ejes»', () => {
    const { container } = render(<Filters filters={NO_FILTERS} onChange={() => {}} />);
    expect(container.querySelector('fieldset legend')?.textContent).toBe('Ejes');
  });
});

describe('Filters · identidad (002)', () => {
  it('RF-4 (002) · 4.2: cada eje muestra su ícono y su nombre dentro del botón', () => {
    const { container } = render(<Filters filters={NO_FILTERS} onChange={() => {}} />);
    for (const [label, key] of [['Agua', 'agua'], ['Alimento', 'alimento'], ['Cobijo', 'cobijo'], ['Energía', 'energia'], ['Comunicación', 'comunicacion']] as const) {
      const parent = screen.getByRole('button', { name: label });
      expect(parent.querySelector('svg[class*="axis-icon--"]')).toBeTruthy();
      expect(parent.querySelector(`.axis-icon--${key}`)).toBeTruthy();
    }
    expect(container.querySelectorAll('fieldset .axis-icon')).toHaveLength(5);
  });
});
