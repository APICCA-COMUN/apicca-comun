// T-45 (021) · RF-23 (021), RF-26 (021) · 26.2, D-T39 (021): el panel del boceto del visitante.
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_SKETCH, type Sketch } from '../app/sketch';
import { SketchPanel } from './SketchPanel';

function Harness({ initial = EMPTY_SKETCH, spy }: { initial?: Sketch; spy?: (sketch: Sketch) => void }) {
  const [sketch, setSketch] = useState(initial);
  return (
    <SketchPanel
      sketch={sketch}
      onChange={(next) => {
        spy?.(next);
        setSketch(next);
      }}
    />
  );
}

describe('SketchPanel', () => {
  it('RF-23 (021) · 23.3: antes de los controles dice que el boceto no se guarda ni lo ven otras personas', () => {
    const { container } = render(<Harness />);
    const notice = screen.getByText(/no se guarda ni lo ven otras personas/);
    const picker = container.querySelector('fieldset')!;
    expect(notice.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-23 (021) · 23.1: elegir ejes y etapa cambia el boceto y muestra el edificio', () => {
    const spy = vi.fn();
    const { container } = render(<Harness spy={spy} />);
    expect(container.querySelector('.building')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Agua' }));
    expect(spy).toHaveBeenLastCalledWith({ axes: ['agua'], status: 'idea' });
    fireEvent.change(screen.getByLabelText('Etapa'), { target: { value: 'prototipo' } });
    expect(spy).toHaveBeenLastCalledWith({ axes: ['agua'], status: 'prototipo' });
    expect(container.querySelector('.building')).not.toBeNull();
  });

  it('RF-23 (021) · 23.5: su única acción es unirse', () => {
    render(<Harness initial={{ axes: ['agua'], status: 'idea' }} />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([['Unirme para construirlo', '/solicitar']]);
    expect(screen.queryByRole('button', { name: /guardar|proponer|construir/i })).toBeNull();
  });
});
