import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { AXIS_ICONS, axisIdentity } from '../../shared/domain/identity';
import { AXIS_LABEL, AxisBadge, AxisIcon } from './AxisIcon';

describe('AxisIcon y AxisBadge', () => {
  it.each(AXES)('RF-4 (002) · 4.2, 4.5: el ícono de %s, solo, lleva el nombre del eje como nombre accesible', (axis) => {
    render(<AxisIcon axis={axis} labelled />);
    const icon = screen.getByRole('img', { name: AXIS_LABEL[axis] });
    expect(icon.querySelector('path')!.getAttribute('d')).toBe(AXIS_ICONS[axisIdentity(axis).key].d);
    expect(icon.classList.contains(`axis-icon--${axisIdentity(axis).key}`)).toBe(true);
  });

  it.each(AXES)('RF-4 (002) · 4.2, 4.5: la insignia de %s muestra el ícono decorativo y el nombre al lado', (axis) => {
    const { container } = render(<AxisBadge axis={axis} />);
    const badge = container.querySelector('.axis-badge')!;
    expect(badge.textContent).toBe(AXIS_LABEL[axis]);
    const svg = badge.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('RF-4 (002) · 4.5: cada eje tiene su propia forma, no solo su color', () => {
    const { container } = render(
      <>
        {AXES.map((axis) => (
          <AxisIcon key={axis} axis={axis} />
        ))}
      </>,
    );
    const shapes = [...container.querySelectorAll('path')].map((path) => path.getAttribute('d'));
    expect(new Set(shapes).size).toBe(AXES.length);
  });
});
