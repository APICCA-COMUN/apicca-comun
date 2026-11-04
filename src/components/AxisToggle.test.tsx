import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AxisToggle } from './AxisToggle';

describe('AxisToggle', () => {
  it('RF-12 (019) · 12.2, D-T6 (019): solo ícono, con el nombre del eje como etiqueta y aria-pressed', async () => {
    const onToggle = vi.fn();
    const { container } = render(<AxisToggle axis="agua" pressed={true} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Agua' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('svg.axis-icon')).not.toBeNull();
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('RF-12 (019) · 12.2, D-T6 (019): con nombre visible, el texto del botón es el del eje', () => {
    const { container } = render(<AxisToggle axis="energía" pressed={false} onToggle={() => {}} showLabel />);
    const button = screen.getByRole('button', { name: 'Energía' });
    expect(button.textContent).toBe('Energía');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('svg.axis-icon')).not.toBeNull();
  });
});
