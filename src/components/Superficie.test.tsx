// Sistema «APICCA · Mapa»: superficie de patrón, glifo, leyendas e íconos de interfaz.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { AXIS_ICONS, axisIdentity } from '../../shared/domain/identity';
import { Glifo, Icono, LeyendaEjes, LeyendaEtapa } from './Glifo';
import { Superficie } from './Superficie';

describe('Superficie', () => {
  it('la regla dice la Etapa y el nombre accesible dice ejes y Etapa', () => {
    render(<Superficie axes={['agua', 'cobijo']} status="prototipo" width={120} height={60} />);
    const s = screen.getByRole('img', { name: 'agua y cobijo, Etapa Prototipo' });
    expect(s.dataset.rule).toBe('encaje');
    expect(s.classList.contains('superficie--contorno')).toBe(true);
  });

  it('un Ápice de dos ejes va en dos franjas, en el orden declarado', () => {
    const { container } = render(<Superficie axes={['energía', 'agua']} status="en marcha" width={120} height={60} decorative />);
    const stripes = [...container.querySelectorAll('.superficie__franja')];
    expect(stripes.map((el) => el.getAttribute('class'))).toEqual([
      'superficie__franja superficie--energia',
      'superficie__franja superficie--agua',
    ]);
    // el eco lleva anillos de trazo
    expect(container.querySelectorAll('.superficie__ecos')).toHaveLength(2);
  });

  it('decorativa no tiene nombre accesible', () => {
    const { container } = render(<Superficie axes={['agua']} width={40} height={20} decorative />);
    expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Glifo', () => {
  it.each(AXES)('el glifo de %s sobre su losa es el de AXIS_ICONS', (axis) => {
    const { container } = render(<Glifo axis={axis} />);
    expect(container.querySelector('.glifo__losa')).not.toBeNull();
    expect(container.querySelector('.glifo__forma')!.getAttribute('d')).toBe(AXIS_ICONS[axisIdentity(axis).key].d);
  });

  it('suelto no lleva losa', () => {
    const { container } = render(<Glifo axis="agua" tile={false} />);
    expect(container.querySelector('.glifo__losa')).toBeNull();
  });
});

describe('leyendas e íconos', () => {
  it('la leyenda de Etapa muestra las tres Etapas con su regla', () => {
    render(<LeyendaEtapa showRule />);
    const items = screen.getByRole('list', { name: 'Etapas' }).querySelectorAll('li');
    expect([...items].map((li) => li.textContent)).toEqual(['Ideatresbolillo', 'Prototipoencaje', 'En marchaeco']);
  });

  it('la leyenda de ejes lleva los cinco ejes', () => {
    render(<LeyendaEjes />);
    expect(screen.getByRole('list', { name: 'Ejes' }).querySelectorAll('li')).toHaveLength(5);
  });

  it('un ícono con etiqueta tiene nombre accesible', () => {
    render(<Icono name="cerrar" label="Cerrar" />);
    expect(screen.getByRole('img', { name: 'Cerrar' })).toBeDefined();
  });
});
