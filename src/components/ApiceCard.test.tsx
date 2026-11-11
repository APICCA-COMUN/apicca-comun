import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APICE_STAGE_LABEL } from '../../shared/domain/apice';
import { buildingVariant } from '../../shared/domain/identity';
import { ApiceCard } from './ApiceCard';
import { expectBlocks } from '../testing/expectBlocks';

const base = {
  id: 'a1',
  name: 'Cosecha de lluvia',
  description: 'Captamos agua de lluvia en el techo comunal.',
  axes: ['agua' as const, 'cobijo' as const],
  status: 'prototipo' as const,
  updatedAt: { seconds: Date.parse('2026-09-03T15:00:00Z') / 1000, nanoseconds: 0 },
};

describe('ApiceCard', () => {
  it('RF-21 (001), RF-22 (001), RF-2 (021) · 2.1: muestra los datos de la tarjeta, con el edificio en lugar de la imagen, y enlaza a la ficha', () => {
    render(<ApiceCard apice={base} />);
    const card = screen.getByRole('article');
    expect(within(card).getByRole('link', { name: 'Cosecha de lluvia' }).getAttribute('href')).toBe('/apices/a1');
    expect(card.querySelector('.building svg.building__drawing')).not.toBeNull();
    expect(within(card).getByText('Agua')).toBeTruthy();
    expect(within(card).getByText('Cobijo')).toBeTruthy();
    expect(within(card).getAllByText('Prototipo').length).toBeGreaterThan(0);
    expect(within(card).getByText(/\b3\b.*2026/)).toBeTruthy();
    expect(within(card).getByText('Captamos agua de lluvia en el techo comunal.')).toBeTruthy();
  });

  it('RF-1 (021) · 1.1, RF-27 (021) · 27.4: la tarjeta no muestra imágenes ni el marcador «Sin imagen», aunque el ápice guarde una', () => {
    const stored = { ...base, image: { altText: 'Un techo con canaletas', png: new Uint8Array([1]) } };
    const { container } = render(<ApiceCard apice={stored} />);
    expect(container.querySelectorAll('img, .pixel-image')).toHaveLength(0);
    expect(screen.queryByRole('img', { name: 'Un techo con canaletas' })).toBeNull();
    expect(container.textContent).not.toContain('Sin imagen');
  });

  it('RF-21 (001): el extracto se corta a 200 caracteres', () => {
    render(<ApiceCard apice={{ ...base, description: 'a'.repeat(500) }} />);
    expect(screen.getByText('a'.repeat(200))).toBeTruthy();
  });
});

describe('ApiceCard · bloques (002)', () => {
  it('RF-6 (002) · 6.1: la tarjeta es un bloque y pasa expectBlocks', () => {
    const { container } = render(<ApiceCard apice={base} />);
    expect(screen.getByRole('article').classList.contains('block')).toBe(true);
    expectBlocks(container);
  });
});

describe('ApiceCard · identidad (002)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RF-4 (002) · 4.2: cada eje se muestra con su ícono y su nombre', () => {
    const { container } = render(<ApiceCard apice={{ ...base, axes: ['agua', 'energía'] }} />);
    const list = within(screen.getByRole('list', { name: 'Ejes' }));
    expect(list.getByText('Agua')).toBeTruthy();
    expect(list.getByText('Energía')).toBeTruthy();
    expect(container.querySelector('ul .axis-icon--agua')).toBeTruthy();
    expect(container.querySelector('ul .axis-icon--energia')).toBeTruthy();
  });

  it('RF-7 (002) · 7.2, RF-2 (021) · 2.4, 2.5, D-T4 (021): el edificio de la tarjeta mide 128 px como máximo y su forma sale del id', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    const { container } = render(<ApiceCard apice={base} />);
    const building = container.querySelector('.building')!;
    const drawing = building.querySelector('svg.building__drawing')!;
    expect([drawing.getAttribute('width'), drawing.getAttribute('height')]).toEqual(['128', '128']);
    expect(building.getAttribute('data-variant')).toBe(String(buildingVariant('a1')));
  });

  it('RF-13 (002) · 13.1, 13.3: el estado es una etiqueta con el texto de la 001', () => {
    for (const status of ['idea', 'prototipo', 'en marcha'] as const) {
      const { container, unmount } = render(<ApiceCard apice={{ ...base, status }} />);
      const tag = container.querySelector('.tag[data-condition="status"]');
      expect(tag?.textContent).toBe(APICE_STAGE_LABEL[status]);
      unmount();
    }
  });

  it('RF-17 (019) · 17.2, D-T11 (019): la etiqueta de la etapa lleva mayúscula inicial', () => {
    for (const [status, label] of [['idea', 'Idea'], ['prototipo', 'Prototipo'], ['en marcha', 'En marcha']] as const) {
      const { container, unmount } = render(<ApiceCard apice={{ ...base, status }} />);
      expect(container.querySelector('.tag[data-condition="status"]')?.textContent).toBe(label);
      unmount();
    }
  });
  it('RF-3 (021) · 3.1 a 3.3, RF-4 (019) · 4.1, 4.4, D-T19 (019): el edificio de la tarjeta sigue la etapa y la dice en texto', () => {
    for (const [status, parts] of [
      ['idea', 1],
      ['prototipo', 2],
      ['en marcha', 3],
    ] as const) {
      const { container, unmount } = render(<ApiceCard apice={{ ...base, status }} />);
      expect(container.querySelector('.building')!.getAttribute('data-stage')).toBe(status);
      expect(container.querySelectorAll('.building__base, .building__body, .building__roof')).toHaveLength(parts);
      expect(container.querySelector('.building__stage')!.textContent).toBe(APICE_STAGE_LABEL[status]);
      unmount();
    }
  });

  it('RF-9 (019) · 9.1, 9.2, D-T21 (019): con necesidades con texto la tarjeta pone el pin y dice «Tiene necesidades»', () => {
    const { container, rerender } = render(<ApiceCard apice={{ ...base, needs: 'Tejas' }} />);
    expect(container.querySelector('.building__pin')).not.toBeNull();
    expect(screen.getByText('Tiene necesidades')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d+ necesidades?/i);
    rerender(<ApiceCard apice={{ ...base, needs: '  ' }} />);
    expect(container.querySelector('.building__pin')).toBeNull();
    expect(screen.queryByText('Tiene necesidades')).toBeNull();
    rerender(<ApiceCard apice={base} />);
    expect(screen.queryByText('Tiene necesidades')).toBeNull();
  });
});
