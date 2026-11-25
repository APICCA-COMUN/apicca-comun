import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CeldaGrande } from './CeldaGrande';

describe('CeldaGrande', () => {
  it('E3 · Celda: con título tiene nombre accesible con los ejes y la Etapa', () => {
    render(<CeldaGrande axes={['agua', 'cobijo']} status="prototipo" ancho={280} titulo="Huerta de lluvia" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('Huerta de lluvia');
    expect(img.getAttribute('aria-label')).toMatch(/agua/i);
    expect(img.getAttribute('aria-label')).toMatch(/cobijo/i);
  });

  it('E3 · Celda: sin título es decorativa', () => {
    const { container } = render(<CeldaGrande axes={['energía']} status="idea" ancho={280} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('E3 · Celda: mide el ancho dado, con el alto de un hexágono de punta plana', () => {
    const { container } = render(<CeldaGrande axes={['agua']} status="idea" ancho={280} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('280');
    expect(Number(svg.getAttribute('height'))).toBeCloseTo((280 * Math.sqrt(3)) / 2, 5);
  });

  it('E3 · Celda: lleva franjas recortadas al hexágono y contorno', () => {
    const { container } = render(<CeldaGrande axes={['agua', 'alimento']} status="prototipo" ancho={280} />);
    expect(container.querySelector('clipPath')).not.toBeNull();
    expect(container.querySelector('.celda__contorno')).not.toBeNull();
  });
});
