// RF-2 (004) · 2.1, 2.2; RF-16 (004) · 16.3: pruebas del bloque de una sección de la constitución.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Section, SectionMeta } from '../../shared/domain/constitution/types';
import { todayInColombia } from '../../shared/domain/dates';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { SectionBlock } from './SectionBlock';

describe('SectionBlock', () => {
  const at = Date.parse('2026-10-02T12:00:00Z');
  const closesAt = Date.parse('2026-10-17T12:00:00Z');

  const section: Section = {
    id: 'sec-cuidado',
    title: 'Cuidado mutuo',
    text: 'Nos cuidamos colectivamente. Más en [APICCA](https://apicca.com).',
    updatedAt: at,
    isRetired: false,
    retiredAt: null,
  };

  const meta: SectionMeta = {
    version: 2,
    proposedByUid: 'uid-ana',
    proposedByUsername: 'ana_vigente',
    openAmendment: {
      id: 'am-1',
      kind: 'change',
      closesAt,
    },
  };

  it('RF-2 (004) · 2.1: visitante ve título, texto con formato y enlaces, y fecha, sin versión ni autoría ni historiales', () => {
    const { container } = render(<SectionBlock section={section} meta={meta} hasActiveAccount={false} />);

    // Título y fecha
    expect(screen.getByRole('heading', { level: 2, name: /cuidado mutuo/i })).toBeDefined();
    expect(container.textContent).toContain(todayInColombia(new Date(at)));

    // Texto con formato y enlaces
    const link = screen.getByRole('link', { name: /apicca/i });
    expect(link.getAttribute('href')).toBe('https://apicca.com');

    // Visitante NO ve datos privados (RF-2 (004) · 2.1)
    expect(container.textContent).not.toContain('ana_vigente');
    expect(container.textContent).not.toMatch(/versión 2/i);
    expect(screen.queryByRole('link', { name: /historial/i })).toBeNull();
    expect(container.textContent).not.toMatch(/propuesta abierta/i);

    // Sin botón azul y estructura de bloques
    expectOnePrimary(container, null);
    expectBlocks(container);
  });

  it('RF-2 (004) · 2.2: cuenta activa ve versión, quién propuso, enlaces a historiales y marca de propuesta abierta con fecha de cierre', () => {
    const { container } = render(<SectionBlock section={section} meta={meta} hasActiveAccount={true} />);

    // Título, texto y fecha siguen presentes
    expect(screen.getByRole('heading', { level: 2, name: /cuidado mutuo/i })).toBeDefined();
    expect(container.textContent).toContain(todayInColombia(new Date(at)));

    // Datos visibles para cuenta activa (RF-2 (004) · 2.2)
    expect(container.textContent).toMatch(/versión 2/i);
    expect(container.textContent).toContain('ana_vigente');

    // Enlaces a historiales (/constitucion/historial y /constitucion/secciones/:id)
    const historyLinks = screen.getAllByRole('link');
    const hasGeneralHistory = historyLinks.some((l) => l.getAttribute('href') === '/constitucion/historial');
    const hasSectionHistory = historyLinks.some(
      (l) => l.getAttribute('href') === `/constitucion/secciones/${section.id}`,
    );
    expect(hasGeneralHistory).toBe(true);
    expect(hasSectionHistory).toBe(true);

    // Marca de propuesta abierta con fecha de cierre
    expect(container.textContent).toMatch(/propuesta abierta/i);
    expect(container.textContent).toContain(todayInColombia(new Date(closesAt)));

    // Sin botón azul y estructura de bloques
    expectOnePrimary(container, null);
    expectBlocks(container);
  });
});
