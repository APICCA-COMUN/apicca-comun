import { render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildingVariant } from '../../shared/domain/identity';
import { Building } from './Building';

/** Simula el ancho disponible del contenedor del edificio. */
function withWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const drawing = (container: HTMLElement) => container.querySelector('svg.building__drawing') as SVGSVGElement;
const motifs = (container: HTMLElement) => within(container.querySelector('.building') as HTMLElement).getAllByRole('img');

describe('Building', () => {
  it('RF-1 (021) · 1.1, 1.2, RF-2 (021) · 2.1: dibuja el edificio con formas en un SVG, sin imagen ni marcador de imagen', () => {
    const { container } = render(<Building axes={['agua']} stage="en marcha" seed="a1" max={2} />);
    expect(drawing(container).getAttribute('viewBox')).toBe('0 0 64 64');
    expect(container.querySelector('img, .pixel-image')).toBeNull();
    expect(container.textContent).not.toContain('Sin imagen');
    // Ya no es un bloque `charcoal`: ese fondo existía para la imagen (D-T4 (021)).
    expect(container.querySelector('.building')!.classList.contains('block')).toBe(false);
  });

  it('RF-2 (021) · 2.2: lleva el color del primer eje en el orden canónico', () => {
    const { container } = render(<Building axes={['comunicación', 'cobijo', 'energía', 'alimento', 'agua']} stage="idea" seed="a1" max={2} />);
    expect(container.querySelector('.building')!.classList.contains('building--axis-agua')).toBe(true);
  });

  it('RF-2 (021) · 2.3, 2.6: un motivo por eje, en el orden canónico, cada uno con el nombre del eje como texto', () => {
    for (const stage of ['idea', 'prototipo', 'en marcha'] as const) {
      const { container, unmount } = render(<Building axes={['comunicación', 'agua', 'energía']} stage={stage} seed="a1" max={2} />);
      expect(motifs(container).map((motif) => motif.getAttribute('aria-label'))).toEqual(['Agua', 'Energía', 'Comunicación']);
      // El motivo es la forma del ícono del eje, no solo un color.
      for (const motif of motifs(container)) expect(motif.querySelector('path')).not.toBeNull();
      unmount();
    }
  });

  it('RF-2 (021) · 2.4, 2.5: el dibujo sale de la semilla: la misma da el mismo edificio y la variante es la del dominio', () => {
    const first = render(<Building axes={['agua']} stage="en marcha" seed="Qx7ZpLm2" max={2} />);
    const second = render(<Building axes={['agua']} stage="en marcha" seed="Qx7ZpLm2" max={2} />);
    expect(drawing(first.container).innerHTML).toBe(drawing(second.container).innerHTML);
    expect(first.container.querySelector('.building')!.getAttribute('data-variant')).toBe(String(buildingVariant('Qx7ZpLm2')));
  });

  it('RF-7 (002) · 7.2, D-T4 (021): el lado es 64·n, con n según el ancho disponible y el máximo', () => {
    withWidth(300);
    const { container, unmount } = render(<Building axes={['agua']} stage="prototipo" max={4} />);
    expect([drawing(container).getAttribute('width'), drawing(container).getAttribute('height')]).toEqual(['256', '256']);
    unmount();
    const capped = render(<Building axes={['agua']} stage="prototipo" max={2} />);
    expect(drawing(capped.container).getAttribute('width')).toBe('128');
  });

  it('RF-7 (002) · 7.2: sin ancho medido el edificio usa n = 1, 64 px', () => {
    withWidth(0);
    const { container } = render(<Building axes={['agua']} stage="idea" max={4} />);
    expect(drawing(container).getAttribute('width')).toBe('64');
  });

  it('RF-3 (021) · 3.1, RF-4 (019) · 4.1, 4.4: una idea es solo la base y dice «Idea»', () => {
    const { container } = render(<Building axes={['energía', 'agua']} stage="idea" seed="a1" max={2} />);
    expect(container.querySelector('.building')!.getAttribute('data-stage')).toBe('idea');
    expect(container.querySelector('.building__base')).not.toBeNull();
    expect(container.querySelector('.building__body, .building__roof')).toBeNull();
    expect(container.querySelector('.building__stage')!.textContent).toBe('Idea');
  });

  it('RF-3 (021) · 3.2, RF-4 (019) · 4.4: un prototipo suma el cuerpo, con vanos, y dice «Prototipo»', () => {
    const { container } = render(<Building axes={['agua']} stage="prototipo" seed="a1" max={2} />);
    expect(container.querySelector('.building__base')).not.toBeNull();
    expect(container.querySelector('.building__body')).not.toBeNull();
    expect(container.querySelectorAll('.building__body .building__window').length).toBeGreaterThan(0);
    expect(container.querySelector('.building__roof')).toBeNull();
    expect(container.querySelector('.building__stage')!.textContent).toBe('Prototipo');
  });

  it('RF-3 (021) · 3.3, RF-4 (019) · 4.4: en marcha suma el techo con los motivos de sus ejes y dice «En marcha»', () => {
    const { container } = render(<Building axes={['agua', 'cobijo']} stage="en marcha" seed="a1" max={2} />);
    const roof = container.querySelector('.building__roof')!;
    expect(roof).not.toBeNull();
    expect(container.querySelector('.building__body')).not.toBeNull();
    // Los motivos se pintan después del techo: van sobre él.
    for (const motif of motifs(container)) {
      expect(roof.compareDocumentPosition(motif) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(motifs(container)).toHaveLength(2);
    expect(container.querySelector('.building__stage')!.textContent).toBe('En marcha');
  });

  it('RF-3 (021) · 3.5, RF-9 (019) · 9.1, 9.3, D-T21 (019): el pin solo aparece con necesidades, es decorativo y no lleva texto', () => {
    const { container, rerender } = render(<Building axes={['agua']} stage="idea" max={2} />);
    expect(container.querySelector('.building__pin')).toBeNull();
    rerender(<Building axes={['agua']} stage="idea" needs max={2} />);
    const pin = container.querySelector('.building__pin')!;
    expect(pin.getAttribute('aria-hidden')).toBe('true');
    expect(pin.textContent).toBe('');
  });
});
