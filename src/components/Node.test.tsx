// RF-9 (003) · 9.3, 9.4, D-T9 (003): el nodo es decorativo, sin texto ni foco, y quitarlo no cambia el texto.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Node } from './Node';

describe('Node (003)', () => {
  it('RF-9 (003) · 9.3: está oculto a los lectores de pantalla', () => {
    const { container } = render(<Node />);
    expect(container.querySelector('.node')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('RF-9 (003) · 9.3: no lleva texto ni elementos enfocables', () => {
    const { container } = render(<Node />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('[tabindex], a, button, input')).toBeNull();
  });

  it('RF-9 (003) · 9.4: quitarlo de un fragmento deja el mismo textContent', () => {
    const withNode = render(
      <ol>
        <li>
          <Node />
          Primero
        </li>
        <li>
          <Node />
          Segundo
        </li>
      </ol>,
    );
    const withoutNode = render(
      <ol>
        <li>Primero</li>
        <li>Segundo</li>
      </ol>,
    );
    expect(withWithout(withNode)).toBe(withWithout(withoutNode));
  });
});

function withWithout(view: { container: HTMLElement }) {
  return view.container.textContent;
}
