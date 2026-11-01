import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { AxisPicker } from './AxisPicker';

describe('AxisPicker', () => {
  it('RF-6 (001): ofrece los cinco ejes como casillas dentro de un grupo «Ejes»', () => {
    render(<AxisPicker value={[]} onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Ejes' });
    expect(group).toBeTruthy();
    for (const label of ['Agua', 'Alimento', 'Cobijo', 'Energía', 'Comunicación']) {
      expect((screen.getByRole('checkbox', { name: label }) as HTMLInputElement).checked).toBe(false);
    }
  });

  it('RF-6 (001): marca los ejes elegidos y avisa con la lista en el orden de los ejes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AxisPicker value={['energía']} onChange={onChange} />);
    expect((screen.getByRole('checkbox', { name: 'Energía' }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'Agua' }));
    expect(onChange).toHaveBeenCalledWith(['agua', 'energía']);
    await user.click(screen.getByRole('checkbox', { name: 'Energía' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('RF-6 (002) · 6.1: las casillas de ejes llevan la clase «choice»', () => {
    const { container } = render(<AxisPicker value={['agua']} onChange={() => {}} />);
    expectBlocks(container);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox.classList.contains('choice')).toBe(true);
    }
  });
});

describe('AxisPicker · identidad (002)', () => {
  it('RF-4 (002) · 4.2: cada eje muestra su ícono y su nombre dentro de la casilla', () => {
    const { container } = render(<AxisPicker value={[]} onChange={() => {}} />);
    for (const label of ['Agua', 'Alimento', 'Cobijo', 'Energía', 'Comunicación']) {
      const parent = screen.getByRole('checkbox', { name: label }).closest('label')!;
      expect(parent.textContent).toBe(label);
      expect(parent.querySelector('svg[class*="axis-icon--"]')).toBeTruthy();
    }
    expect(container.querySelectorAll('.axis-badge')).toHaveLength(5);
  });
});
