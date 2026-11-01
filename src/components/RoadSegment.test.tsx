// RF-9 (003) · 9.3, 9.4, D-T9 (003): el camino es decorativo, sin texto ni foco, y quitarlo no cambia el texto.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoadSegment } from './RoadSegment';

describe('RoadSegment (003)', () => {
  it('RF-9 (003) · 9.3: está oculto a los lectores de pantalla y no entra en el árbol de accesibilidad', () => {
    const { container, queryAllByRole } = render(<RoadSegment />);
    const road = container.querySelector('.road-segment')!;
    expect(road.getAttribute('aria-hidden')).toBe('true');
    expect(queryAllByRole('img')).toHaveLength(0);
  });

  it('RF-9 (003) · 9.3: no lleva texto ni elementos enfocables', () => {
    const { container } = render(<RoadSegment />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('[tabindex], a, button, input, [focusable="true"]')).toBeNull();
    expect(container.querySelector('svg')!.getAttribute('focusable')).toBe('false');
  });

  it('RF-9 (003) · 9.4: quitarlo de un fragmento deja el mismo textContent', () => {
    const withRoad = render(
      <ol>
        <li>Primero</li>
        <RoadSegment />
        <li>Segundo</li>
      </ol>,
    );
    const withoutRoad = render(
      <ol>
        <li>Primero</li>
        <li>Segundo</li>
      </ol>,
    );
    expect(withRoad.container.textContent).toBe(withoutRoad.container.textContent);
  });

  it('RF-9 (003) · 9.1: ofrece las variantes de color y de orientación sin cambiar el valor por defecto', () => {
    const base = render(<RoadSegment />).container.querySelector('.road-segment')!;
    expect(base.classList.contains('road-segment--on-surface')).toBe(false);
    expect(base.classList.contains('road-segment--vertical')).toBe(false);
    const variant = render(<RoadSegment tone="on-surface" orientation="vertical" />).container.querySelector('.road-segment')!;
    expect(variant.classList.contains('road-segment--on-surface')).toBe(true);
    expect(variant.classList.contains('road-segment--vertical')).toBe(true);
    expect(variant.getAttribute('aria-hidden')).toBe('true');
  });
});
