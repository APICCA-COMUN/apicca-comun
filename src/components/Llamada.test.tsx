import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Llamada, llamadaPuntos } from './Llamada';

const angulo = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;

describe('Llamada', () => {
  it('E3 · Celda: sale en horizontal y llega a 60° exactos', () => {
    const desde = { x: 0, y: 100 };
    const hasta = { x: 200, y: 20 };
    const p = llamadaPuntos(desde, hasta)!;
    expect(p).toHaveLength(3);
    expect(p[0]).toEqual(desde);
    expect(p[2]).toEqual(hasta);
    expect(p[1]!.y).toBe(desde.y);
    expect(angulo(p[0]!, p[1]!)).toBe(0);
    expect(angulo(p[1]!, p[2]!)).toBeCloseTo(60, 6);
  });

  it('E3 · Celda: funciona hacia abajo y hacia la izquierda', () => {
    const abajo = llamadaPuntos({ x: 10, y: 10 }, { x: 150, y: 90 })!;
    expect(angulo(abajo[1]!, abajo[2]!)).toBeCloseTo(60, 6);
    const izq = llamadaPuntos({ x: 300, y: 80 }, { x: 100, y: 10 })!;
    expect(izq[1]!.x).toBeGreaterThan(izq[2]!.x);
    expect(angulo(izq[1]!, izq[2]!)).toBeCloseTo(60, 6);
  });

  it('E3 · Celda: a la misma altura es solo una horizontal', () => {
    expect(llamadaPuntos({ x: 0, y: 5 }, { x: 80, y: 5 })).toEqual([{ x: 0, y: 5 }, { x: 80, y: 5 }]);
  });

  it('E3 · Celda: sin espacio para el horizontal, queda solo el tramo a 60° desde la x de salida', () => {
    const desde = { x: 0, y: 100 };
    const hasta = { x: 20, y: 0 };
    const p = llamadaPuntos(desde, hasta)!;
    expect(p).toHaveLength(2);
    expect(p[0]!.x).toBe(0);
    expect(angulo(p[0]!, p[1]!)).toBeCloseTo(60, 6);
    expect(p[1]).toEqual(hasta);
  });

  it('E3 · Celda: sin distancia horizontal no dibuja nada', () => {
    expect(llamadaPuntos({ x: 5, y: 0 }, { x: 5, y: 50 })).toBeNull();
    const { container } = render(<Llamada desde={{ x: 5, y: 0 }} hasta={{ x: 5, y: 50 }} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('E3 · Celda: el SVG es decorativo, no recibe puntero y termina en un disco de radio 4', () => {
    const { container } = render(<Llamada desde={{ x: 0, y: 60 }} hasta={{ x: 160, y: 0 }} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toContain('llamada');
    expect(container.querySelector('circle.llamada__disco')!.getAttribute('r')).toBe('4');
    expect(container.querySelector('polyline.llamada__trazo')!.getAttribute('style')).toContain('1.5');
    expect(container.querySelector('polyline.llamada__halo')!.getAttribute('style')).toContain('4.5');
  });
});
