// RF-3 (004) · 3.2, 3.5; RF-5 (004) · 5.4: pruebas de la lista de versiones de sección o documento.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INITIAL_AUTHOR, type SectionVersion } from '../../shared/domain/constitution/types';
import { todayInColombia } from '../../shared/domain/dates';
import { expectBlocks } from '../testing/expectBlocks';
import { VersionList } from './VersionList';

describe('VersionList', () => {
  const at1 = Date.parse('2026-10-01T15:00:00Z');
  const at2 = Date.parse('2026-10-05T18:00:00Z');

  const v1: SectionVersion = {
    version: 1,
    title: 'Cuidado mutuo',
    text: 'Texto de la primera versión.',
    kind: 'initial',
    amendmentId: null,
    proposedByUid: null,
    proposedByUsername: INITIAL_AUTHOR,
    agreementsCounted: 0,
    authorAgreementCounted: false,
    objectionsResolved: 0,
    objectionsWithdrawn: 0,
    at: at1,
  };

  const v2: SectionVersion = {
    version: 2,
    title: 'Cuidado y apoyo mutuo',
    text: 'Texto enmendado.',
    kind: 'change',
    amendmentId: 'am-123',
    proposedByUid: 'uid-ana',
    proposedByUsername: 'ana_propone',
    agreementsCounted: 4,
    authorAgreementCounted: true,
    objectionsResolved: 1,
    objectionsWithdrawn: 2,
    at: at2,
  };

  it('RF-3 (004) · 3.2: muestra la fecha, quién propuso, acuerdos señalando autoría y objeciones resueltas y retiradas', () => {
    const { container } = render(<VersionList versions={[v2, v1]} />);

    // Fechas formateadas con todayInColombia
    expect(screen.getByText(new RegExp(todayInColombia(new Date(at2))))).toBeDefined();
    expect(screen.getByText(new RegExp(todayInColombia(new Date(at1))))).toBeDefined();

    // Quién propuso
    expect(screen.getByText(/ana_propone/)).toBeDefined();
    expect(screen.getByText(new RegExp(INITIAL_AUTHOR))).toBeDefined();

    // Acuerdos contados señalando si se contó el de quien propuso
    expect(container.textContent).toMatch(/4 acuerdos.*incluye el de quien propuso/i);

    // Objeciones resueltas y retiradas
    expect(container.textContent).toMatch(/1 objeción resuelta|1 resuelta/i);
    expect(container.textContent).toMatch(/2 retiradas/i);

    // Estructura de bloques
    expectBlocks(container);
  });

  it('RF-3 (004) · 3.5: nombra a cada persona por el nombre de usuario guardado en la versión y no por el actual', () => {
    // Si la persona cambió de nombre a 'ana_actual', la versión debe mostrar el guardado 'ana_antigua'
    const vAntigua: SectionVersion = {
      ...v2,
      version: 3,
      proposedByUsername: 'ana_antigua',
    };

    render(<VersionList versions={[vAntigua]} />);
    expect(screen.getByText(/ana_antigua/)).toBeDefined();
    expect(screen.queryByText(/ana_actual/)).toBeNull();
  });

  it('RF-5 (004) · 5.4: admite versiones de documento compatibles con byUsername y muestra su fecha y autoría', () => {
    const docVersions = [
      {
        version: 1,
        at: at1,
        byUsername: 'fabi_facilitador',
        title: 'Reglamento interno',
      },
    ];

    const { container } = render(<VersionList versions={docVersions} />);
    expect(screen.getByText(new RegExp(todayInColombia(new Date(at1))))).toBeDefined();
    expect(screen.getByText(/fabi_facilitador/)).toBeDefined();
    expect(screen.getByText(/versión 1/i)).toBeDefined();
    expectBlocks(container);
  });
});
