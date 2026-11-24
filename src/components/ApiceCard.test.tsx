import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APICE_STAGE_LABEL } from '../../shared/domain/apice';
import { ApiceCard, ApiceRow } from './ApiceCard';
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
  it('RF-21 (001), RF-22 (001), RF-2 (021) · 2.1: muestra los datos de la tarjeta, con la superficie del Ápice en lugar de la imagen, y enlaza a la ficha', () => {
    render(<ApiceCard apice={base} />);
    const card = screen.getByRole('article');
    expect(within(card).getByRole('link', { name: 'Cosecha de lluvia' }).getAttribute('href')).toBe('/apices/a1');
    expect(card.querySelector('.superficie svg.superficie__franja')).not.toBeNull();
    expect(within(card).getByText('agua')).toBeTruthy();
    expect(within(card).getByText('cobijo')).toBeTruthy();
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
  it('RF-4 (002) · 4.2: cada eje se muestra con su ícono y su nombre', () => {
    const { container } = render(<ApiceCard apice={{ ...base, axes: ['agua', 'energía'] }} />);
    const list = within(screen.getByRole('list', { name: 'Ejes' }));
    expect(list.getByText('agua')).toBeTruthy();
    expect(list.getByText('energía')).toBeTruthy();
    expect(container.querySelector('ul .axis-icon--agua')).toBeTruthy();
    expect(container.querySelector('ul .axis-icon--energia')).toBeTruthy();
  });

  it('la superficie de la tarjeta lleva una franja por eje, contorno y nombre accesible con la Etapa', () => {
    const { container } = render(<ApiceCard apice={base} />);
    const surface = container.querySelector('.superficie')!;
    expect(surface.classList.contains('superficie--contorno')).toBe(true);
    expect(surface.getAttribute('role')).toBe('img');
    expect(surface.getAttribute('aria-label')).toBe('agua y cobijo, Etapa Prototipo');
    expect(surface.querySelectorAll('svg.superficie__franja')).toHaveLength(2);
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
  it('RF-3 (021) · 3.1 a 3.3: la regla de la superficie sigue la Etapa y la Etapa se dice en texto', () => {
    for (const [status, rule] of [
      ['idea', 'tresbolillo'],
      ['prototipo', 'encaje'],
      ['en marcha', 'eco'],
    ] as const) {
      const { container, unmount } = render(<ApiceCard apice={{ ...base, status }} />);
      expect(container.querySelector('.superficie')!.getAttribute('data-rule')).toBe(rule);
      expect(container.querySelector('.tag[data-condition="status"]')!.textContent).toBe(APICE_STAGE_LABEL[status]);
      unmount();
    }
  });

  it('RF-9 (019) · 9.1, 9.2, D-T21 (019): con necesidades con texto la tarjeta dice «Tiene necesidades»', () => {
    const { rerender } = render(<ApiceCard apice={{ ...base, needs: 'Tejas' }} />);
    expect(screen.getByText('Tiene necesidades')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+ necesidades?/i);
    rerender(<ApiceCard apice={{ ...base, needs: '  ' }} />);
    expect(screen.queryByText('Tiene necesidades')).toBeNull();
    rerender(<ApiceCard apice={base} />);
    expect(screen.queryByText('Tiene necesidades')).toBeNull();
  });
});

describe('ApiceRow', () => {
  it('es una fila con la superficie de 56 × 34, el nombre y el código de zona; enlaza a la ficha', () => {
    const located = { ...base, location: { lat: 4.6, lng: -74.1, precision: 'approximate' as const, zone: { cell: '872830828ffffff', lat: 4.6, lng: -74.1 } } };
    const { container } = render(
      <ul>
        <ApiceRow apice={located} />
      </ul>,
    );
    const link = screen.getByRole('link', { name: /Cosecha de lluvia/ });
    expect(link.getAttribute('href')).toBe('/apices/a1');
    expect(container.querySelector('.superficie')!.getAttribute('aria-hidden')).toBe('true');
    expect((container.querySelector('.superficie') as HTMLElement).style.inlineSize).toBe('56px');
    expect((container.querySelector('.superficie') as HTMLElement).style.blockSize).toBe('34px');
    expect(container.querySelector('.apice-row__zone')!.textContent).toBe('0828');
    expect(container.textContent).toContain('agua y cobijo, Etapa Prototipo, zona 0828');
  });

  it('sin zona no muestra código, y el Ápice abierto se marca con aria-current', () => {
    const { container } = render(
      <ul>
        <ApiceRow apice={base} current />
      </ul>,
    );
    expect(container.querySelector('.apice-row__zone')).toBeNull();
    expect(screen.getByRole('link').getAttribute('aria-current')).toBe('true');
  });
});

describe('ApiceCard · fechas (024)', () => {
  it('RF-5 (024): la última edición se lee en forma larga', () => {
    render(<ApiceCard apice={base} />);
    expect(screen.getByText('Editado el 3 de septiembre de 2026')).toBeTruthy();
  });
});

describe('ApiceCard · privado (024)', () => {
  it('RF-7 (024) · 7.1: un ápice privado muestra la etiqueta de condición «privado»', () => {
    render(<ApiceCard apice={{ ...base, visibility: 'private' }} />);
    const tag = screen.getByRole('article').querySelector('[data-condition="visibility"]');
    expect(tag?.textContent).toBe('privado');
  });

  it('RF-7 (024): un ápice público, o sin el campo, no muestra la etiqueta', () => {
    const { unmount } = render(<ApiceCard apice={{ ...base, visibility: 'public' }} />);
    expect(screen.getByRole('article').querySelector('[data-condition="visibility"]')).toBeNull();
    unmount();
    render(<ApiceCard apice={base} />);
    expect(screen.getByRole('article').querySelector('[data-condition="visibility"]')).toBeNull();
  });
});
