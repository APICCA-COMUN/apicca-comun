import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiceCard } from './ApiceCard';
import { expectBlocks } from '../testing/expectBlocks';

const base = {
  id: 'a1',
  name: 'Cosecha de lluvia',
  description: 'Captamos agua de lluvia en el techo comunal.',
  axes: ['agua' as const, 'cobijo' as const],
  status: 'prototipo' as const,
  updatedAt: { seconds: Date.parse('2026-09-03T15:00:00Z') / 1000, nanoseconds: 0 },
  image: null,
};

describe('ApiceCard', () => {
  it('RF-21 (001), RF-22 (001): muestra los siete datos de la tarjeta y enlaza a la ficha', () => {
    render(<ApiceCard apice={{ ...base, image: { altText: 'Un techo con canaletas', png: new Uint8Array([1]) } }} />);
    const card = screen.getByRole('article');
    expect(within(card).getByRole('link', { name: 'Cosecha de lluvia' }).getAttribute('href')).toBe('/apices/a1');
    expect(within(card).getByRole('img', { name: 'Un techo con canaletas' })).toBeTruthy();
    expect(within(card).getByText('Agua')).toBeTruthy();
    expect(within(card).getByText('Cobijo')).toBeTruthy();
    expect(within(card).getByText('prototipo')).toBeTruthy();
    expect(within(card).getByText(/\b3\b.*2026/)).toBeTruthy();
    expect(within(card).getByText('Captamos agua de lluvia en el techo comunal.')).toBeTruthy();
  });

  it('RF-18 (001): sin imagen la tarjeta conserva el marcador', () => {
    render(<ApiceCard apice={base} />);
    expect(screen.getByRole('img', { name: 'Sin imagen' })).toBeTruthy();
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

  it('RF-7 (002) · 7.1, 7.2: la imagen va en un edificio de 128 px como máximo', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    const { container } = render(<ApiceCard apice={{ ...base, image: { altText: 'Un techo', png: new Uint8Array([1]) } }} />);
    expect(container.querySelector('.building')).toBeTruthy();
    const img = screen.getByRole('img', { name: 'Un techo' });
    expect([img.style.width, img.style.height]).toEqual(['128px', '128px']);
  });

  it('RF-13 (002) · 13.1, 13.3: el estado es una etiqueta con el texto de la 001', () => {
    for (const status of ['idea', 'prototipo', 'en marcha'] as const) {
      const { container, unmount } = render(<ApiceCard apice={{ ...base, status }} />);
      const tag = container.querySelector('.tag[data-condition="status"]');
      expect(tag?.textContent).toBe(status);
      unmount();
    }
  });
});
