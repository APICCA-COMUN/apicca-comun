import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LeyendaControl } from './LeyendaControl';

const base = { ejes: [] as const, onEje: () => {}, etapa: null, onEtapa: () => {} };

describe('LeyendaControl', () => {
  it('E3 · Celda: dibuja los grupos «Filtrar por eje» y «Etapa»; sin onNivel no dibuja «Nivel»', () => {
    render(<LeyendaControl {...base} />);
    expect(screen.getByRole('group', { name: 'Filtrar por eje' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Etapa' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Nivel' })).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Filtrar por eje' })).getAllByRole('button')).toHaveLength(5);
    expect(within(screen.getByRole('group', { name: 'Etapa' })).getAllByRole('button')).toHaveLength(3);
  });

  it('E3 · Celda: con onNivel dibuja tres niveles y marca el activo con aria-pressed', async () => {
    const onNivel = vi.fn();
    render(<LeyendaControl {...base} nivel={1} onNivel={onNivel} />);
    const grupo = screen.getByRole('group', { name: 'Nivel' });
    const botones = within(grupo).getAllByRole('button');
    expect(botones).toHaveLength(3);
    expect(within(grupo).getByRole('button', { name: 'Nivel 1' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(grupo).getByRole('button', { name: /Nivel 0/ }).getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(within(grupo).getByRole('button', { name: /Nivel 0/ }));
    expect(onNivel).toHaveBeenCalledWith(0);
  });

  it('E3 · Celda: cada botón de eje tiene el nombre del eje y aria-pressed según esté elegido', () => {
    render(<LeyendaControl {...base} ejes={['agua', 'cobijo']} />);
    expect(screen.getByRole('button', { name: 'Agua' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Cobijo' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Energía' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Energía' }).getAttribute('data-encendido')).toBe('false');
    expect(screen.getByRole('button', { name: 'Agua' }).getAttribute('data-encendido')).toBe('true');
  });

  it('E3 · Celda: sin ejes elegidos no hay filtro: todos encendidos y ninguno pulsado', () => {
    render(<LeyendaControl {...base} />);
    for (const nombre of ['Agua', 'Alimento', 'Cobijo', 'Energía', 'Comunicación']) {
      const boton = screen.getByRole('button', { name: nombre });
      expect(boton.getAttribute('aria-pressed')).toBe('false');
      expect(boton.getAttribute('data-encendido')).toBe('true');
    }
  });

  it('E3 · Celda: tocar un eje avisa con el eje', async () => {
    const onEje = vi.fn();
    render(<LeyendaControl {...base} onEje={onEje} />);
    await userEvent.click(screen.getByRole('button', { name: 'Energía' }));
    expect(onEje).toHaveBeenCalledWith('energía');
  });

  it('E3 · Celda: tocar una Etapa la elige y tocar la elegida la quita', async () => {
    const onEtapa = vi.fn();
    const { rerender } = render(<LeyendaControl {...base} onEtapa={onEtapa} />);
    await userEvent.click(screen.getByRole('button', { name: /Etapa Prototipo/ }));
    expect(onEtapa).toHaveBeenLastCalledWith('prototipo');
    rerender(<LeyendaControl {...base} etapa="prototipo" onEtapa={onEtapa} />);
    const elegida = screen.getByRole('button', { name: /Etapa Prototipo/ });
    expect(elegida.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(elegida);
    expect(onEtapa).toHaveBeenLastCalledWith(null);
  });

  it('E3 · Celda: «Quitar filtros» aparece solo con onQuitar y algún filtro, y avisa al tocarlo', async () => {
    const onQuitar = vi.fn();
    const { rerender } = render(<LeyendaControl {...base} onQuitar={onQuitar} />);
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
    rerender(<LeyendaControl {...base} ejes={['agua']} onQuitar={onQuitar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(onQuitar).toHaveBeenCalledTimes(1);
    rerender(<LeyendaControl {...base} ejes={['agua']} />);
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
  });

  it('E3 · Celda: el color no es la única señal: el glifo va en cada eje, macizo si está encendido y en línea si no', () => {
    render(<LeyendaControl {...base} ejes={['agua']} />);
    const encendido = screen.getByRole('button', { name: 'Agua' });
    const apagado = screen.getByRole('button', { name: 'Energía' });
    expect(encendido.querySelector('svg')).not.toBeNull();
    expect(apagado.querySelector('svg')).not.toBeNull();
    expect(encendido.querySelector('.leyenda-control__glifo')).not.toBeNull();
    expect(apagado.querySelector('.leyenda-control__glifo--apagado')).not.toBeNull();
  });
});
