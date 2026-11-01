import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listed } from '../testing/listDoubles';
import { expectBlocks } from '../testing/expectBlocks';
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
  it('RF-6 (005) · 6.1, 6.5: un botón por ápice, en el orden de la lista, con su nombre y aria-pressed', () => {
    const { container } = render(<ApiceLot items={items} selectedId="a2" onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(items.map((apice) => apice.name));
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', 'false']);
    expectBlocks(container);
  });

  it('RF-6 (005) · 6.2, 6.3, RNF-1 (005): la retícula sale del orden y del ancho, con caminos y nodos decorativos', () => {
    const { container } = render(<ApiceLot items={items} selectedId={null} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => `${button.style.gridRow}/${button.style.gridColumn}`)).toEqual([
      '1/1',
      '1/2',
      '1/3',
      '2/1',
      '2/2',
    ]);
    const roads = container.querySelector('svg.apice-lot__roads')!;
    expect(roads.getAttribute('aria-hidden')).toBe('true');
    // Una calle entre las dos filas y dos entre las tres columnas; un nodo en cada uno de los dos cruces.
    expect(roads.querySelectorAll('line')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="node"]')).toHaveLength(2);
    for (const node of container.querySelectorAll('[data-testid="node"]')) expect(node.getAttribute('aria-hidden')).toBe('true');
    // Cada edificio se nombra solo con el nombre del ápice; lo demás es decorativo.
    for (const button of buttons) expect(button.querySelector('svg.axis-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('RF-6 (005) · 6.4, RNF-4 (005): la imagen que la lista ya cargó, o el marcador, y los íconos de los ejes debajo', () => {
    const withImage = [listed(1, { image: { altText: 'Un tanque', png: new Uint8Array([1]) }, axes: ['agua', 'energía'] })];
    const { container, rerender } = render(<ApiceLot items={withImage} selectedId={null} onSelect={() => {}} />);
    const button = screen.getByRole('button', { name: 'Ápice 1' });
    // La misma imagen del documento, como URL de datos: sin descargas extra.
    expect(button.querySelector('img.pixel-image')!.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    const icons = button.querySelectorAll('.apice-lot__axes svg.axis-icon');
    expect(icons).toHaveLength(2);
    expect(button.querySelector('.pixel-image')!.compareDocumentPosition(icons[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    rerender(<ApiceLot items={[listed(1)]} selectedId={null} onSelect={() => {}} />);
    expect(container.querySelector('.pixel-image--empty')).not.toBeNull();
  });

  it('RF-6 (005) · 6.6: elegir un edificio avisa con su id', () => {
    const onSelect = vi.fn();
    render(<ApiceLot items={items} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ápice 3' }));
    expect(onSelect).toHaveBeenCalledWith('a3');
  });

  it('RF-6 (005) · 6.7: las flechas llevan el foco al vecino de la retícula y se detienen en el borde', () => {
    render(<ApiceLot items={items} selectedId={null} onSelect={() => {}} />);
    const first = screen.getByRole('button', { name: 'Ápice 1' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 2' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 5' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 5' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 2' }));
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

  describe('en zigzag', () => {
    const six = Array.from({ length: 6 }, (_, i) => listed(i + 1, { axes: ['agua'] }));

    it('RF-6 (005) · 6.10: con 560 px o más, los edificios van en porcentaje, con el alto mínimo del recorrido', () => {
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

    it('RF-6 (005) · 6.10: con menos de 560 px conserva la retícula', () => {
      measured = 480;
      const { container } = render(<ApiceLot items={six} selectedId={null} onSelect={() => {}} layout="trail" />);
      expect(container.querySelector('.apice-lot--trail')).toBeNull();
      expect(screen.getAllByRole('button')[0]!.style.gridColumn).toBe('1');
    });

    it('RF-6 (005) · 6.11: las flechas siguen el recorrido y el elegido conserva aria-pressed', () => {
      measured = 600;
      render(<ApiceLot items={six} selectedId="a2" onSelect={() => {}} layout="trail" />);
      expect(screen.getByRole('button', { name: 'Ápice 2' }).getAttribute('aria-pressed')).toBe('true');
      const first = screen.getByRole('button', { name: 'Ápice 1' });
      first.focus();
      fireEvent.keyDown(first, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 2' }));
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ápice 1' }));
    });
  });
});
