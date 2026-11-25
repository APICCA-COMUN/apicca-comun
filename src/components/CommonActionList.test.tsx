// «E3 · Celda»: la sección «Acciones Comunes» de la vista de lista, sin tarjetas.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import { COMMON_ACTION_LIMITS } from '../../shared/domain/commonActions';
import type { CommonActionSummary } from '../data/commonActions';
import { expectBlocks } from '../testing/expectBlocks';
import { CommonActionList } from './CommonActionList';

const summary = (n: number, extra: Partial<CommonActionSummary> = {}): CommonActionSummary => ({
  id: `c${n}`,
  title: `Acción ${n}`,
  description: 'x'.repeat(30),
  axis: 'agua',
  status: 'abierta',
  authorUid: 'u-ana',
  authorUsername: 'ana',
  apiceIds: ['a1', 'a2'],
  participantUids: ['u-ana'],
  participantCount: 1,
  createdAt: n,
  ...extra,
});

describe('CommonActionList', () => {
  it('no pinta nada mientras cargan', () => {
    const { container } = render(<CommonActionList actions={null} mine={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('abre con la línea de sección y lista cada Acción Común como una fila de datos, sin tarjetas', () => {
    const { container } = render(<CommonActionList actions={[summary(1), summary(2, { participantCount: 3, status: 'cerrada', axis: null })]} mine={false} />);
    const region = screen.getByRole('region', { name: 'Acciones Comunes' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Acciones Comunes' }).closest('.c-seccion')).not.toBeNull();
    const items = region.querySelectorAll('article');
    expect(items.length).toBe(2);
    expect([...items].every((item) => item.classList.contains('c-dato') && !item.classList.contains('block'))).toBe(true);
    expect(within(region).getByRole('link', { name: 'Acción 1' }).getAttribute('href')).toBe('/acciones/c1');
    expect(within(region).getByText('Abierta · Propuesta por @ana · 1 participante')).toBeTruthy();
    expect(within(region).getByText('Cerrada · Propuesta por @ana · 3 participantes')).toBeTruthy();
    expect(items[0]!.querySelector('.ejes-linea')).not.toBeNull();
    expect(items[1]!.querySelector('.ejes-linea')).toBeNull();
    expectBlocks(container, { nesting: true });
  });

  it('con `apiceInfo` de al menos dos Ápices que une, dibuja su Arco de 300 × 96 con celdas de 40', () => {
    const info = new Map<string, { axes: Axis[]; status: ApiceStatus; name?: string }>([
      ['a1', { axes: ['agua'], status: 'idea', name: 'Uno' }],
      ['a2', { axes: ['cobijo'], status: 'prototipo', name: 'Dos' }],
    ]);
    const { container } = render(<CommonActionList actions={[summary(1)]} mine={false} apiceInfo={info} />);
    const arco = container.querySelector('.common-action-list__arco svg.pieza-arco')!;
    expect(arco.getAttribute('width')).toBe('300');
    expect(arco.getAttribute('height')).toBe('96');
    expect(arco.getAttribute('aria-label')).toBe('Ápices que une: Uno, Dos');
    expect(container.querySelectorAll('.celda-superficie')).toHaveLength(0);
  });

  it('con menos de dos Ápices conocidos, o sin `apiceInfo`, no dibuja nada (ni celdas sueltas)', () => {
    const one = new Map<string, { axes: Axis[]; status: ApiceStatus }>([['a1', { axes: ['agua'], status: 'idea' }]]);
    const { container, rerender } = render(<CommonActionList actions={[summary(1)]} mine={false} apiceInfo={one} />);
    expect(container.querySelector('.pieza-arco, svg.celda-superficie')).toBeNull();
    rerender(<CommonActionList actions={[summary(1)]} mine={false} />);
    expect(container.querySelector('.pieza-arco, svg.celda-superficie')).toBeNull();
  });

  it('sin Acciones Comunes lo dice; con «Lo mío», ofrece verlas todas con un enlace de texto', () => {
    const { rerender } = render(<CommonActionList actions={[]} mine={false} />);
    expect(screen.getByText('Todavía no hay Acciones Comunes.')).toBeTruthy();
    rerender(<CommonActionList actions={[]} mine />);
    const link = screen.getByRole('link', { name: 'Ver todas las Acciones Comunes' });
    expect(link.getAttribute('href')).toBe('/acciones');
    expect(link.classList.contains('c-enlace')).toBe(true);
  });

  it('muestra una tanda y «Ver más Acciones Comunes» (enlace de texto) trae la siguiente', () => {
    const total = COMMON_ACTION_LIMITS.pageSize + 2;
    render(<CommonActionList actions={Array.from({ length: total }, (_, i) => summary(i + 1))} mine={false} />);
    expect(screen.getAllByRole('article')).toHaveLength(COMMON_ACTION_LIMITS.pageSize);
    const more = screen.getByRole('button', { name: 'Ver más Acciones Comunes' });
    expect(more.classList.contains('c-enlace') && more.classList.contains('action-secondary')).toBe(true);
    fireEvent.click(more);
    expect(screen.getAllByRole('article')).toHaveLength(total);
    expect(screen.queryByRole('button', { name: 'Ver más Acciones Comunes' })).toBeNull();
  });
});
