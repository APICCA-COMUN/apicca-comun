import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Celda, CeldaSuperficie, celdaAlto, celdaPuntos, escalaPatron } from './Celda';

describe('Celda', () => {
  it('E3 · Celda: el hexágono es de punta plana, con alto = ancho · √3 / 2', () => {
    expect(celdaAlto(100)).toBeCloseTo(86.6, 1);
    const puntos = celdaPuntos(100).split(' ').map((p) => p.split(',').map(Number) as [number, number]);
    expect(puntos).toHaveLength(6);
    // Vértices a 0° y 180° sobre el eje horizontal: la punta queda a los lados (punta plana arriba y abajo).
    expect(puntos[0]![0]).toBeCloseTo(100, 1);
    expect(puntos[3]![0]).toBeCloseTo(0, 1);
    expect(puntos[0]![1]).toBeCloseTo(celdaAlto(100) / 2, 1);
    expect(puntos[1]![1]).toBeCloseTo(celdaAlto(100), 1);
    expect(puntos[4]![1]).toBeCloseTo(0, 1);
  });

  it('E3 · Celda: con contorno, el hexágono se mete media línea para no salirse del lienzo', () => {
    const sin = celdaPuntos(100, 0).split(' ').map((p) => Number(p.split(',')[0]));
    const con = celdaPuntos(100, 4).split(' ').map((p) => Number(p.split(',')[0]));
    expect(Math.max(...con)).toBeLessThan(Math.max(...sin));
    expect(Math.max(...con) + 2 * (2 / Math.sqrt(3)) / 2).toBeLessThanOrEqual(100.01);
  });

  it('E3 · Celda: es decorativa, mide lo que dice y lleva dentro a sus hijos', () => {
    const { container } = render(
      <Celda ancho={40} relleno="var(--text)" contorno="var(--background)" grosor={2}>
        <span>7</span>
      </Celda>,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('40');
    expect(container.querySelector('polygon')!.getAttribute('style')).toContain('stroke-width: 2');
    expect(container.querySelector('.celda__dentro')!.textContent).toBe('7');
  });

  it('E3 · Celda: la escala del patrón sigue la proporción del mapa', () => {
    expect(escalaPatron(280)).toBeCloseTo(1.3, 1);
    expect(escalaPatron(44)).toBeCloseTo(0.2, 1);
  });

  it('E3 · Celda: la celda con superficie recorta las franjas al hexágono y tiene contorno', () => {
    const { container } = render(<CeldaSuperficie axes={['agua', 'cobijo']} status="prototipo" ancho={80} label="Ápice, agua y cobijo" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Ápice, agua y cobijo');
    expect(container.querySelector('clipPath polygon')).not.toBeNull();
    expect(container.querySelector('g[clip-path]')).not.toBeNull();
    expect(container.querySelector('polygon.celda__contorno')).not.toBeNull();
  });

  it('E3 · Celda: sin nombre, la celda con superficie es decorativa', () => {
    const { container } = render(<CeldaSuperficie axes={['agua']} status="idea" ancho={44} />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg')!.getAttribute('role')).toBeNull();
  });
});
