import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listed } from '../testing/listDoubles';
import { blockNesting, expectBlocks } from '../testing/expectBlocks';
import { ApiceLot } from './ApiceLot';

// jsdom no mide: el lote cree tener 480 px, es decir, 3 columnas de 160 px.
let width: PropertyDescriptor | undefined;
let measured = 480;
beforeEach(() => {
  measured = 480;
  width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => measured });
});
afterEach(() => {
  if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
});

const items = Array.from({ length: 5 }, (_, i) => listed(i + 1, { axes: i === 0 ? ['agua', 'energía'] : ['cobijo'] }));

describe('ApiceLot', () => {
  it('RF-3 (003) · 3.1, 3.3, RF-4 (019) · 4.4: el edificio va dentro del botón, que es el bloque, sin ser otro bloque sin sombra', () => {
    const { container } = render(<ApiceLot items={items} selectedId={null} onSelect={() => {}} />);
    expect(container.querySelectorAll('.apice-lot__building .building')).toHaveLength(items.length);
    expect(container.querySelectorAll('.apice-lot__building .block')).toHaveLength(0);
    expect(blockNesting(container)).toEqual([]);
  });

  it('RF-6 (005) · 6.1, 6.5, D-T19 (019): un botón por ápice, en el orden de la lista, con su nombre y su etapa y aria-pressed', () => {
    const { container } = render(<ApiceLot items={items} selectedId="a2" onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(items.map((apice) => `${apice.name}, Idea`));
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', 'false']);
    expectBlocks(container);
  });

  it('RF-6 (005) · 6.2, RF-8 (019) · 8.1, D-T5 (019), RNF-1 (005): la retícula sale del orden y del ancho, sin caminos ni nodos', () => {
    const { container } = render(<ApiceLot items={items} selectedId={null} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => `${button.style.gridRow}/${button.style.gridColumn}`)).toEqual([
      '1/1',
      '1/2',
      '1/3',
      '2/1',
      '2/2',
    ]);
    expect(container.querySelectorAll('svg.apice-lot__roads, [data-testid="node"], .apice-lot__node')).toHaveLength(0);
    // Cada edificio se nombra con su `aria-label`; los íconos del `Building` son sus hijos presentacionales.
    for (const button of buttons) expect(button.querySelectorAll('.building__axes svg.axis-icon').length).toBeGreaterThan(0);
  });

  it('RF-6 (005) · 6.4, RNF-4 (005), RF-4 (019) · 4.2: un prototipo muestra la imagen que la lista ya cargó, o el marcador, y los íconos de los ejes', () => {
    const withImage = [listed(1, { status: 'prototipo', image: { altText: 'Un tanque', png: new Uint8Array([1]) }, axes: ['agua', 'energía'] })];
    const { container, rerender } = render(<ApiceLot items={withImage} selectedId={null} onSelect={() => {}} />);
    const button = screen.getByRole('button', { name: 'Ápice 1, Prototipo' });
    // La misma imagen del documento, como URL de datos: sin descargas extra.
    expect(button.querySelector('img.pixel-image')!.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(button.querySelectorAll('.building__axes svg.axis-icon')).toHaveLength(2);
    rerender(<ApiceLot items={[listed(1, { status: 'prototipo' })]} selectedId={null} onSelect={() => {}} />);
    expect(container.querySelector('.pixel-image--empty')).not.toBeNull();
  });

  it('RF-5 (019), RF-4 (019) · 4.4, D-T19 (019): cada botón es un edificio compacto con la etapa en texto y el nombre debajo', () => {
    const many = [listed(1, { status: 'idea' }), listed(2, { status: 'prototipo' }), listed(3, { status: 'en marcha', name: 'Huerta comunal del barrio' })];
    render(<ApiceLot items={many} selectedId={null} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.querySelector('.building')!.getAttribute('data-stage'))).toEqual(['idea', 'prototipo', 'en marcha']);
    const third = buttons[2]!;
    expect(third.getAttribute('aria-label')).toBe('Huerta comunal del barrio, En marcha');
    expect(third.querySelector('.building__stage')!.textContent).toBe('En marcha');
    const name = third.querySelector('.apice-lot__name')!;
    expect(name.textContent).toBe('Huerta comunal del barrio');
    expect(third.querySelector('.building')!.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('RF-9 (019) · 9.1, D-T21 (019): el pin sale solo con necesidades con texto', () => {
    const mixed = [listed(1, { needs: 'Manos para el riego' }), listed(2, { needs: '   ' }), listed(3)];
    render(<ApiceLot items={mixed} selectedId={null} onSelect={() => {}} />);
    expect(screen.getAllByRole('button').map((button) => button.querySelector('.building__pin') !== null)).toEqual([true, false, false]);
  });

  it('RF-6 (005) · 6.6: elegir un edificio avisa con su id', () => {
    const onSelect = vi.fn();
    render(<ApiceLot items={items} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ápice 3, Idea' }));
    expect(onSelect).toHaveBeenCalledWith('a3');
  });

  it('RF-6 (005) · 6.7: las flechas llevan el foco al vecino de la retícula y se detienen en el borde', () => {
    render(<ApiceLot items={items} selectedId={null} onSelect={() => {}} />);
    const first = screen.getByRole('button', { name: 'Ápice 1, Idea' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 2, Idea' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 5, Idea' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 5, Idea' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 2, Idea' }));
  });

  it('RF-6 (005) · 6.8: con otra lista, redibuja', () => {
    const { rerender } = render(<ApiceLot items={items} selectedId={null} onSelect={() => {}} />);
    rerender(<ApiceLot items={items.slice(0, 2)} selectedId={null} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('RF-6 (005) · 6.9: con la lista vacía no hay lote', () => {
    const { container } = render(<ApiceLot items={[]} selectedId={null} onSelect={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('RF-8 (019) · 8.1, D-T5 (019): sin `layout`, el lote es la retícula a cualquier ancho, sin caminos ni zigzag', () => {
    measured = 600;
    const six = Array.from({ length: 6 }, (_, i) => listed(i + 1, { axes: ['agua'] }));
    const { container } = render(<ApiceLot items={six} selectedId={null} onSelect={() => {}} />);
    expect(container.querySelector('.apice-lot--trail')).toBeNull();
    expect(screen.getAllByRole('button').map((button) => button.style.gridColumn)).toEqual(['1', '2', '3', '1', '2', '3']);
    expect(container.querySelectorAll('svg, [data-testid="node"]').length).toBe(container.querySelectorAll('svg.axis-icon').length);
  });

  describe('en zigzag · RF-8 (019) · 8.3, D-T26 (019)', () => {
    const six = Array.from({ length: 6 }, (_, i) => listed(i + 1, { axes: ['agua'] }));

    it('RF-8 (019) · 8.3, RF-6 (005) · 6.10, D-T26 (019): con 560 px o más, los edificios siguen el recorrido, con caminos y nodos', () => {
      measured = 600;
      const { container } = render(<ApiceLot items={six} selectedId={null} onSelect={() => {}} layout="trail" />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.map((button) => `${button.style.left}/${button.style.top}`)).toEqual([
        '40%/46%',
        '18%/22%',
        '76%/20%',
        '82%/54%',
        '58%/76%',
        '18%/70%',
      ]);
      const lot = container.querySelector<HTMLElement>('.apice-lot')!;
      expect(lot.classList.contains('apice-lot--trail')).toBe(true);
      expect(lot.style.minHeight).toBe('560px');
      expect(container.querySelectorAll('svg.apice-lot__roads line').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('[data-testid="node"]')).toHaveLength(3);
      expectBlocks(container);
    });

    it('RF-8 (019) · 8.3, RF-5 (019), D-T26 (019): en el recorrido, cada botón es el edificio compacto con su nombre y su etapa', () => {
      measured = 600;
      const { container } = render(<ApiceLot items={six} selectedId={null} onSelect={() => {}} layout="trail" />);
      const first = screen.getByRole('button', { name: 'Ápice 1, Idea' });
      expect(first.querySelector('.building')).not.toBeNull();
      expect(first.querySelector('.apice-lot__name')?.textContent).toBe('Ápice 1');
      expect(container.querySelectorAll('.apice-lot__building .building')).toHaveLength(6);
    });

    it('RF-8 (019) · 8.1, 8.3, D-T26 (019): con menos de 560 px, la retícula sin caminos', () => {
      measured = 480;
      const { container } = render(<ApiceLot items={six} selectedId={null} onSelect={() => {}} layout="trail" />);
      expect(container.querySelector('.apice-lot--trail')).toBeNull();
      expect(container.querySelector('.apice-lot__roads')).toBeNull();
      expect(screen.getAllByRole('button')[0]!.style.gridColumn).toBe('1');
    });

    it('RF-8 (019) · 8.3, RF-6 (005) · 6.11, D-T26 (019): las flechas siguen el recorrido y el elegido conserva aria-pressed', () => {
      measured = 600;
      render(<ApiceLot items={six} selectedId="a2" onSelect={() => {}} layout="trail" />);
      expect(screen.getByRole('button', { name: 'Ápice 2, Idea' }).getAttribute('aria-pressed')).toBe('true');
      const first = screen.getByRole('button', { name: 'Ápice 1, Idea' });
      first.focus();
      fireEvent.keyDown(first, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 2, Idea' }));
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 1, Idea' }));
    });
  });
});
