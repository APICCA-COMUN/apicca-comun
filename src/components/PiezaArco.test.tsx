import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Axis } from '../../shared/domain/apice';
import { celdasQueCaben, PiezaArco, type ApicePieza } from './PiezaArco';

const ejes: Axis[] = ['agua', 'alimento', 'cobijo', 'energía', 'comunicación'];
const apices = (n: number): ApicePieza[] =>
  Array.from({ length: n }, (_, i) => ({ id: `a${i}`, name: `Ápice ${i + 1}`, axes: [ejes[i % 5]!], status: 'prototipo' as const }));

describe('PiezaArco', () => {
  it('E3 · Celda: tiene un nombre accesible con los Ápices que une', () => {
    render(<PiezaArco apices={apices(3)} ancho={329} alto={120} cel={44} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Ápices que une: Ápice 1, Ápice 2, Ápice 3');
  });

  it('E3 · Celda: dibuja una celda por Ápice y un arco entre cada par', () => {
    const { container } = render(<PiezaArco apices={apices(3)} ancho={329} alto={120} cel={44} />);
    expect(container.querySelectorAll('.celda__contorno')).toHaveLength(3);
    expect(container.querySelectorAll('path.pieza-arco__trazo')).toHaveLength(2);
    expect(container.querySelector('.pieza-arco__mas')).toBeNull();
  });

  it('E3 · Celda: si no caben todos, agrupa los que sobran en una celda «+N» y el nombre los lista todos', () => {
    const lista = apices(9);
    const { container } = render(<PiezaArco apices={lista} ancho={300} alto={96} cel={40} />);
    const caben = celdasQueCaben(300, 40);
    expect(caben).toBeLessThan(9);
    expect(container.querySelectorAll('.celda__contorno')).toHaveLength(caben - 1);
    expect(container.querySelector('.pieza-arco__mas-texto')!.textContent).toBe(`+${9 - (caben - 1)}`);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Ápice 9');
  });

  it('E3 · Celda: con eje lleva el glifo del eje sobre el arco; sin eje, no', () => {
    const con = render(<PiezaArco apices={apices(3)} ancho={329} alto={120} cel={44} eje="agua" />);
    expect(con.container.querySelector('.pieza-arco__glifo')).not.toBeNull();
    const sin = render(<PiezaArco apices={apices(3)} ancho={329} alto={120} cel={44} eje={null} />);
    expect(sin.container.querySelector('.pieza-arco__glifo')).toBeNull();
  });

  it('E3 · Celda: el eje va sobre su losa de color, no como círculo suelto que se confunda con los discos', () => {
    const { container } = render(<PiezaArco apices={apices(3)} ancho={329} alto={120} cel={44} eje="agua" />);
    const glifo = container.querySelector('.pieza-arco__glifo')!;
    expect(glifo.querySelector('.glifo__losa')).not.toBeNull();
    expect(glifo.querySelector('.glifo--losa')).not.toBeNull();
  });

  it('E3 · Celda: cerrada, el arco va con trazo discontinuo (data-cerrada); abierta, continuo', () => {
    const cerrada = render(<PiezaArco apices={apices(3)} ancho={329} alto={120} cel={44} cerrada />);
    expect(cerrada.container.querySelector('svg.pieza-arco')!.getAttribute('data-cerrada')).toBe('true');
    expect(cerrada.container.querySelector('svg.pieza-arco--cerrada')).not.toBeNull();
    const abierta = render(<PiezaArco apices={apices(3)} ancho={329} alto={120} cel={44} />);
    expect(abierta.container.querySelector('svg.pieza-arco')!.getAttribute('data-cerrada')).toBeNull();
  });

  it('E3 · Celda: con un solo Ápice no hay arcos', () => {
    const { container } = render(<PiezaArco apices={apices(1)} ancho={300} alto={96} cel={40} />);
    expect(container.querySelectorAll('path.pieza-arco__trazo')).toHaveLength(0);
    expect(container.querySelectorAll('.celda__contorno')).toHaveLength(1);
  });
});
