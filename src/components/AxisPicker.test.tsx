import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { AxisPicker } from './AxisPicker';

const LABELS = ['Agua', 'Alimento', 'Cobijo', 'Energía', 'Comunicación'];

describe('AxisPicker', () => {
  it('RF-12 (019) · 12.2, D-T6 (019): ofrece los cinco ejes como botones con aria-pressed dentro de un grupo «Ejes», sin casillas', () => {
    const { container } = render(<AxisPicker value={[]} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Ejes' })).toBeTruthy();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(LABELS);
    for (const button of buttons) expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('RF-12 (019) · 12.2: marca los ejes elegidos y avisa con la lista en el orden de los ejes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AxisPicker value={['energía']} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Energía' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Agua' }));
    expect(onChange).toHaveBeenCalledWith(['agua', 'energía']);
    await user.click(screen.getByRole('button', { name: 'Energía' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('RF-12 (019) · 12.2; RF-6 (002) · 6.1: los botones de eje son bloques', () => {
    const { container } = render(<AxisPicker value={['agua']} onChange={() => {}} />);
    expectBlocks(container);
  });

  it('RF-12 (019) · 12.2; RF-4 (002) · 4.2: cada eje muestra su ícono y su nombre dentro del botón', () => {
    render(<AxisPicker value={[]} onChange={() => {}} />);
    for (const label of LABELS) {
      const button = screen.getByRole('button', { name: label });
      expect(button.textContent).toBe(label);
      expect(button.querySelector('svg[class*="axis-icon--"]')).toBeTruthy();
    }
  });

  it('RF-12 (019) · 12.2: conserva aria-describedby del grupo', () => {
    render(<AxisPicker value={[]} onChange={() => {}} describedBy="error-ejes" />);
    expect(screen.getByRole('group', { name: 'Ejes' }).getAttribute('aria-describedby')).toBe('error-ejes');
  });
});
