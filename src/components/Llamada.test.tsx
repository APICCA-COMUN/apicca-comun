import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ARC_BENDS } from '../../shared/domain/mapArcs';
import { Llamada, llamadaArco } from './Llamada';

describe('Llamada', () => {
  it('E3 · Celda: es un arco cuadrático de desde a hasta, con la comba menor del Arco', () => {
    const desde = { x: 0, y: 100 };
    const hasta = { x: 200, y: 20 };
    const arco = llamadaArco(desde, hasta)!;
    expect(arco.d).toMatch(/^M0 100Q/);
    expect(arco.k).toBe(ARC_BENDS[0]);
    const primera = arco.samples[0]!;
    const ultima = arco.samples[arco.samples.length - 1]!;
    expect(primera.x).toBeCloseTo(desde.x, 3);
    expect(primera.y).toBeCloseTo(desde.y, 3);
    expect(ultima.x).toBeCloseTo(hasta.x, 3);
    expect(ultima.y).toBeCloseTo(hasta.y, 3);
  });

  it('E3 · Celda: la comba va hacia arriba, hacia la derecha y hacia la izquierda', () => {
    for (const [desde, hasta] of [
      [{ x: 0, y: 50 }, { x: 200, y: 50 }],
      [{ x: 300, y: 50 }, { x: 100, y: 50 }],
    ] as const) {
      const arco = llamadaArco(desde, hasta)!;
      const medio = arco.samples[Math.floor(arco.samples.length / 2)]!;
      expect(medio.y).toBeLessThan(50 - 10);
    }
  });

  it('E3 · Celda: sin distancia horizontal no dibuja nada', () => {
    expect(llamadaArco({ x: 5, y: 0 }, { x: 5, y: 50 })).toBeNull();
    const { container } = render(<Llamada desde={{ x: 5, y: 0 }} hasta={{ x: 5, y: 50 }} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('E3 · Celda: el SVG es decorativo, no recibe puntero y termina en un solo disco de radio 4', () => {
    const { container } = render(<Llamada desde={{ x: 0, y: 60 }} hasta={{ x: 160, y: 0 }} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toContain('llamada');
    expect(container.querySelectorAll('circle.llamada__disco')).toHaveLength(1);
    expect(container.querySelector('circle.llamada__disco')!.getAttribute('r')).toBe('4');
    expect(container.querySelector('path.llamada__trazo')!.getAttribute('d')).toContain('Q');
    expect(container.querySelector('path.llamada__trazo')!.getAttribute('style')).toContain('1.5');
    expect(container.querySelector('path.llamada__halo')!.getAttribute('style')).toContain('4.5');
  });
});
